'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Gauge, ChevronDown, ChevronRight } from 'lucide-react';

interface MilestoneRow {
  milestone_id: string;
  name: string;
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

// One palette per status, so the dot, the bar and the chip always agree.
const STATUS = {
  overdue: { label: 'Overdue', dot: 'bg-red-600', bar: 'bg-red-600', chip: 'bg-red-100 text-red-700' },
  red: { label: 'At risk', dot: 'bg-red-500', bar: 'bg-red-500', chip: 'bg-red-100 text-red-700' },
  amber: { label: 'Slipping', dot: 'bg-amber-500', bar: 'bg-amber-500', chip: 'bg-amber-100 text-amber-700' },
  green: { label: 'On track', dot: 'bg-emerald-500', bar: 'bg-emerald-500', chip: 'bg-emerald-100 text-emerald-700' },
  complete: { label: 'Complete', dot: 'bg-emerald-600', bar: 'bg-emerald-600', chip: 'bg-emerald-100 text-emerald-700' },
  no_date: { label: 'No dates', dot: 'bg-gray-400', bar: 'bg-gray-400', chip: 'bg-gray-100 text-gray-600' },
} as const;

const shortDate = (iso?: string | null) =>
  iso ? new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—';

const daysLabel = (row: MilestoneRow) => {
  if (row.days_left == null) return null;
  if (row.days_left < 0) return `${Math.abs(row.days_left)}d late`;
  if (row.days_left === 0) return 'due today';
  return `${row.days_left}d left`;
};

export default function MilestoneHealth({ milestones = [] }: { milestones?: MilestoneRow[] }) {
  // Finished milestones are kept but folded away — the panel is about what
  // still needs attention, and they would otherwise crowd out the live ones.
  const [showComplete, setShowComplete] = useState(false);
  const live = milestones.filter(m => m.status !== 'complete');
  const complete = milestones.filter(m => m.status === 'complete');
  const visible = showComplete ? [...live, ...complete] : live;

  const counts = {
    red: live.filter(m => m.status === 'red' || m.status === 'overdue').length,
    amber: live.filter(m => m.status === 'amber').length,
    green: live.filter(m => m.status === 'green').length,
  };

  return (
    <Card className="shadow-sm border-0 rounded-xl">
      <CardHeader className="border-b bg-white rounded-t-xl px-6 py-5">
        <CardTitle className="text-lg font-semibold text-gray-800 flex items-center justify-between">
          <span className="flex items-center">
            <Gauge className="mr-2 text-indigo-500" size={20} />
            Milestone Health
          </span>
          <span className="flex items-center gap-1.5 text-xs font-medium">
            <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700">{counts.red} at risk</span>
            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{counts.amber} slipping</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">{counts.green} on track</span>
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="p-0">
        {visible.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            No open milestones with tasks to track.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {visible.map(row => {
              const style = STATUS[row.status] ?? STATUS.no_date;
              const pct = Math.round(row.progress * 100);
              const elapsedPct = row.elapsed == null ? null : Math.round(row.elapsed * 100);
              return (
                <div key={row.milestone_id} className="px-6 py-3.5">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${style.dot}`} />
                    <span className="text-sm font-medium text-gray-800 truncate flex-1 min-w-0">
                      {row.name}
                      {row.project_name && (
                        <span className="text-gray-400 font-normal"> · {row.project_name}</span>
                      )}
                    </span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${style.chip}`}>
                      {style.label}
                    </span>
                  </div>

                  {/* Work done, with a marker for how much of the schedule has
                      gone. Marker ahead of the bar means running behind. */}
                  <div className="relative h-2 rounded-full bg-gray-100 overflow-visible">
                    <div
                      className={`h-2 rounded-full transition-all ${style.bar}`}
                      style={{ width: `${pct}%` }}
                    />
                    {elapsedPct != null && (
                      <div
                        className="absolute top-[-3px] h-3.5 w-0.5 bg-gray-700 rounded"
                        style={{ left: `calc(${elapsedPct}% - 1px)` }}
                        title={`${elapsedPct}% of the time has passed`}
                      />
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-1.5 text-xs text-gray-500">
                    <span>
                      {pct}% · {row.done}/{row.total} tasks
                      {elapsedPct != null && (
                        <span className="text-gray-400"> · {elapsedPct}% of time gone</span>
                      )}
                    </span>
                    <span className="flex-shrink-0">
                      {shortDate(row.start_date)} → {shortDate(row.target_date)}
                      {daysLabel(row) && (
                        <span className={row.status === 'overdue' ? 'text-red-600 font-medium' : ''}>
                          {' '}({daysLabel(row)})
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {complete.length > 0 && (
          <button
            onClick={() => setShowComplete(v => !v)}
            className="w-full flex items-center justify-center gap-1 px-6 py-2.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-50 border-t border-gray-100 transition-colors"
          >
            {showComplete ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            {showComplete ? 'Hide' : 'Show'} {complete.length} completed
          </button>
        )}
      </CardContent>
    </Card>
  );
}
