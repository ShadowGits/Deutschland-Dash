'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { addDays, dayName, shortDate, weekRows, type FocusTask, type MilestoneRow } from '@/lib/focus';

interface WeekGridProps {
  items: FocusTask[];
  weekStart: string;
  today: string;
  milestones: Map<string, MilestoneRow>;
  projectNames: Map<string, string>;
  loading: boolean;
  onPrev: () => void;
  onNext: () => void;
  onThisWeek: () => void;
  onToggle: (task: FocusTask) => void;
}

const CELL_LIMIT = 3;

const MILESTONE_DOT: Record<MilestoneRow['status'], string> = {
  overdue: 'bg-red-600',
  red: 'bg-red-500',
  amber: 'bg-amber-500',
  green: 'bg-emerald-500',
  complete: 'bg-emerald-600',
  no_date: 'bg-gray-300',
};

export default function WeekGrid({
  items,
  weekStart,
  today,
  milestones,
  projectNames,
  loading,
  onPrev,
  onNext,
  onThisWeek,
  onToggle,
}: WeekGridProps) {
  const [openCells, setOpenCells] = useState<Set<string>>(new Set());
  const rows = weekRows(items, weekStart, milestones, projectNames);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const isThisWeek = days.includes(today);
  const total = rows.reduce((n, r) => n + r.count, 0);

  const toggleCell = (key: string) =>
    setOpenCells((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <section className="rounded-xl bg-white shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">This week</h2>
          <p className="text-xs text-gray-500">
            One row per milestone, soonest target first. Tick a task to mark it done.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onPrev}
            disabled={loading}
            aria-label="Previous week"
            className="rounded-md bg-gray-100 p-1.5 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-50"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="min-w-[130px] text-center text-sm font-medium text-gray-700">
            {loading ? (
              <Loader2 size={16} className="mx-auto animate-spin text-indigo-500" />
            ) : (
              `${shortDate(days[0])} – ${shortDate(days[6])}`
            )}
          </span>
          <button
            type="button"
            onClick={onNext}
            disabled={loading}
            aria-label="Next week"
            className="rounded-md bg-gray-100 p-1.5 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-50"
          >
            <ChevronRight size={16} />
          </button>
          {!isThisWeek && (
            <button
              type="button"
              onClick={onThisWeek}
              disabled={loading}
              className="ml-1 rounded-md bg-gray-100 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-indigo-50 hover:text-indigo-600"
            >
              This week
            </button>
          )}
        </div>
      </header>

      {total === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-gray-500">Nothing planned this week.</p>
      ) : (
        <div className="overflow-x-auto">
          <div
            className="grid min-w-[960px] text-xs"
            style={{ gridTemplateColumns: 'minmax(170px, 210px) repeat(7, minmax(108px, 1fr))' }}
          >
            {/* Day header */}
            <div className="sticky left-0 z-10 border-b bg-gray-50 px-3 py-2 font-semibold uppercase tracking-wide text-gray-500">
              {total} tasks
            </div>
            {days.map((day) => (
              <div
                key={day}
                className={`border-b border-l px-2 py-2 text-center ${
                  day === today ? 'bg-indigo-50 text-indigo-700' : 'bg-gray-50 text-gray-500'
                }`}
              >
                <div className="font-semibold uppercase tracking-wide">{dayName(day)}</div>
                <div className={`text-sm font-bold ${day === today ? 'text-indigo-800' : 'text-gray-700'}`}>
                  {shortDate(day)}
                </div>
              </div>
            ))}

            {rows.map((row) => (
              <div key={row.key} className="contents">
                <div className="sticky left-0 z-10 flex items-start gap-2 border-b bg-white px-3 py-2.5">
                  <span
                    className={`mt-1 h-2 w-2 flex-shrink-0 rounded-full ${
                      row.milestone ? MILESTONE_DOT[row.milestone.status] : 'bg-gray-300'
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-gray-800" title={row.label}>
                      {row.label}
                    </div>
                    <div className="truncate text-[11px] text-gray-500">
                      {row.milestone?.target_date ? `due ${shortDate(row.milestone.target_date)}` : row.sublabel}
                      {row.milestone?.target_date && row.sublabel ? ` · ${row.sublabel}` : ''}
                    </div>
                  </div>
                </div>
                {row.cells.map((cell, i) => {
                  const cellKey = `${row.key}:${i}`;
                  const open = openCells.has(cellKey);
                  const shown = open ? cell : cell.slice(0, CELL_LIMIT);
                  return (
                    <div
                      key={cellKey}
                      className={`space-y-1 border-b border-l p-1.5 ${days[i] === today ? 'bg-indigo-50/40' : ''}`}
                    >
                      {shown.map((task) => (
                        <button
                          key={task.id}
                          type="button"
                          onClick={() => onToggle(task)}
                          title={`${task.title}${task.start_time ? ` · ${task.start_time.slice(0, 5)}` : ''} — click to ${task.done ? 'reopen' : 'mark done'}`}
                          className={`flex w-full items-start gap-1.5 rounded-md border px-1.5 py-1 text-left leading-tight transition-colors ${
                            task.done
                              ? 'border-gray-100 bg-gray-50 text-gray-400 line-through'
                              : 'border-indigo-100 bg-indigo-50/70 text-gray-800 hover:border-indigo-300 hover:bg-indigo-100'
                          }`}
                        >
                          <span
                            className={`mt-0.5 h-3 w-3 flex-shrink-0 rounded-sm border ${
                              task.done ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300 bg-white'
                            }`}
                          />
                          <span className="min-w-0 flex-1">
                            {task.start_time && (
                              <span className="mr-1 font-semibold text-indigo-700">{task.start_time.slice(0, 5)}</span>
                            )}
                            <span className="line-clamp-2">{task.title}</span>
                          </span>
                        </button>
                      ))}
                      {cell.length > CELL_LIMIT && (
                        <button
                          type="button"
                          onClick={() => toggleCell(cellKey)}
                          className="w-full rounded px-1 py-0.5 text-left font-medium text-indigo-600 hover:bg-indigo-50"
                        >
                          {open ? 'Show less' : `+${cell.length - CELL_LIMIT} more`}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
