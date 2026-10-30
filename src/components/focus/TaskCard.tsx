'use client';

import { useRef, useState } from 'react';
import { ArrowRight, CalendarDays, Check, Clock, Loader2, Pin, X } from 'lucide-react';
import { estimate, isPinned, lateness, minutesLabel, type FocusTask } from '@/lib/focus';

interface TaskCardProps {
  task: FocusTask;
  today: string;
  context?: string | null; // milestone or project name
  contextSoon?: string | null; // e.g. "milestone in 3d"
  busy?: boolean;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (selected: boolean) => void;
  onDone: () => void;
  onTomorrow: () => void;
  /** Move to a chosen day (YYYY-MM-DD). */
  onPickDate: (date: string) => void;
  onDrop: () => void;
}

const REASON_STYLE = {
  deadline: 'bg-red-50 text-red-700 border-red-200',
  missed_slot: 'bg-amber-50 text-amber-800 border-amber-200',
  unplanned: 'bg-gray-100 text-gray-600 border-gray-200',
} as const;

export default function TaskCard({
  task,
  today,
  context,
  contextSoon,
  busy = false,
  selectable = false,
  selected = false,
  onSelect,
  onDone,
  onTomorrow,
  onPickDate,
  onDrop,
}: TaskCardProps) {
  const dateInput = useRef<HTMLInputElement>(null);
  // Shown only where the browser cannot open its date picker on request.
  const [typingDate, setTypingDate] = useState(false);
  const [typed, setTyped] = useState('');

  const openPicker = () => {
    const input = dateInput.current;
    try {
      if (!input?.showPicker) throw new Error('no picker');
      input.showPicker();
    } catch {
      setTypingDate(true);
    }
  };

  const overdue = !!task.overdue;
  const badge = overdue
    ? lateness(task, today)
    : task.start_time
      ? task.start_time.slice(0, 5)
      : 'Any time today';
  const badgeStyle = overdue
    ? REASON_STYLE[task.overdue_reason ?? 'unplanned']
    : 'bg-indigo-50 text-indigo-700 border-indigo-200';

  return (
    <div
      className={`group relative flex flex-col rounded-lg border bg-white p-3 shadow-sm transition-all ${
        selected ? 'border-indigo-400 ring-2 ring-indigo-200' : 'border-gray-200 hover:border-gray-300 hover:shadow'
      } ${busy ? 'opacity-50' : ''}`}
    >
      <div className="flex items-start gap-2">
        {selectable && (
          <input
            type="checkbox"
            checked={selected}
            disabled={busy}
            onChange={(e) => onSelect?.(e.target.checked)}
            aria-label={`Select ${task.title}`}
            className="mt-0.5 h-4 w-4 flex-shrink-0 cursor-pointer rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
        )}
        <p className="min-w-0 flex-1 text-sm font-semibold leading-snug text-gray-900 line-clamp-2" title={task.title}>
          {isPinned(task) && (
            <Pin
              size={12}
              className="mr-1 inline -translate-y-px text-rose-500"
              aria-label={task.starred ? 'Starred' : 'High priority'}
            />
          )}
          {task.title}
        </p>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 font-medium ${badgeStyle}`}>
          {badge}
        </span>
        <span className="inline-flex items-center text-gray-500">
          <Clock size={11} className="mr-0.5" />
          {minutesLabel(estimate(task))}
        </span>
        {context && (
          <span className="max-w-[12rem] truncate rounded bg-gray-100 px-1.5 py-0.5 text-gray-600" title={context}>
            {context}
          </span>
        )}
        {contextSoon && (
          <span className="rounded bg-violet-100 px-1.5 py-0.5 font-medium text-violet-700">{contextSoon}</span>
        )}
      </div>

      <div className="mt-2.5 flex items-center gap-1 border-t border-gray-100 pt-2">
        {busy ? (
          <Loader2 size={14} className="animate-spin text-gray-400" />
        ) : (
          <>
            <button
              type="button"
              onClick={onDone}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
              title="Mark done"
            >
              <Check size={13} /> Done
            </button>
            <button
              type="button"
              onClick={onTomorrow}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
              title="Move to tomorrow, untimed"
            >
              <ArrowRight size={13} /> Tomorrow
            </button>
            <button
              type="button"
              onClick={openPicker}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
              title="Move to another day"
            >
              <CalendarDays size={13} /> Date
            </button>
            {/* The picker needs a rendered input to anchor to; this one is
                invisible and only ever filled by choosing a day in it, so a
                half-typed date can never move the task. */}
            <input
              ref={dateInput}
              type="date"
              min={today}
              tabIndex={-1}
              aria-hidden="true"
              className="sr-only"
              onChange={(e) => {
                const day = e.target.value;
                e.target.value = '';
                if (day && day >= today) onPickDate(day);
              }}
            />
            <button
              type="button"
              onClick={onDrop}
              className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              title="Drop — closed as skipped, not deleted"
            >
              <X size={13} /> Drop
            </button>
          </>
        )}
      </div>
      {typingDate && !busy && (
        <div className="mt-2 flex items-center gap-1.5">
          <input
            type="date"
            min={today}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            aria-label={`New date for ${task.title}`}
            className="min-w-0 flex-1 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-700"
          />
          <button
            type="button"
            disabled={!typed || typed < today}
            onClick={() => {
              onPickDate(typed);
              setTypingDate(false);
              setTyped('');
            }}
            className="rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-40"
          >
            Move
          </button>
          <button
            type="button"
            onClick={() => setTypingDate(false)}
            aria-label="Cancel"
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100"
          >
            <X size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
