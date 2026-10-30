// Pure logic behind the Focus board: what counts as overdue, how it is ranked,
// how a week is laid out in milestone rows and where a milestone sits on the
// timeline. Kept free of React so it can be checked on its own.

export type OverdueReason = 'deadline' | 'missed_slot' | 'unplanned';

export interface FocusTask {
  id: string;
  title: string;
  status?: string;
  done?: boolean;
  start_time?: string | null;
  estimated_minutes?: number | null;
  priority?: string | null;
  due_date?: string | null;
  scheduled_date?: string | null;
  project_id?: string | null;
  milestone_id?: string | null;
  starred?: boolean;
  is_habit?: boolean;
  overdue?: boolean;
  overdue_reason?: OverdueReason;
}

export interface MilestoneRow {
  milestone_id: string;
  name: string;
  project_id?: string | null;
  project_name?: string | null;
  start_date?: string | null;
  target_date?: string | null;
  done: number;
  total: number;
  progress: number;
  elapsed?: number | null;
  days_left?: number | null;
  status: 'overdue' | 'red' | 'amber' | 'green' | 'no_date' | 'complete';
}

export interface InboxData {
  date: string;
  items: FocusTask[];
  timezone?: string;
}

const DAY_MS = 86_400_000;

/** Whole days from a to b, both YYYY-MM-DD, independent of the browser's zone. */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / DAY_MS);
}

export function addDays(iso: string, days: number): string {
  return new Date(Date.parse(iso + 'T00:00:00Z') + days * DAY_MS).toISOString().slice(0, 10);
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayIndex(iso: string): number {
  return (new Date(iso + 'T00:00:00Z').getUTCDay() + 6) % 7;
}

export function shortDate(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

export function dayName(iso: string): string {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' });
}

export const isPinned = (task: FocusTask) => !!task.starred || task.priority === 'high';

// A milestone this close makes its tasks matter more than their age does.
export const MILESTONE_SOON_DAYS = 14;

const REASON_ORDER: Record<OverdueReason, number> = { deadline: 0, missed_slot: 1, unplanned: 2 };

/** The date a task went wrong on: its deadline if that passed, else its slot. */
export function overdueSince(task: FocusTask): string | null {
  if (task.overdue_reason === 'deadline') return task.due_date ?? null;
  return task.scheduled_date ?? task.due_date ?? null;
}

/**
 * Overdue tasks, most pressing first.
 *
 * Priority alone cannot order this list — nearly everything is "medium" — so
 * the ranking leans on dates instead: starred and high-priority work first,
 * then broken deadlines before missed slots before never-scheduled, then work
 * feeding a milestone due within two weeks, then oldest first.
 */
export function rankOverdue(
  tasks: FocusTask[],
  milestones: Map<string, MilestoneRow>,
  today: string,
): FocusTask[] {
  const soon = (task: FocusTask) => {
    const target = task.milestone_id ? milestones.get(task.milestone_id)?.target_date : null;
    if (!target) return Number.POSITIVE_INFINITY;
    const days = daysBetween(today, target);
    return days >= 0 && days <= MILESTONE_SOON_DAYS ? days : Number.POSITIVE_INFINITY;
  };
  return [...tasks].sort((a, b) => {
    const pinned = Number(isPinned(b)) - Number(isPinned(a));
    if (pinned) return pinned;
    const reason =
      REASON_ORDER[a.overdue_reason ?? 'unplanned'] - REASON_ORDER[b.overdue_reason ?? 'unplanned'];
    if (reason) return reason;
    const soonA = soon(a);
    const soonB = soon(b);
    if (soonA !== soonB) return soonA < soonB ? -1 : 1;
    const since = (overdueSince(a) ?? '9999-12-31').localeCompare(overdueSince(b) ?? '9999-12-31');
    if (since) return since;
    return a.title.localeCompare(b.title);
  });
}

/** How late a task is, in words that fit on a card. */
export function lateness(task: FocusTask, today: string): string {
  if (task.overdue_reason === 'unplanned') return 'Never scheduled';
  const since = overdueSince(task);
  if (!since) return 'Overdue';
  const days = daysBetween(since, today);
  if (task.overdue_reason === 'missed_slot') {
    const time = task.start_time ? ` ${task.start_time.slice(0, 5)}` : '';
    return days <= 0 ? `Missed today${time}` : `Missed ${dayName(since)} ${shortDate(since)}${time}`;
  }
  return days <= 0 ? 'Due today' : `${days}d late`;
}

export function minutesLabel(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = minutes / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)}h`;
}

export const estimate = (task: FocusTask) => task.estimated_minutes || 30;

/**
 * What is left for today: untimed work the inbox holds for today plus today's
 * planned tasks, minus anything already counted as overdue. Habits belong to
 * the day planner, not here.
 */
export function todaysTasks(inbox: FocusTask[], week: FocusTask[], today: string): FocusTask[] {
  const overdueIds = new Set(inbox.filter((t) => t.overdue).map((t) => t.id));
  const seen = new Set<string>();
  const out: FocusTask[] = [];
  const add = (task: FocusTask) => {
    if (seen.has(task.id) || overdueIds.has(task.id) || task.is_habit || task.done) return;
    seen.add(task.id);
    out.push(task);
  };
  inbox.filter((t) => !t.overdue).forEach(add);
  week
    .filter((t) => (t.scheduled_date ?? t.due_date) === today)
    .forEach(add);
  return out.sort((a, b) => {
    if (a.start_time && b.start_time) return a.start_time.localeCompare(b.start_time);
    if (a.start_time) return -1;
    if (b.start_time) return 1;
    return Number(isPinned(b)) - Number(isPinned(a)) || a.title.localeCompare(b.title);
  });
}

export interface WeekRow {
  key: string;
  label: string;
  sublabel?: string | null;
  milestone?: MilestoneRow;
  cells: FocusTask[][]; // seven columns, Monday first
  count: number;
}

/**
 * The week as a grid: one row per milestone (or per project for tasks with no
 * milestone), one column per day. Rows are ordered by the milestone's target
 * date so whatever is due soonest sits at the top.
 */
export function weekRows(
  items: FocusTask[],
  weekStart: string,
  milestones: Map<string, MilestoneRow>,
  projectNames: Map<string, string>,
): WeekRow[] {
  const rows = new Map<string, WeekRow>();
  for (const task of items) {
    if (task.is_habit) continue;
    const day = task.scheduled_date ?? task.due_date;
    if (!day) continue;
    const column = daysBetween(weekStart, day);
    if (column < 0 || column > 6) continue;

    const milestone = task.milestone_id ? milestones.get(task.milestone_id) : undefined;
    let key: string;
    let label: string;
    let sublabel: string | null | undefined;
    if (task.milestone_id) {
      key = `m:${task.milestone_id}`;
      label = milestone?.name ?? 'Milestone';
      sublabel = milestone?.project_name ?? (task.project_id ? projectNames.get(task.project_id) : null);
    } else if (task.project_id) {
      key = `p:${task.project_id}`;
      label = projectNames.get(task.project_id) ?? 'Project';
      sublabel = 'No milestone';
    } else {
      key = 'none';
      label = 'Other';
      sublabel = 'No project';
    }
    let row = rows.get(key);
    if (!row) {
      row = { key, label, sublabel, milestone, cells: [[], [], [], [], [], [], []], count: 0 };
      rows.set(key, row);
    }
    row.cells[column].push(task);
    row.count += 1;
  }
  for (const row of rows.values()) {
    for (const cell of row.cells) {
      cell.sort((a, b) => (a.start_time ?? '99').localeCompare(b.start_time ?? '99') || a.title.localeCompare(b.title));
    }
  }
  const rank = (row: WeekRow) =>
    row.key.startsWith('m:') ? 0 : row.key.startsWith('p:') ? 1 : 2;
  return [...rows.values()].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (a.milestone?.target_date ?? '9999-12-31').localeCompare(b.milestone?.target_date ?? '9999-12-31') ||
      a.label.localeCompare(b.label),
  );
}

export interface TimelineWindow {
  start: string;
  end: string;
  days: number;
  months: { label: string; offset: number }[];
}

/**
 * The span the milestone timeline draws: a little of the past, so late
 * milestones show how late they are, out to the furthest live target — but
 * never so far that the next few weeks shrink to nothing.
 */
export function timelineWindow(rows: MilestoneRow[], today: string): TimelineWindow {
  const start = addDays(today, -21);
  const targets = rows.map((r) => r.target_date).filter((d): d is string => !!d);
  const furthest = targets.length ? targets.reduce((a, b) => (a > b ? a : b)) : addDays(today, 90);
  const minEnd = addDays(today, 60);
  const maxEnd = addDays(today, 240);
  let end = furthest < minEnd ? minEnd : furthest > maxEnd ? maxEnd : furthest;
  end = addDays(end, 7);
  const days = daysBetween(start, end);

  const months: { label: string; offset: number }[] = [];
  const first = new Date(start + 'T00:00:00Z');
  let cursor = Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 1);
  while (cursor <= Date.parse(end + 'T00:00:00Z')) {
    const iso = new Date(cursor).toISOString().slice(0, 10);
    const date = new Date(cursor);
    months.push({
      label: date.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC', ...(date.getUTCMonth() === 0 ? { year: '2-digit' } : {}) }),
      offset: daysBetween(start, iso) / days,
    });
    cursor = Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);
  }
  return { start, end, days, months };
}

export interface Bar {
  left: number; // 0..1 of the window
  width: number; // 0..1 of the window
  clippedStart: boolean;
  clippedEnd: boolean;
  startsUnknown: boolean;
}

/** Where a milestone's bar sits, or null when it has no target date. */
export function barFor(row: MilestoneRow, window: TimelineWindow, today: string): Bar | null {
  if (!row.target_date) return null;
  // With no start, draw the last two weeks before the target so the bar still
  // reads as "ends here" rather than collapsing to a sliver.
  const startsUnknown = !row.start_date;
  const from = row.start_date ?? addDays(row.target_date, -14);
  // A late milestone runs on to today: that stretch is the lateness.
  const to = row.status === 'overdue' && row.target_date < today ? today : row.target_date;
  const left = daysBetween(window.start, from) / window.days;
  const right = (daysBetween(window.start, to) + 1) / window.days;
  const clippedStart = left < 0;
  const clippedEnd = right > 1;
  const l = Math.max(0, Math.min(1, left));
  const r = Math.max(0, Math.min(1, right));
  return { left: l, width: Math.max(r - l, 0.006), clippedStart, clippedEnd, startsUnknown };
}

export interface WeekData {
  items?: FocusTask[];
  week_start?: string;
}

export interface ProjectRef {
  id: string | number;
  name: string;
}

/** The one-click destinations for moving tasks: today, tomorrow, the coming weekend, next Monday. */
export function quickMoveDates(today: string): { date: string; label: string }[] {
  const wd = weekdayIndex(today);
  const saturday = addDays(today, (5 - wd + 7) % 7);
  const monday = addDays(today, (7 - wd) % 7 || 7);
  const seen = new Set<string>();
  return [
    { date: today, label: 'Today' },
    { date: addDays(today, 1), label: 'Tomorrow' },
    { date: saturday, label: `${dayName(saturday)} ${shortDate(saturday)}` },
    { date: monday, label: `${dayName(monday)} ${shortDate(monday)}` },
  ].filter((q) => {
    if (seen.has(q.date)) return false;
    seen.add(q.date);
    return true;
  });
}
