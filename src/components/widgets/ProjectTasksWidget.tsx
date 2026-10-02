"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckSquare, X, Plus, Loader2, Calendar, Pencil, Check, Milestone, ChevronDown, ChevronRight, Link, PlusCircle, CheckCircle2 } from 'lucide-react';
import { getProjectTasks, addTaskToProject, updateTaskStatus, updateTask, getProjectMilestones, createProjectMilestone, linkTaskToMilestone, updateProjectMilestone } from '@/app/actions';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Switching projects unmounts this widget and mounts a fresh one, so without
// somewhere outside React to keep them, every switch refetched from scratch and
// sat on a spinner — including going straight back to a project just viewed.
// Module scope survives that, so a revisit paints from the cache immediately
// and refreshes behind the scenes.
const projectCache = new Map<string, { tasks: any[]; milestones: any[] }>();

/** Only the fields the table reads; the widget still passes whole task rows. */
interface TableTask {
  id: string;
  title: string;
  status: string;
  milestone_id?: string | null;
  scheduled_date?: string | null;
  estimated_minutes?: number | null;
  metadata?: Record<string, unknown> | null;
}

interface ProjectTasksWidgetProps {
  projectId: string;
  widget: any;
  onDelete: () => Promise<void>;
}

export default function ProjectTasksWidget({ projectId, widget, onDelete }: ProjectTasksWidgetProps) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDate, setNewTaskDate] = useState('');
  const [newTaskMilestone, setNewTaskMilestone] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDate, setEditDate] = useState('');
  const [saving, setSaving] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);
  const firstOpenRowRef = useRef<HTMLTableRowElement>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  // Which milestones have had their full rows fetched. A project the size of
  // Study is 257kB of JSON if every group is loaded at once, and that read was
  // most of the database egress for the whole app — so only the group you open
  // pays for its detail.
  const [loadedGroups, setLoadedGroups] = useState<Set<string>>(new Set());
  const [loadingGroup, setLoadingGroup] = useState<string | null>(null);
  // Milestone dates edited here, held locally so the field reflects the typing
  // rather than waiting for the refetch.
  const [milestoneDates, setMilestoneDates] = useState<Record<string, { start_date?: string; target_date?: string }>>({});
  const [savingMilestone, setSavingMilestone] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [linkSaving, setLinkSaving] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const linkDialogRef = useRef<HTMLDialogElement>(null);

  const saveMilestoneDate = async (
    milestone: any,
    field: 'start_date' | 'target_date',
    value: string
  ) => {
    setMilestoneDates((prev) => ({
      ...prev,
      [milestone.id]: { ...prev[milestone.id], [field]: value },
    }));
    setSavingMilestone(milestone.id);
    try {
      // Empty clears the date rather than storing "", which is not a date.
      setActionError(null);
      const result = await updateProjectMilestone(milestone.id, { [field]: value || null });
      if (!result?.milestone) throw new Error('Save failed');
      setMilestones((prev) =>
        prev.map((m) => (m.id === milestone.id ? { ...m, [field]: value || null } : m))
      );
    } catch (e) {
      console.error('Failed to save milestone date', e);
      setActionError('Could not save the milestone date. Your previous date is unchanged.');
      setMilestoneDates((prev) => ({
        ...prev,
        [milestone.id]: { ...prev[milestone.id], [field]: milestone[field] ?? '' },
      }));
    } finally {
      setSavingMilestone(null);
    }
  };

  const DETAIL_FIELDS = 'id,title,status,scheduled_date,estimated_minutes,milestone_id,metadata';

  // Milestone linking state
  const [linkingTaskId, setLinkingTaskId] = useState<string | null>(null);
  const [showNewMilestone, setShowNewMilestone] = useState(false);
  const [newMilestoneName, setNewMilestoneName] = useState('');
  const [creatingMilestone, setCreatingMilestone] = useState(false);

  useEffect(() => {
    const dialog = linkDialogRef.current;
    if (!dialog) return;
    if (linkingTaskId && !dialog.open) dialog.showModal();
    if (!linkingTaskId && dialog.open) dialog.close();
  }, [linkingTaskId]);

  const closeLinkDialog = () => {
    if (linkSaving || creatingMilestone) return;
    setLinkingTaskId(null);
    setShowNewMilestone(false);
    setNewMilestoneName('');
    setLinkError(null);
  };

  const openLinkDialog = (taskId: string) => {
    setLinkError(null);
    setShowNewMilestone(false);
    setNewMilestoneName('');
    setLinkingTaskId(taskId);
  };

  const handleMilestoneStatus = async (milestone: { id: string; status: string }) => {
    if (savingMilestone) return;
    setSavingMilestone(milestone.id);
    setActionError(null);
    const status = milestone.status === 'done' ? 'in_progress' : 'done';
    try {
      const result = await updateProjectMilestone(milestone.id, { status });
      if (!result?.milestone) throw new Error('Save failed');
      setMilestones(prev => prev.map(m => m.id === milestone.id ? { ...m, ...result.milestone } : m));
    } catch {
      setActionError('Could not update the milestone. Its previous status is unchanged. Please retry.');
    } finally {
      setSavingMilestone(null);
    }
  };


  const loadData = async ({ background = false } = {}) => {
    if (!background) setLoading(true);
    try {
      // Just enough to draw the group headers, their counts and the ordering.
      // Titles and metadata arrive per group, when a group is opened.
      const [taskData, milestoneData] = await Promise.all([
        getProjectTasks(projectId, 'id,status,scheduled_date,milestone_id'),
        getProjectMilestones(projectId),
      ]);
      setTasks(taskData || []);
      setMilestones(milestoneData || []);
      setLoadedGroups(new Set());
      projectCache.set(projectId, {
        tasks: taskData || [],
        milestones: milestoneData || [],
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const cached = projectCache.get(projectId);
    if (cached) {
      // Paint what we had straight away, then quietly check for changes. The
      // detail rows are deliberately not cached: they are the expensive read,
      // and they load per group as you open it.
      setTasks(cached.tasks);
      setMilestones(cached.milestones);
      setLoadedGroups(new Set());
      setLoading(false);
      loadData({ background: true });
    } else {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Keep the cache in step with optimistic updates, so switching away and back
  // shows the tick or edit you just made rather than the state before it.
  useEffect(() => {
    if (!loading) projectCache.set(projectId, { tasks, milestones });
  }, [projectId, tasks, milestones, loading]);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
    }
  }, [editingId]);

  const handleToggle = async (taskId: string, currentDone: boolean) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: currentDone ? 'todo' : 'done' } : t));
    try {
      await updateTaskStatus(taskId, !currentDone);
    } catch (e) {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: currentDone ? 'done' : 'todo' } : t));
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    setAdding(true);
    try {
      await addTaskToProject(projectId, newTaskTitle, newTaskDate || undefined, newTaskMilestone || undefined);
      setNewTaskTitle('');
      setNewTaskDate('');
      setNewTaskMilestone('');
      await loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (task: any) => {
    setEditingId(task.id);
    setEditTitle(task.title);
    setEditDate(task.scheduled_date || '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle('');
    setEditDate('');
  };

  const saveEdit = async () => {
    if (!editingId || !editTitle.trim()) return;
    setSaving(true);
    const original = tasks.find(t => t.id === editingId);
    const updates: any = {};
    if (editTitle.trim() !== original?.title) updates.title = editTitle.trim();
    if (editDate !== (original?.scheduled_date || '')) updates.scheduled_date = editDate || null;

    if (Object.keys(updates).length === 0) {
      cancelEdit();
      setSaving(false);
      return;
    }

    setTasks(prev => prev.map(t => t.id === editingId ? { ...t, ...updates } : t));
    try {
      await updateTask(editingId, updates);
      cancelEdit();
    } catch (e) {
      setTasks(prev => prev.map(t => t.id === editingId ? original : t));
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') saveEdit();
    if (e.key === 'Escape') cancelEdit();
  };

  const handleLinkMilestone = async (taskId: string, milestoneId: string | null) => {
    if (linkSaving) return false;
    setLinkSaving(true);
    setLinkError(null);
    try {
      const saved = await linkTaskToMilestone(taskId, milestoneId);
      if (!saved) throw new Error('Save failed');
      // Keep the loaded task details; no whole-project refetch for a link.
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, milestone_id: milestoneId } : t));
      setCollapsedGroups(prev => {
        const next = new Set(prev);
        next.delete(milestoneId || '__none__');
        return next;
      });
      setLinkingTaskId(null);
      setShowNewMilestone(false);
      setNewMilestoneName('');
      return true;
    } catch {
      setLinkError('Could not link this task. Its existing milestone is unchanged. Please retry.');
      return false;
    } finally {
      setLinkSaving(false);
    }
  };

  const handleCreateAndLink = async (taskId: string) => {
    if (!newMilestoneName.trim() || creatingMilestone || linkSaving) return;
    setCreatingMilestone(true);
    setLinkError(null);
    try {
      const result = await createProjectMilestone(projectId, newMilestoneName.trim());
      if (!result?.milestone) throw new Error('Save failed');
      setMilestones(prev => [...prev, result.milestone]);
      // If linking fails, keep the created milestone as a choice for retry.
      setShowNewMilestone(false);
      setNewMilestoneName('');
      await handleLinkMilestone(taskId, result.milestone.id);
    } catch {
      setLinkError('Could not create the milestone. Please retry.');
    } finally {
      setCreatingMilestone(false);
    }
  };

  const renderMilestoneLink = (task: TableTask) => (
    <button
      type="button"
      onClick={() => openLinkDialog(task.id)}
      className="p-1.5 rounded-md text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 flex-shrink-0"
      title={task.milestone_id ? 'Change milestone' : 'Link to milestone'}
      aria-label={`${task.milestone_id ? 'Change milestone for' : 'Link to milestone for'} ${task.title || 'task'}`}
    >
      <Link size={14} />
    </button>
  );

  // The plan runs to three hundred rows, so land on the next thing to do
  // rather than at the top. Same behaviour the CSV tracker had. Earliest
  // unfinished by date, not by whatever order the API returned.
  const firstOpenId = tasks
    .filter(t => t.status !== 'done')
    .sort((a, b) => String(a.scheduled_date || '9999').localeCompare(String(b.scheduled_date || '9999')))[0]?.id;

  useEffect(() => {
    if (!loading && firstOpenRowRef.current) {
      const timer = setTimeout(
        () => firstOpenRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
        100,
      );
      return () => clearTimeout(timer);
    }
  }, [loading, firstOpenId]);

  /** Fetch the titles and metadata for one milestone, once. */
  const loadGroup = async (groupKey: string) => {
    if (loadedGroups.has(groupKey) || loadingGroup === groupKey) return;
    setLoadingGroup(groupKey);
    try {
      const rows = await getProjectTasks(
        projectId,
        DETAIL_FIELDS,
        groupKey === '__none__' ? undefined : groupKey,
      );
      const detail = new Map((rows || []).map((r: any) => [r.id, r]));
      setTasks(prev => prev.map(t => (detail.has(t.id) ? { ...t, ...detail.get(t.id) } : t)));
      setLoadedGroups(prev => new Set(prev).add(groupKey));
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingGroup(null);
    }
  };

  const toggleGroup = (groupKey: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
        loadGroup(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  };

  // Everything starts closed, and the group holding the next unfinished task
  // opens itself — which is the one being looked at anyway. Opening the rest
  // costs a small request each rather than everything up front.
  const initialOpenDone = useRef(false);
  useEffect(() => {
    if (loading || initialOpenDone.current || tasks.length === 0) return;
    initialOpenDone.current = true;
    const next = tasks
      .filter(t => t.status !== 'done')
      .sort((a, b) => String(a.scheduled_date || '9999').localeCompare(String(b.scheduled_date || '9999')))[0];
    const openKey = next?.milestone_id || '__none__';
    const closed = new Set<string>(milestones.map((m: any) => m.id));
    closed.add('__none__');
    closed.delete(openKey);
    setCollapsedGroups(closed);
    loadGroup(openKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, tasks.length, milestones.length]);

  // Group tasks by milestone
  const milestoneMap = new Map(milestones.map(m => [m.id, m]));

  let grouped: { key: string; milestone: any | null; tasks: any[] }[] = [];
  const byMilestone = new Map<string, any[]>();
  const unlinked: any[] = [];

  for (const task of tasks) {
    if (task.milestone_id && milestoneMap.has(task.milestone_id)) {
      const arr = byMilestone.get(task.milestone_id) || [];
      arr.push(task);
      byMilestone.set(task.milestone_id, arr);
    } else {
      unlinked.push(task);
    }
  }

  // Add milestone groups in milestone order
  for (const m of milestones) {
    const mTasks = byMilestone.get(m.id) || [];
    const open = mTasks.filter(t => t.status !== 'done');
    const done = mTasks.filter(t => t.status === 'done');
    grouped.push({ key: m.id, milestone: m, tasks: [...open, ...done] });
  }

  // Add unlinked group
  if (unlinked.length > 0) {
    const open = unlinked.filter(t => t.status !== 'done');
    const done = unlinked.filter(t => t.status === 'done');
    grouped.push({ key: '__none__', milestone: null, tasks: [...open, ...done] });
  }

  // A milestone with every task ticked is finished: it drops to the bottom so
  // the work still in front of you stays at the top. Stable, so the remaining
  // milestones keep their own order.
  const isGroupDone = (g: typeof grouped[number]) =>
    g.milestone ? g.milestone.status === 'done' : g.tasks.length > 0 && g.tasks.every(t => t.status === 'done');
  grouped = [...grouped.filter(g => !isGroupDone(g)), ...grouped.filter(isGroupDone)];

  // Columns a project brings with it, e.g. the study plan's Subject and
  // Source. Order of first appearance, so the table reads the way the data
  // was written rather than alphabetically.
  const metaKeysOf = (list: TableTask[]) => {
    const keys: string[] = [];
    for (const t of list) {
      for (const k of Object.keys(t.metadata || {})) {
        if (!keys.includes(k)) keys.push(k);
      }
    }
    return keys;
  };

  // Every column the project tracks becomes a table column. The one
  // exception is a column that just restates the milestone it sits under —
  // Subject reads "Linear algebra" under a milestone already called that.
  const metaColumns = (list: TableTask[], milestoneName?: string) =>
    metaKeysOf(list).filter(key => {
      if (!milestoneName) return true;
      return !list.every(t => String(t.metadata?.[key] ?? '') === milestoneName);
    });

  const dayName = (iso?: string | null) =>
    iso ? DAY_NAMES[new Date(`${iso}T00:00:00`).getDay()] : '';

  const asHours = (minutes?: number | null) => {
    if (!minutes) return '';
    const hours = minutes / 60;
    return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
  };

  const renderTaskRow = (task: TableTask, columns: string[], isFirstOpen: boolean) => {
    const isDone = task.status === 'done';
    const isEditing = editingId === task.id;

    if (isEditing) {
      return (
        <tr key={task.id} className="bg-indigo-50/40">
          <td className="px-3 py-2" />
          <td className="px-3 py-2" colSpan={4 + columns.length}>
            <div className="flex items-center gap-2">
              <input
                ref={editInputRef}
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onKeyDown={handleEditKeyDown}
                className="flex-1 p-1.5 text-sm border border-indigo-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                onKeyDown={handleEditKeyDown}
                className="p-1.5 text-xs border border-indigo-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-600 w-[130px]"
              />
              <button onClick={saveEdit} disabled={saving} className="p-1.5 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50" title="Save">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              </button>
              <button onClick={cancelEdit} className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors" title="Cancel">
                <X size={14} />
              </button>
            </div>
          </td>
        </tr>
      );
    }

    return (
      <tr
        key={task.id}
        ref={isFirstOpen ? firstOpenRowRef : null}
        className={`group transition-colors ${isDone ? 'bg-emerald-50/30 text-gray-400' : 'hover:bg-gray-50 text-gray-700'}`}
      >
        <td className="px-3 py-2 w-10 text-center">
          <input
            type="checkbox"
            checked={isDone}
            onChange={() => handleToggle(task.id, isDone)}
            className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
          />
        </td>
        <td className={`px-3 py-2 font-medium ${isDone ? 'line-through' : 'text-gray-800'}`}>
          <span className="flex items-center gap-1.5">
            {task.title}
            {renderMilestoneLink(task)}
            <button
              onClick={() => startEdit(task)}
              className="p-1 rounded-md text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 opacity-60 group-hover:opacity-100 transition-all flex-shrink-0"
              title="Edit task"
            >
              <Pencil size={12} />
            </button>
          </span>
        </td>
        <td className="px-3 py-2 whitespace-nowrap">{task.scheduled_date || ''}</td>
        <td className="px-3 py-2 whitespace-nowrap">{dayName(task.scheduled_date)}</td>
        <td className="px-3 py-2 whitespace-nowrap">{asHours(task.estimated_minutes)}</td>
        {columns.map(key => (
          <td key={key} className="px-3 py-2">{String(task.metadata?.[key] ?? '')}</td>
        ))}
      </tr>
    );
  };

  const renderTask = (task: any) => {
    const isDone = task.status === 'done';
    const isEditing = editingId === task.id;

    return (
      <li key={task.id} className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${isDone ? 'bg-gray-50' : 'hover:bg-gray-50'} group`}>
        <input
          type="checkbox"
          checked={isDone}
          onChange={() => handleToggle(task.id, isDone)}
          className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 flex-shrink-0"
        />

        {isEditing ? (
          <div className="flex-1 flex items-center gap-2 min-w-0">
            <input
              ref={editInputRef}
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={handleEditKeyDown}
              className="flex-1 p-1.5 text-sm border border-indigo-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <input
              type="date"
              value={editDate}
              onChange={(e) => setEditDate(e.target.value)}
              onKeyDown={handleEditKeyDown}
              className="p-1.5 text-xs border border-indigo-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-600 w-[130px]"
            />
            <button onClick={saveEdit} disabled={saving} className="p-1.5 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50" title="Save">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            </button>
            <button onClick={cancelEdit} className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors" title="Cancel">
              <X size={14} />
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className={`text-sm font-medium truncate ${isDone ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                  {task.title}
                </p>
                <button
                  onClick={() => startEdit(task)}
                  className="p-1 rounded-md text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 opacity-60 group-hover:opacity-100 transition-all flex-shrink-0"
                  title="Edit task"
                >
                  <Pencil size={13} />
                </button>
              </div>
              {task.scheduled_date && (
                <p className="text-xs text-gray-500 flex items-center mt-0.5">
                  <Calendar size={12} className="mr-1" />
                  {task.scheduled_date}
                </p>
              )}
            </div>

            {renderMilestoneLink(task)}
          </>
        )}
      </li>
    );
  };

  return (
    <Card className="shadow-sm border-0 rounded-xl mb-6">
      <CardHeader className="border-b bg-white rounded-t-xl px-6 py-4 flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold text-gray-800 flex items-center">
          <CheckSquare className="mr-2 text-indigo-600" size={20} />
          {widget.title || "Project Tasks"}
        </CardTitle>
        <button
          onClick={onDelete}
          className="p-2 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-full transition-colors"
          title="Remove Widget"
        >
          <X size={16} />
        </button>
      </CardHeader>
      <CardContent className="p-0">
        <div className="p-4 border-b bg-gray-50/50">
          <form onSubmit={handleAddTask} className="flex gap-2 flex-wrap">
            <input
              type="text"
              placeholder="Add a new task..."
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              className="flex-1 min-w-[180px] p-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <input
              type="date"
              value={newTaskDate}
              onChange={(e) => setNewTaskDate(e.target.value)}
              className="p-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-gray-600"
            />
            {milestones.length > 0 && (
              <select
                value={newTaskMilestone}
                onChange={(e) => setNewTaskMilestone(e.target.value)}
                className="p-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-gray-600 max-w-[160px]"
              >
                <option value="">No milestone</option>
                {milestones.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            )}
            <button
              type="submit"
              disabled={adding || !newTaskTitle.trim()}
              className="px-4 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center"
            >
              {adding ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
            </button>
          </form>
        </div>

        {actionError && <p role="alert" className="mx-4 my-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{actionError}</p>}
        <div className="max-h-[500px] overflow-y-auto p-2">
          {loading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="animate-spin text-indigo-600" size={24} />
            </div>
          ) : tasks.length === 0 && milestones.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p>No tasks found. Create one above!</p>
            </div>
          ) : grouped.length === 1 && !grouped[0].milestone ? (
            // No milestones at all — render flat like before
            <ul className="space-y-1">
              {grouped[0].tasks.map(task => renderTask(task))}
            </ul>
          ) : (
            <div className="space-y-3">
              {grouped.map(group => {
                const isCollapsed = collapsedGroups.has(group.key);
                const doneCount = group.tasks.filter(t => t.status === 'done').length;
                const totalCount = group.tasks.length;
                const isNoMilestone = !group.milestone;
                const groupDone = isNoMilestone ? totalCount > 0 && doneCount === totalCount : group.milestone.status === 'done';
                const columns = metaColumns(group.tasks, group.milestone?.name);
                const hasMeta = metaKeysOf(group.tasks).length > 0;

                return (
                  <div key={group.key} className="rounded-lg border border-gray-100 overflow-hidden">
                    {/* Separate buttons avoid nesting completion inside collapse. */}
                    <div className="flex items-center gap-2 pr-3 bg-gray-50/50">
                    <button
                      onClick={() => toggleGroup(group.key)}
                      aria-expanded={!isCollapsed}
                      className={`min-w-0 flex-1 flex items-center gap-2 px-3 py-2.5 text-left transition-colors ${
                        groupDone
                          ? 'bg-emerald-50/70 hover:bg-emerald-50'
                          : isNoMilestone ? 'bg-amber-50/60 hover:bg-amber-50' : 'bg-indigo-50/60 hover:bg-indigo-50'
                      }`}
                    >
                      {isCollapsed ? <ChevronRight size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                      {groupDone ? (
                        <CheckCircle2 size={15} className="text-emerald-600" />
                      ) : (
                        <Milestone size={15} className={isNoMilestone ? 'text-amber-500' : 'text-indigo-500'} />
                      )}
                      <span className={`text-sm font-semibold flex-1 truncate ${
                        groupDone
                          ? 'text-emerald-700'
                          : isNoMilestone ? 'text-amber-700' : 'text-indigo-700'
                      }`}>
                        {isNoMilestone ? 'No Milestone' : group.milestone.name}
                      </span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        groupDone
                          ? 'bg-emerald-100 text-emerald-700'
                          : isNoMilestone ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'
                      }`}>
                        {doneCount}/{totalCount}
                      </span>
                      {group.milestone?.target_date && (
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Calendar size={11} />
                          {group.milestone.target_date}
                        </span>
                      )}
                    </button>
                    {!isNoMilestone && (
                      <button
                        type="button"
                        onClick={() => handleMilestoneStatus(group.milestone)}
                        disabled={savingMilestone !== null}
                        aria-label={`${groupDone ? 'Reopen' : 'Mark complete'} milestone ${group.milestone.name}`}
                        title="Changes milestone status only; linked task statuses stay unchanged"
                        className="flex-shrink-0 flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-indigo-50 disabled:opacity-50"
                      >
                        {savingMilestone === group.milestone.id ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                        {groupDone ? 'Reopen' : 'Mark complete'}
                      </button>
                    )}
                    </div>

                    {/* Milestone dates. Health rates progress against how much
                        of the schedule has gone, so an explicit start matters:
                        without one it falls back to the earliest task, which
                        moves every time a task is rescheduled. */}
                    {!isCollapsed && !isNoMilestone && (
                      <div className="flex flex-wrap items-center gap-3 px-3 py-2 border-b border-gray-100 bg-white text-xs text-gray-500">
                        <Calendar size={12} className="text-gray-400 flex-shrink-0" />
                        <label className="flex items-center gap-1.5">
                          <span>Start</span>
                          <input
                            type="date"
                            value={milestoneDates[group.milestone.id]?.start_date ?? group.milestone.start_date ?? ''}
                            onChange={(e) => saveMilestoneDate(group.milestone, 'start_date', e.target.value)}
                            className="border border-gray-200 rounded-md px-1.5 py-0.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                          />
                        </label>
                        <span className="text-gray-300">→</span>
                        <label className="flex items-center gap-1.5">
                          <span>Target</span>
                          <input
                            type="date"
                            value={milestoneDates[group.milestone.id]?.target_date ?? group.milestone.target_date ?? ''}
                            onChange={(e) => saveMilestoneDate(group.milestone, 'target_date', e.target.value)}
                            className="border border-gray-200 rounded-md px-1.5 py-0.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                          />
                        </label>
                        {savingMilestone === group.milestone.id && (
                          <Loader2 size={12} className="animate-spin text-gray-400" />
                        )}
                        {!group.milestone.start_date && !milestoneDates[group.milestone.id]?.start_date && (
                          <span className="text-gray-400 italic">using earliest task</span>
                        )}
                      </div>
                    )}

                    {/* Tasks */}
                    {!isCollapsed && (
                      group.tasks.length === 0 ? <p className="px-3 py-4 text-sm text-gray-500">No linked tasks yet. You can still mark this milestone complete.</p> : hasMeta ? (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm text-left">
                            <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                              <tr>
                                <th className="px-3 py-2 w-10 text-center"><CheckSquare size={14} className="text-gray-400 inline" /></th>
                                <th className="px-3 py-2 font-semibold">Task</th>
                                <th className="px-3 py-2 font-semibold whitespace-nowrap">Date</th>
                                <th className="px-3 py-2 font-semibold whitespace-nowrap">Day</th>
                                <th className="px-3 py-2 font-semibold whitespace-nowrap">Hours</th>
                                {columns.map(key => (
                                  <th key={key} className="px-3 py-2 font-semibold whitespace-nowrap">{key}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {[...group.tasks]
                                .sort((a, b) => String(a.scheduled_date || '9999').localeCompare(String(b.scheduled_date || '9999')))
                                .map(task => renderTaskRow(task, columns, task.id === firstOpenId))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <ul className="space-y-0.5 p-1">
                          {group.tasks.map(task => renderTask(task))}
                        </ul>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
      <dialog
        ref={linkDialogRef}
        aria-labelledby="milestone-link-title"
        aria-describedby="milestone-link-description"
        onCancel={event => { event.preventDefault(); closeLinkDialog(); }}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] max-h-[min(36rem,calc(100dvh-2rem))] overflow-y-auto rounded-xl border border-gray-200 bg-white p-5 text-gray-800 shadow-xl backdrop:bg-black/40"
      >
        <h2 id="milestone-link-title" className="text-lg font-semibold">Link to milestone</h2>
        <p id="milestone-link-description" className="mt-1 mb-4 text-sm text-gray-500">{tasks.find(t => t.id === linkingTaskId)?.title || 'Choose a milestone for this task'}</p>
        {linkError && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{linkError}</p>}
        <div className="space-y-1">
          {milestones.map(m => (
            <button key={m.id} type="button" disabled={linkSaving || creatingMilestone}
              onClick={() => linkingTaskId && handleLinkMilestone(linkingTaskId, m.id)}
              className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-indigo-50 disabled:opacity-50">
              <span>{m.name}{m.status === 'done' && <span className="ml-2 text-xs text-emerald-700">Complete</span>}</span>
              {tasks.find(t => t.id === linkingTaskId)?.milestone_id === m.id && <Check size={15} />}
            </button>
          ))}
          {tasks.find(t => t.id === linkingTaskId)?.milestone_id && (
            <button type="button" disabled={linkSaving || creatingMilestone} onClick={() => linkingTaskId && handleLinkMilestone(linkingTaskId, null)} className="w-full rounded-lg px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50">Remove milestone link</button>
          )}
        </div>
        <div className="mt-3 border-t border-gray-100 pt-3">
          {showNewMilestone ? (
            <form onSubmit={event => { event.preventDefault(); if (linkingTaskId) handleCreateAndLink(linkingTaskId); }} className="flex gap-2">
              <input type="text" value={newMilestoneName} onChange={event => setNewMilestoneName(event.target.value)} autoFocus aria-label="New milestone name" placeholder="Milestone name…" className="min-w-0 flex-1 rounded-lg border border-gray-200 p-2 text-sm" disabled={creatingMilestone || linkSaving} />
              <button type="submit" disabled={creatingMilestone || linkSaving || !newMilestoneName.trim()} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white disabled:opacity-50">{creatingMilestone ? 'Creating…' : 'Create & link'}</button>
            </form>
          ) : <button type="button" onClick={() => setShowNewMilestone(true)} disabled={linkSaving || creatingMilestone} className="flex items-center gap-2 rounded-lg p-2 text-sm text-indigo-600 hover:bg-indigo-50 disabled:opacity-50"><PlusCircle size={15} />New milestone</button>}
        </div>
        <div className="mt-4 flex items-center justify-between">
          <span role="status" className="text-sm text-gray-500">{linkSaving ? 'Saving link…' : ''}</span>
          <button type="button" onClick={closeLinkDialog} disabled={linkSaving || creatingMilestone} className="rounded-lg border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50">Cancel</button>
        </div>
      </dialog>
    </Card>
  );
}
