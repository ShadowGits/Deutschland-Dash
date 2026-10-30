'use client';

import { useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import ConfirmDeleteButton from '@/components/focus/ConfirmDeleteButton';
import {
  barFor,
  daysBetween,
  shortDate,
  timelineWindow,
  type MilestoneRow,
} from '@/lib/focus';

interface MilestoneTimelineProps {
  milestones: MilestoneRow[];
  today: string;
  onDelete: (row: MilestoneRow) => Promise<boolean>;
  onComplete: (row: MilestoneRow) => Promise<boolean>;
}

const STATUS = {
  overdue: { label: 'Late', bar: 'bg-red-200', fill: 'bg-red-600', chip: 'bg-red-100 text-red-700' },
  red: { label: 'At risk', bar: 'bg-red-100', fill: 'bg-red-500', chip: 'bg-red-100 text-red-700' },
  amber: { label: 'Slipping', bar: 'bg-amber-100', fill: 'bg-amber-500', chip: 'bg-amber-100 text-amber-800' },
  green: { label: 'On track', bar: 'bg-emerald-100', fill: 'bg-emerald-500', chip: 'bg-emerald-100 text-emerald-700' },
  complete: { label: 'Complete', bar: 'bg-emerald-100', fill: 'bg-emerald-600', chip: 'bg-emerald-100 text-emerald-700' },
  no_date: { label: 'No dates', bar: 'bg-gray-100', fill: 'bg-gray-400', chip: 'bg-gray-100 text-gray-600' },
} as const;

function when(row: MilestoneRow, today: string): string {
  if (!row.target_date) return 'no target date';
  const days = daysBetween(today, row.target_date);
  if (days < 0) return `${-days}d late`;
  if (days === 0) return 'due today';
  return `${days}d left`;
}

export default function MilestoneTimeline({ milestones, today, onDelete, onComplete }: MilestoneTimelineProps) {
  const [completing, setCompleting] = useState<string | null>(null);
  const dated = milestones
    .filter((m) => m.target_date)
    .sort((a, b) => (a.target_date ?? '').localeCompare(b.target_date ?? '') || a.name.localeCompare(b.name));
  const undated = milestones.filter((m) => !m.target_date).sort((a, b) => a.name.localeCompare(b.name));
  const range = timelineWindow(dated, today);
  const todayAt = daysBetween(range.start, today) / range.days;

  const complete = async (row: MilestoneRow) => {
    setCompleting(row.milestone_id);
    try {
      await onComplete(row);
    } finally {
      setCompleting(null);
    }
  };

  return (
    <section className="rounded-xl bg-white shadow-sm">
      <header className="border-b px-5 py-4">
        <h2 className="text-lg font-semibold text-gray-800">Milestones</h2>
        <p className="text-xs text-gray-500">
          Each bar runs from start to target. The dark fill is how much is done; red means it is behind the calendar.
        </p>
      </header>

      {milestones.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-gray-500">No open milestones.</p>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[760px] px-5 py-4">
            {/* Month ruler */}
            <div className="grid" style={{ gridTemplateColumns: 'minmax(190px, 240px) 1fr' }}>
              <div />
              <div className="relative h-5 text-[11px] font-medium text-gray-400">
                {range.months
                  // A month that starts right next to today would sit under the Today label.
                  .filter((m) => Math.abs(m.offset - todayAt) > 0.04)
                  .map((m) => (
                    <span key={m.label + m.offset} className="absolute -translate-x-1/2" style={{ left: `${m.offset * 100}%` }}>
                      {m.label}
                    </span>
                  ))}
                <span
                  className="absolute -translate-x-1/2 font-semibold text-indigo-600"
                  style={{ left: `${todayAt * 100}%` }}
                >
                  Today
                </span>
              </div>
            </div>

            {dated.map((row) => {
              const bar = barFor(row, range, today);
              const style = STATUS[row.status];
              const pct = Math.round(row.progress * 100);
              return (
                <div
                  key={row.milestone_id}
                  className="group grid items-center border-t border-gray-100 py-1.5"
                  style={{ gridTemplateColumns: 'minmax(190px, 240px) 1fr' }}
                >
                  <div className="min-w-0 pr-3">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-semibold text-gray-800" title={row.name}>
                        {row.name}
                      </span>
                      <span className={`flex-shrink-0 rounded-full px-1.5 py-px text-[10px] font-semibold ${style.chip}`}>
                        {style.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-gray-500">
                      <span className="truncate">
                        {shortDate(row.target_date)} · {when(row, today)} · {row.done}/{row.total} tasks
                      </span>
                      <span className="ml-auto flex flex-shrink-0 items-center opacity-60 transition-opacity group-hover:opacity-100">
                        {row.status === 'overdue' && (
                          <button
                            type="button"
                            onClick={() => complete(row)}
                            disabled={completing === row.milestone_id}
                            title="Mark this milestone complete"
                            aria-label={`Mark ${row.name} complete`}
                            className="rounded-md p-1 text-gray-400 hover:bg-emerald-50 hover:text-emerald-600"
                          >
                            {completing === row.milestone_id ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <CheckCircle2 size={13} />
                            )}
                          </button>
                        )}
                        <ConfirmDeleteButton what={`milestone ${row.name}`} onConfirm={() => onDelete(row)} />
                      </span>
                    </div>
                  </div>

                  <div className="relative h-7">
                    {range.months.map((m) => (
                      <span
                        key={m.label + m.offset}
                        className="absolute inset-y-0 w-px bg-gray-100"
                        style={{ left: `${m.offset * 100}%` }}
                      />
                    ))}
                    <span className="absolute inset-y-0 z-10 w-0.5 bg-indigo-400" style={{ left: `${todayAt * 100}%` }} />
                    {bar && (
                      <div
                        className={`absolute top-1 h-5 overflow-hidden rounded ${style.bar} ${
                          bar.startsUnknown ? 'border-l-2 border-dashed border-gray-300' : ''
                        }`}
                        style={{ left: `${bar.left * 100}%`, width: `${bar.width * 100}%` }}
                        title={`${row.name}: ${row.start_date ? shortDate(row.start_date) : 'no start date'} → ${shortDate(row.target_date)} · ${pct}% done`}
                      >
                        <div className={`h-full ${style.fill}`} style={{ width: `${pct}%` }} />
                        <span className="absolute inset-y-0 left-1.5 flex items-center text-[10px] font-bold text-gray-800 mix-blend-multiply">
                          {pct}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {undated.length > 0 && (
              <div className="mt-3 border-t border-gray-100 pt-3">
                <p className="mb-2 text-xs font-semibold text-gray-500">
                  No target date ({undated.length}) — not on the timeline until they get one
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {undated.map((row) => (
                    <span
                      key={row.milestone_id}
                      className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 py-0.5 pl-2.5 pr-1 text-xs text-gray-700"
                    >
                      <span className="max-w-[14rem] truncate" title={row.name}>{row.name}</span>
                      <span className="text-gray-400">{row.done}/{row.total}</span>
                      <ConfirmDeleteButton what={`milestone ${row.name}`} onConfirm={() => onDelete(row)} />
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
