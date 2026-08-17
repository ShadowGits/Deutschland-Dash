'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Target, CheckCircle2, TrendingUp, AlertCircle, Calendar, Flame, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
// Server actions, not the lib/api versions: those run in the browser, where
// the planner app key does not exist, so every write came back 401.
import { updateTaskStatus, deleteTaskAction } from '@/app/actions';

interface GlobalDashboardProps {
  metrics: any;
  projects?: any[];
  monthlyGoals?: any[];
}

export default function GlobalDashboard({ metrics, projects = [], monthlyGoals = [] }: GlobalDashboardProps) {
  const [isOverdueExpanded, setIsOverdueExpanded] = useState(false);
  const [overdueTasks, setOverdueTasks] = useState(metrics?.totals?.overdue_list || []);
  // The list is capped server-side so a long backlog cannot bloat the payload,
  // so the headline number comes from the real count, not the list length.
  const [overdueTotal, setOverdueTotal] = useState<number>(
    metrics?.totals?.overdue_tasks ?? (metrics?.totals?.overdue_list || []).length
  );
  const overdueTruncated = !!metrics?.totals?.overdue_list_truncated;

  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const router = useRouter();

  // Fresh metrics arrive as a prop, and useState only reads its argument once,
  // so without this the list ignores the refresh button and any navigation.
  // Keyed on a string rather than the object, which would be a new identity
  // on every render.
  const overdueSignature = `${metrics?.totals?.overdue_tasks ?? 0}:${(metrics?.totals?.overdue_list || [])
    .map((t: any) => t.id)
    .join(',')}`;

  useEffect(() => {
    setOverdueTasks(metrics?.totals?.overdue_list || []);
    setOverdueTotal(
      metrics?.totals?.overdue_tasks ?? (metrics?.totals?.overdue_list || []).length
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overdueSignature]);

  const markPending = (taskId: string, busy: boolean) =>
    setPendingIds(prev => {
      const next = new Set(prev);
      if (busy) next.add(taskId);
      else next.delete(taskId);
      return next;
    });

  // Ticking one drops it from the list: a task you have just finished is not
  // overdue any more. Every update goes through the functional form, because
  // these await first and the previous version read a list captured before
  // the request started — so two quick clicks put the first one back.
  const handleComplete = async (taskId: string) => {
    if (pendingIds.has(taskId)) return;
    markPending(taskId, true);
    try {
      // The action reports failure by returning false, so leave the task in
      // the list rather than hiding a save that never happened.
      if (!(await updateTaskStatus(taskId, true))) return;
      setOverdueTasks((prev: any[]) => prev.filter((t: any) => t.id !== taskId));
      setOverdueTotal((n) => Math.max(0, n - 1));
      // The action drops the server's cached copy of the page; this makes the
      // browser go and collect the fresh one instead of keeping the old props.
      router.refresh();
    } catch (e) {
      console.error(e);
    } finally {
      markPending(taskId, false);
    }
  };

  const handleDelete = async (taskId: string) => {
    if (pendingIds.has(taskId)) return;
    markPending(taskId, true);
    try {
      if (!(await deleteTaskAction(taskId))) return;
      setOverdueTasks((prev: any[]) => prev.filter((t: any) => t.id !== taskId));
      setOverdueTotal((n) => Math.max(0, n - 1));
      router.refresh();
    } catch (e) {
      console.error(e);
    } finally {
      markPending(taskId, false);
    }
  };
  const totals = metrics?.totals || {};
  const streaks = metrics?.streaks || {};
  const upcomingDeadlines = metrics?.upcoming_deadlines || [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="shadow-sm border-0 rounded-xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Open Tasks</p>
                <h3 className="text-2xl font-bold text-gray-800">{totals.open_tasks || 0}</h3>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-500">
                <Target size={24} />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm border-0 rounded-xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Completed Today</p>
                <h3 className="text-2xl font-bold text-gray-800">{totals.completed_today || 0}</h3>
              </div>
              <div className="h-12 w-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500">
                <CheckCircle2 size={24} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-0 rounded-xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Past 7 Days</p>
                <h3 className="text-2xl font-bold text-gray-800">{totals.completions_last_7_days || 0}</h3>
              </div>
              <div className="h-12 w-12 rounded-full bg-purple-50 flex items-center justify-center text-purple-500">
                <TrendingUp size={24} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className={`shadow-sm border-0 rounded-xl cursor-pointer transition-colors hover:bg-red-50/50 ${isOverdueExpanded ? 'md:col-span-4 ring-2 ring-red-200' : ''}`}
          onClick={() => setIsOverdueExpanded(!isOverdueExpanded)}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Overdue</p>
                <h3 className="text-2xl font-bold text-red-600">{overdueTotal || 0}</h3>
              </div>
              <div className="h-12 w-12 rounded-full bg-red-50 flex items-center justify-center text-red-500">
                <AlertCircle size={24} />
              </div>
            </div>
            
            {isOverdueExpanded && overdueTasks.length > 0 && (
              <div className="mt-6 border-t border-red-100 pt-4 cursor-default" onClick={(e) => e.stopPropagation()}>
                <ul className="space-y-3">
                  {overdueTasks.map((task: any) => (
                    <li key={task.id} className="flex items-center justify-between bg-white p-3 rounded-lg border border-red-100 shadow-sm">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <input 
                          type="checkbox"
                          checked={false}
                          disabled={pendingIds.has(task.id)}
                          onChange={() => handleComplete(task.id)}
                          className="h-5 w-5 rounded border-red-300 text-red-600 focus:ring-red-500 cursor-pointer flex-shrink-0 disabled:opacity-40"
                        />
                        <span className={`text-sm font-medium truncate ${pendingIds.has(task.id) ? 'text-gray-400' : 'text-gray-800'}`}>
                          {task.title}
                        </span>
                      </div>
                      <button 
                        onClick={() => handleDelete(task.id)}
                        disabled={pendingIds.has(task.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors ml-2 flex-shrink-0 disabled:opacity-40"
                      >
                        <Trash2 size={18} />
                      </button>
                    </li>
                  ))}
                </ul>
                {overdueTruncated && (
                  <p className="mt-3 text-xs text-gray-500 text-center">
                    Showing the {overdueTasks.length} oldest of {overdueTotal} overdue tasks.
                  </p>
                )}
              </div>
            )}
            {isOverdueExpanded && overdueTasks.length === 0 && (
              <div className="mt-6 border-t border-red-100 pt-4 text-center text-sm text-gray-500">
                No overdue tasks! You're all caught up.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {monthlyGoals.length > 0 && (
        <Card className="shadow-sm border-0 rounded-xl bg-gradient-to-br from-emerald-50 to-white mb-6">
          <CardHeader className="border-b border-emerald-100/50 px-6 py-5">
            <CardTitle className="text-lg font-semibold text-emerald-900 flex items-center">
              <Target className="mr-2 text-emerald-500" size={20} />
              Current Month's Goals
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {monthlyGoals.map((g: any) => {
                const proj = projects.find(p => p.id === g.project_id);
                const projName = proj ? proj.name : g.project_id?.substring(0, 8);
                return (
                  <div key={g.id} className="p-4 rounded-lg bg-white border border-emerald-100/50 shadow-sm flex flex-col">
                    <span className="inline-flex items-center self-start px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 mb-2">
                      {projName}
                    </span>
                    <span className="text-gray-700 text-sm font-medium">{g.description}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="shadow-sm border-0 rounded-xl">
            <CardHeader className="border-b bg-white rounded-t-xl px-6 py-5">
              <CardTitle className="text-lg font-semibold text-gray-800 flex items-center">
                <Calendar className="mr-2 text-indigo-500" size={20} />
                Upcoming Deadlines
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {upcomingDeadlines.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-gray-500 uppercase bg-gray-50/50">
                      <tr>
                        <th className="px-6 py-4 font-medium">Item</th>
                        <th className="px-6 py-4 font-medium">Date</th>
                        <th className="px-6 py-4 font-medium text-right">Days Left</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {upcomingDeadlines.map((item: any, i: number) => (
                        <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-4 font-medium text-gray-900">
                            <div className="flex items-center">
                              <span className={`text-[10px] uppercase px-2 py-0.5 rounded-full mr-2 font-bold ${
                                item.kind === 'milestone' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                              }`}>
                                {item.kind}
                              </span>
                              {item.name}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-gray-500 whitespace-nowrap">
                            {item.date}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-medium ${
                              item.overdue 
                                ? 'bg-red-100 text-red-700' 
                                : item.days_left === 0 
                                  ? 'bg-orange-100 text-orange-700'
                                  : 'bg-emerald-100 text-emerald-700'
                            }`}>
                              {item.overdue ? 'Overdue' : item.days_left === 0 ? 'Today' : `${item.days_left} days`}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center text-gray-500">
                  No upcoming deadlines found.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="shadow-sm border-0 rounded-xl">
            <CardHeader className="border-b bg-white rounded-t-xl px-6 py-5">
              <CardTitle className="text-lg font-semibold text-gray-800 flex items-center">
                <Flame className="mr-2 text-orange-500" size={20} />
                Active Streaks
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {Object.entries(streaks).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-100">
                  <span className="capitalize font-medium text-gray-700">{key}</span>
                  <div className="flex items-center font-bold text-orange-600 bg-orange-100 px-3 py-1 rounded-full">
                    <Flame size={16} className="mr-1" />
                    {Number(value)} Days
                  </div>
                </div>
              ))}
              {Object.keys(streaks).length === 0 && (
                <div className="text-center text-gray-500 text-sm">
                  No streaks tracked yet.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
