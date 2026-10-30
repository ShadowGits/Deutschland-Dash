'use client';

import { useState } from 'react';
import { AlertTriangle, CalendarDays, ChevronDown, ChevronUp, Sun, X } from 'lucide-react';
import TaskCard from '@/components/focus/TaskCard';
import WeekGrid from '@/components/focus/WeekGrid';
import MilestoneTimeline from '@/components/focus/MilestoneTimeline';
import {
  updateTaskStatus,
  triageTasksAction,
  getWeekAction,
  deleteMilestoneAction,
  updateProjectMilestone,
} from '@/app/actions';
import {
  addDays,
  dayName,
  daysBetween,
  estimate,
  minutesLabel,
  MILESTONE_SOON_DAYS,
  rankOverdue,
  shortDate,
  quickMoveDates,
  todaysTasks,
  weekdayIndex,
  type FocusTask,
  type InboxData,
  type MilestoneRow,
  type OverdueReason,
  type ProjectRef,
  type WeekData,
} from '@/lib/focus';

interface FocusBoardProps {
  inbox: InboxData | null;
  weekData: WeekData | null;
  metrics: { milestone_health?: MilestoneRow[] } | null;
  projects: ProjectRef[];
}

// Enough to see what is most pressing without the whole backlog at once;
// nine fills the three-column layout evenly.
const OVERDUE_PREVIEW = 9;

const GROUPS: { reason: OverdueReason; title: string; hint: string }[] = [
  { reason: 'deadline', title: 'Past deadline', hint: 'The due date has gone.' },
  { reason: 'missed_slot', title: 'Missed slot', hint: 'It was planned for a time that has passed.' },
  { reason: 'unplanned', title: 'Never scheduled', hint: 'No date at all.' },
];

function localToday(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

export default function FocusBoard({ inbox, weekData, metrics, projects }: FocusBoardProps) {
  // The server's date, in the workspace's zone, so "today" and "overdue" agree
  // with the planner rather than with whichever browser is looking.
  const today = inbox?.date ?? localToday();

  // Acting on a task hides it at once; the page refreshes behind it and the
  // fresh data no longer contains it anyway.
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [confirmDrop, setConfirmDrop] = useState(false);
  const [customDate, setCustomDate] = useState('');

  // The week shown in the grid. null means "the current week, from the page",
  // so a refresh after any change keeps it current without extra fetching.
  const [otherWeek, setOtherWeek] = useState<WeekData | null>(null);
  const [loadingWeek, setLoadingWeek] = useState(false);
  const [doneOverride, setDoneOverride] = useState<Map<string, boolean>>(new Map());
  const [deletedMilestones, setDeletedMilestones] = useState<Set<string>>(new Set());

  const milestoneRows = (metrics?.milestone_health || []).filter((m) => !deletedMilestones.has(m.milestone_id));
  const milestones = new Map<string, MilestoneRow>(milestoneRows.map((m) => [m.milestone_id, m]));
  const projectNames = new Map<string, string>((projects || []).map((p) => [String(p.id), p.name]));

  const inboxItems: FocusTask[] = (inbox?.items || []).filter((t) => !hidden.has(t.id));
  const overdue = rankOverdue(inboxItems.filter((t) => t.overdue), milestones, today);
  const currentWeekItems = (weekData?.items || []).filter((t) => !hidden.has(t.id));
  const todayList = todaysTasks(inboxItems, currentWeekItems, today);
  const overdueMinutes = overdue.reduce((n, t) => n + estimate(t), 0);

  const shownWeek = otherWeek ?? weekData;
  const weekItems = (shownWeek?.items || [])
    .filter((t) => !hidden.has(t.id))
    .map((t) => (doneOverride.has(t.id) ? { ...t, done: doneOverride.get(t.id) } : t));
  const weekStart = shownWeek?.week_start ?? addDays(today, -weekdayIndex(today));

  const contextFor = (task: FocusTask) => {
    const milestone = task.milestone_id ? milestones.get(task.milestone_id) : undefined;
    if (milestone) return milestone.name;
    return task.project_id ? projectNames.get(task.project_id) ?? null : null;
  };
  const soonFor = (task: FocusTask) => {
    const target = task.milestone_id ? milestones.get(task.milestone_id)?.target_date : null;
    if (!target) return null;
    const days = daysBetween(today, target);
    if (days < 0 || days > MILESTONE_SOON_DAYS) return null;
    return days === 0 ? 'milestone due today' : `milestone in ${days}d`;
  };

  const markBusy = (ids: string[], on: boolean) =>
    setBusy((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
      return next;
    });
  const hide = (ids: string[]) => {
    setHidden((prev) => new Set([...prev, ...ids]));
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
  };

  const run = async (ids: string[], work: () => Promise<string | null>) => {
    if (!ids.length || ids.some((id) => busy.has(id))) return;
    markBusy(ids, true);
    setNotice(null);
    try {
      const message = await work();
      if (message === null) {
        setNotice({ kind: 'error', text: 'That did not save. Nothing was changed — please try again.' });
      } else {
        hide(ids);
        setNotice({ kind: 'ok', text: message });
      }
    } catch {
      setNotice({ kind: 'error', text: 'That did not save. Nothing was changed — please try again.' });
    } finally {
      markBusy(ids, false);
    }
  };

  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

  const moveTo = (ids: string[], date: string) =>
    run(ids, async () => {
      const res = await triageTasksAction(ids, 'move', date);
      if (!res) return null;
      const moved = res.deadline_moved.length;
      const label = date === today ? 'today' : `${dayName(date)} ${shortDate(date)}`;
      // A milestone a task was moved past now ends with its last task; say so,
      // since its date changed without being touched directly.
      const extended = (res.milestones_extended || []).map(
        (m) => `"${m.name}" now due ${shortDate(m.to)} (was ${shortDate(m.from)})`
      );
      return `Moved ${plural(res.updated.length, 'task')} to ${label}, untimed${
        moved ? ` · ${plural(moved, 'past deadline')} moved with them` : ''
      }.${extended.length ? ` Milestone ${extended.join('; ')}.` : ''}`;
    });

  const drop = (ids: string[]) =>
    run(ids, async () => {
      const res = await triageTasksAction(ids, 'drop');
      if (!res) return null;
      return `Dropped ${plural(res.updated.length, 'task')} (kept as skipped, not deleted).`;
    });

  const done = (task: FocusTask) =>
    run([task.id], async () => ((await updateTaskStatus(task.id, true)) ? `Done: ${task.title}` : null));

  const tomorrow = addDays(today, 1);
  const quickDates = quickMoveDates(today);

  const goToWeek = async (anchor: string) => {
    setLoadingWeek(true);
    try {
      const data = await getWeekAction(anchor);
      if (data) setOtherWeek(data.week_start === weekData?.week_start ? null : data);
    } finally {
      setLoadingWeek(false);
    }
  };

  const toggleWeekTask = async (task: FocusTask) => {
    const next = !task.done;
    setDoneOverride((prev) => new Map(prev).set(task.id, next));
    const ok = await updateTaskStatus(task.id, next).catch(() => false);
    if (!ok) {
      setDoneOverride((prev) => {
        const out = new Map(prev);
        out.delete(task.id);
        return out;
      });
      setNotice({ kind: 'error', text: `Could not update "${task.title}". It is unchanged.` });
    }
  };

  const deleteMilestone = async (row: MilestoneRow) => {
    const res = await deleteMilestoneAction(row.milestone_id).catch(() => null);
    if (!res) {
      setNotice({ kind: 'error', text: `Could not delete "${row.name}". It is unchanged.` });
      return false;
    }
    setDeletedMilestones((prev) => new Set(prev).add(row.milestone_id));
    setNotice({
      kind: 'ok',
      text: `Deleted milestone "${row.name}". Its ${plural(res.tasks_unlinked, 'task')} ${
        res.tasks_unlinked === 1 ? 'was' : 'were'
      } kept, now without a milestone.`,
    });
    return true;
  };

  const completeMilestone = async (row: MilestoneRow) => {
    const res = await updateProjectMilestone(row.milestone_id, { status: 'done' }).catch(() => null);
    if (!res?.milestone) {
      setNotice({ kind: 'error', text: `Could not complete "${row.name}". It is unchanged.` });
      return false;
    }
    setDeletedMilestones((prev) => new Set(prev).add(row.milestone_id));
    setNotice({ kind: 'ok', text: `Marked "${row.name}" complete.` });
    return true;
  };

  const selectedIds = [...selected].filter((id) => overdue.some((t) => t.id === id));
  const selectedMinutes = overdue.filter((t) => selected.has(t.id)).reduce((n, t) => n + estimate(t), 0);
  const toggleSelect = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const setGroupSelected = (ids: string[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
      return next;
    });

  const renderCard = (task: FocusTask, selectable: boolean) => (
    <TaskCard
      key={task.id}
      task={task}
      today={today}
      context={contextFor(task)}
      contextSoon={soonFor(task)}
      busy={busy.has(task.id)}
      selectable={selectable}
      selected={selected.has(task.id)}
      onSelect={(on) => toggleSelect(task.id, on)}
      onDone={() => done(task)}
      onTomorrow={() => moveTo([task.id], tomorrow)}
      onPickDate={(day) => moveTo([task.id], day)}
      onDrop={() => drop([task.id])}
    />
  );

  return (
    <div className="space-y-6 pb-28">
      {notice && (
        <div
          role={notice.kind === 'error' ? 'alert' : 'status'}
          className={`flex items-start justify-between gap-3 rounded-lg px-4 py-3 text-sm ${
            notice.kind === 'error' ? 'bg-red-50 text-red-800' : 'bg-emerald-50 text-emerald-800'
          }`}
        >
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss" className="opacity-60 hover:opacity-100">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Overdue */}
      <section className="rounded-xl border border-red-100 bg-white shadow-sm">
        <header className="flex flex-wrap items-end justify-between gap-3 border-b border-red-100 px-5 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-800">
              <AlertTriangle size={20} className="text-red-500" />
              Overdue
              {inbox && (
                <span className="text-red-600">
                  {overdue.length}
                  <span className="ml-2 text-sm font-medium text-gray-500">≈ {minutesLabel(overdueMinutes)} of work</span>
                </span>
              )}
            </h2>
            <p className="text-xs text-gray-500">
              Starred and high-priority first, then broken deadlines, then work for milestones due within two weeks,
              then oldest first. Tick cards to move or drop several at once.
            </p>
          </div>
          {overdue.length > OVERDUE_PREVIEW && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {showAll ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              {showAll ? `Show top ${OVERDUE_PREVIEW}` : `Show all ${overdue.length}, grouped`}
            </button>
          )}
        </header>

        <div className="p-5">
          {!inbox ? (
            <p className="text-sm text-red-700">Could not load overdue tasks from Planner OS. Refresh to try again.</p>
          ) : overdue.length === 0 ? (
            <p className="text-sm text-gray-500">Nothing overdue. 🎉</p>
          ) : !showAll ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {overdue.slice(0, OVERDUE_PREVIEW).map((t) => renderCard(t, true))}
            </div>
          ) : (
            <div className="space-y-6">
              {GROUPS.map((group) => {
                const tasks = overdue.filter((t) => (t.overdue_reason ?? 'unplanned') === group.reason);
                if (!tasks.length) return null;
                const ids = tasks.map((t) => t.id);
                const allOn = ids.every((id) => selected.has(id));
                return (
                  <div key={group.reason}>
                    <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="text-sm font-semibold text-gray-800">
                        {group.title} <span className="text-gray-400">· {tasks.length}</span>
                        <span className="ml-2 text-xs font-normal text-gray-500">{group.hint}</span>
                      </h3>
                      <button
                        type="button"
                        onClick={() => setGroupSelected(ids, !allOn)}
                        className="text-xs font-medium text-indigo-600 hover:underline"
                      >
                        {allOn ? 'Unselect all' : `Select all ${tasks.length}`}
                      </button>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                      {tasks.map((t) => renderCard(t, true))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Today */}
      <section className="rounded-xl bg-white shadow-sm">
        <header className="border-b px-5 py-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-800">
            <Sun size={20} className="text-amber-500" />
            Today
            <span className="text-sm font-medium text-gray-500">
              {dayName(today)} {shortDate(today)} · {todayList.length} left
              {todayList.length > 0 && ` · ≈ ${minutesLabel(todayList.reduce((n, t) => n + estimate(t), 0))}`}
            </span>
          </h2>
        </header>
        <div className="p-5">
          {todayList.length === 0 ? (
            <p className="text-sm text-gray-500">Nothing left planned for today.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {todayList.map((t) => renderCard(t, false))}
            </div>
          )}
        </div>
      </section>

      <WeekGrid
        items={weekItems}
        weekStart={weekStart}
        today={today}
        milestones={milestones}
        projectNames={projectNames}
        loading={loadingWeek}
        onPrev={() => goToWeek(addDays(weekStart, -7))}
        onNext={() => goToWeek(addDays(weekStart, 7))}
        onThisWeek={() => setOtherWeek(null)}
        onToggle={toggleWeekTask}
      />

      <MilestoneTimeline
        milestones={milestoneRows}
        today={today}
        onDelete={deleteMilestone}
        onComplete={completeMilestone}
      />

      {/* Bulk triage bar */}
      {selectedIds.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-indigo-200 bg-white/95 px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] backdrop-blur md:left-64">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 text-sm">
            <span className="mr-1 font-semibold text-gray-800">
              {selectedIds.length} selected
              <span className="ml-1 font-normal text-gray-500">≈ {minutesLabel(selectedMinutes)}</span>
            </span>
            {confirmDrop ? (
              <>
                <span className="text-gray-700">
                  Drop {plural(selectedIds.length, 'task')}? They are kept as skipped, not deleted.
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmDrop(false);
                    drop(selectedIds);
                  }}
                  className="rounded-md bg-red-600 px-3 py-1.5 font-semibold text-white hover:bg-red-700"
                >
                  Drop
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDrop(false)}
                  className="rounded-md border border-gray-200 px-3 py-1.5 font-medium text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <span className="flex items-center gap-1 text-gray-500">
                  <CalendarDays size={15} /> Move to
                </span>
                {quickDates.map((q) => (
                  <button
                    key={q.date}
                    type="button"
                    onClick={() => moveTo(selectedIds, q.date)}
                    className="rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 font-medium text-indigo-700 hover:bg-indigo-100"
                  >
                    {q.label}
                  </button>
                ))}
                <span className="flex items-center gap-1">
                  <input
                    type="date"
                    value={customDate}
                    min={today}
                    onChange={(e) => setCustomDate(e.target.value)}
                    aria-label="Move to another date"
                    className="rounded-md border border-gray-200 px-2 py-1 text-sm text-gray-700"
                  />
                  <button
                    type="button"
                    disabled={!customDate || customDate < today}
                    onClick={() => moveTo(selectedIds, customDate)}
                    className="rounded-md border border-indigo-200 px-2.5 py-1.5 font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-40"
                  >
                    Go
                  </button>
                </span>
                <span className="mx-1 h-5 w-px bg-gray-200" />
                <button
                  type="button"
                  onClick={() => setConfirmDrop(true)}
                  className="rounded-md border border-gray-200 px-2.5 py-1.5 font-medium text-gray-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                >
                  Drop
                </button>
                <button
                  type="button"
                  onClick={() => setSelected(new Set())}
                  className="ml-auto text-xs font-medium text-gray-500 hover:text-gray-800"
                >
                  Clear selection
                </button>
              </>
            )}
            <p className="basis-full text-xs text-gray-400">
              Moved tasks land untimed on that day, ready to slot into the day planner. A deadline that has already passed moves with them.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
