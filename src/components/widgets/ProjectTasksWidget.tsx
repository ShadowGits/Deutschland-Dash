"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckSquare, X, Plus, Loader2, Calendar, Pencil, Check, Milestone, ChevronDown, ChevronRight, Link, PlusCircle } from 'lucide-react';
import { getProjectTasks, addTaskToProject, updateTaskStatus, updateTask, getProjectMilestones, createProjectMilestone, linkTaskToMilestone } from '@/app/actions';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Only the fields the table reads; the widget still passes whole task rows. */
interface TableTask {
  id: string;
  title: string;
  status: string;
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

  // Milestone linking state
  const [linkingTaskId, setLinkingTaskId] = useState<string | null>(null);
  const [showNewMilestone, setShowNewMilestone] = useState(false);
  const [newMilestoneName, setNewMilestoneName] = useState('');
  const [creatingMilestone, setCreatingMilestone] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [taskData, milestoneData] = await Promise.all([
        // Exactly the columns rendered below. Dropping notes and the tenant
        // and timestamp columns roughly halves this for a big project.
        getProjectTasks(projectId, 'id,title,status,scheduled_date,estimated_minutes,milestone_id,metadata'),
        getProjectMilestones(projectId),
      ]);
      setTasks(taskData || []);
      setMilestones(milestoneData || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [projectId]);

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

  const handleLinkMilestone = async (taskId: string, milestoneId: string) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, milestone_id: milestoneId } : t));
    setLinkingTaskId(null);
    try {
      await linkTaskToMilestone(taskId, milestoneId);
    } catch (e) {
      console.error(e);
      await loadData();
    }
  };

  const handleCreateAndLink = async (taskId: string) => {
    if (!newMilestoneName.trim()) return;
    setCreatingMilestone(true);
    try {
      const result = await createProjectMilestone(projectId, newMilestoneName.trim());
      if (result?.milestone) {
        setMilestones(prev => [...prev, result.milestone]);
        await handleLinkMilestone(taskId, result.milestone.id);
      }
      setNewMilestoneName('');
      setShowNewMilestone(false);
    } catch (e) {
      console.error(e);
    } finally {
      setCreatingMilestone(false);
    }
  };

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

  const toggleGroup = (groupKey: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  };

  // Group tasks by milestone
  const milestoneMap = new Map(milestones.map(m => [m.id, m]));

  const grouped: { key: string; milestone: any | null; tasks: any[] }[] = [];
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
    const mTasks = byMilestone.get(m.id);
    if (mTasks && mTasks.length > 0) {
      const open = mTasks.filter(t => t.status !== 'done');
      const done = mTasks.filter(t => t.status === 'done');
      grouped.push({ key: m.id, milestone: m, tasks: [...open, ...done] });
    }
  }

  // Add unlinked group
  if (unlinked.length > 0) {
    const open = unlinked.filter(t => t.status !== 'done');
    const done = unlinked.filter(t => t.status === 'done');
    grouped.push({ key: '__none__', milestone: null, tasks: [...open, ...done] });
  }

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
            <button
              onClick={() => startEdit(task)}
              className="p-1 rounded-md text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
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

  const renderTask = (task: any, showMilestoneLink: boolean) => {
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
                  className="p-1 rounded-md text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
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

            {/* Milestone link button for unlinked tasks */}
            {showMilestoneLink && !isDone && (
              <div className="relative flex-shrink-0">
                {linkingTaskId === task.id ? (
                  <div className="absolute right-0 top-full mt-1 z-20 bg-white rounded-lg shadow-lg border border-gray-200 p-2 w-56">
                    <p className="text-xs font-medium text-gray-500 mb-1.5 px-1">Link to milestone</p>
                    {milestones.map(m => (
                      <button
                        key={m.id}
                        onClick={() => handleLinkMilestone(task.id, m.id)}
                        className="w-full text-left px-2 py-1.5 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-md transition-colors truncate"
                      >
                        {m.name}
                      </button>
                    ))}
                    <div className="border-t border-gray-100 mt-1.5 pt-1.5">
                      {showNewMilestone ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={newMilestoneName}
                            onChange={(e) => setNewMilestoneName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleCreateAndLink(task.id); if (e.key === 'Escape') { setShowNewMilestone(false); setNewMilestoneName(''); } }}
                            placeholder="Milestone name..."
                            className="flex-1 p-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            autoFocus
                          />
                          <button
                            onClick={() => handleCreateAndLink(task.id)}
                            disabled={creatingMilestone || !newMilestoneName.trim()}
                            className="p-1.5 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 flex-shrink-0"
                          >
                            {creatingMilestone ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowNewMilestone(true)}
                          className="w-full text-left px-2 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors flex items-center gap-1.5"
                        >
                          <PlusCircle size={14} />
                          New milestone
                        </button>
                      )}
                    </div>
                    <button
                      onClick={() => { setLinkingTaskId(null); setShowNewMilestone(false); setNewMilestoneName(''); }}
                      className="w-full text-center text-xs text-gray-400 hover:text-gray-600 mt-1.5 py-1"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setLinkingTaskId(task.id)}
                    className="p-1 rounded-md text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 opacity-0 group-hover:opacity-100 transition-all"
                    title="Link to milestone"
                  >
                    <Link size={13} />
                  </button>
                )}
              </div>
            )}
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

        <div className="max-h-[500px] overflow-y-auto p-2">
          {loading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="animate-spin text-indigo-600" size={24} />
            </div>
          ) : tasks.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p>No tasks found. Create one above!</p>
            </div>
          ) : grouped.length === 1 && !grouped[0].milestone ? (
            // No milestones at all — render flat like before
            <ul className="space-y-1">
              {grouped[0].tasks.map(task => renderTask(task, false))}
            </ul>
          ) : (
            <div className="space-y-3">
              {grouped.map(group => {
                const isCollapsed = collapsedGroups.has(group.key);
                const doneCount = group.tasks.filter(t => t.status === 'done').length;
                const totalCount = group.tasks.length;
                const isNoMilestone = !group.milestone;
                const columns = metaColumns(group.tasks, group.milestone?.name);
                const hasMeta = metaKeysOf(group.tasks).length > 0;

                return (
                  <div key={group.key} className="rounded-lg border border-gray-100 overflow-hidden">
                    {/* Group header */}
                    <button
                      onClick={() => toggleGroup(group.key)}
                      className={`w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors ${
                        isNoMilestone ? 'bg-amber-50/60 hover:bg-amber-50' : 'bg-indigo-50/60 hover:bg-indigo-50'
                      }`}
                    >
                      {isCollapsed ? <ChevronRight size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                      <Milestone size={15} className={isNoMilestone ? 'text-amber-500' : 'text-indigo-500'} />
                      <span className={`text-sm font-semibold flex-1 truncate ${isNoMilestone ? 'text-amber-700' : 'text-indigo-700'}`}>
                        {isNoMilestone ? 'No Milestone' : group.milestone.name}
                      </span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        doneCount === totalCount
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

                    {/* Tasks */}
                    {!isCollapsed && (
                      hasMeta ? (
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
                          {group.tasks.map(task => renderTask(task, isNoMilestone))}
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
    </Card>
  );
}
