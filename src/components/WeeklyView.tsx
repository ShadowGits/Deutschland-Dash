'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar as CalendarIcon, Clock, Flame, Target, RefreshCw, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { format, parseISO, isSameDay, addDays } from 'date-fns';
// Server actions: a request from the browser carries no app key and 401s.
import { updateTaskStatus, getWeekAction } from '@/app/actions';

interface WeeklyViewProps {
  weekData: any;
  projects?: any[];
}

export default function WeeklyView({ weekData, projects = [] }: WeeklyViewProps) {
  // Habits belong in the day view, not the weekly grid, so they are dropped here.
  const stripHabits = (items: any[]) => (items || []).filter((t: any) => !t.is_habit);

  const [tasks, setTasks] = useState<any[]>(stripHabits(weekData?.items));
  const [weeklyGoals, setWeeklyGoals] = useState<any[]>(weekData?.weekly_goals || []);
  const [weekStartStr, setWeekStartStr] = useState<string | undefined>(weekData?.week_start);
  const [loadingWeek, setLoadingWeek] = useState(false);

  const today = new Date();
  const startDate = weekStartStr ? parseISO(weekStartStr) : today;

  // Fetch a different week through the server action and swap it in. The date
  // handed in can be any day inside the target week; the API returns its start.
  const goToWeek = async (anchor: Date) => {
    setLoadingWeek(true);
    try {
      const data = await getWeekAction(format(anchor, 'yyyy-MM-dd'));
      if (data) {
        setTasks(stripHabits(data.items));
        setWeeklyGoals(data.weekly_goals || []);
        setWeekStartStr(data.week_start);
      }
    } finally {
      setLoadingWeek(false);
    }
  };
  const prevWeek = () => goToWeek(addDays(startDate, -7));
  const nextWeek = () => goToWeek(addDays(startDate, 7));
  const thisWeek = () => goToWeek(new Date());


  // Generate 7 days
  const daysOfWeek = Array.from({ length: 7 }).map((_, i) => {
    const d = addDays(startDate, i);
    return {
      dateObj: d,
      dateStr: format(d, 'yyyy-MM-dd'),
      dayName: format(d, 'EEEE'),
      isToday: isSameDay(d, today)
    };
  });

  const handleTaskToggle = async (taskId: string, currentDone: boolean) => {
    const newDone = !currentDone;
    
    // Optimistic update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, done: newDone } : t));
    
    // API call
    try {
      if (!(await updateTaskStatus(taskId, newDone))) {
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, done: currentDone } : t));
      }
    } catch (e) {
      // Revert on failure
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, done: currentDone } : t));
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center">
          <CalendarIcon className="mr-3 text-indigo-500" size={28} />
          Weekly Plan
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={prevWeek}
            disabled={loadingWeek}
            aria-label="Previous week"
            className="p-1.5 bg-gray-100 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 rounded-md transition-colors disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="min-w-[150px] text-center text-sm font-medium text-gray-700 flex items-center justify-center">
            {loadingWeek ? (
              <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
            ) : (
              <span>{format(startDate, 'MMM d')} – {format(addDays(startDate, 6), 'MMM d')}</span>
            )}
          </div>
          <button
            onClick={nextWeek}
            disabled={loadingWeek}
            aria-label="Next week"
            className="p-1.5 bg-gray-100 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 rounded-md transition-colors disabled:opacity-50"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={thisWeek}
            disabled={loadingWeek}
            className="ml-1 px-3 py-1.5 bg-gray-100 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 rounded-md font-medium transition-colors text-sm disabled:opacity-50"
          >
            This week
          </button>
        </div>
      </div>

      {/* Goals Banners */}
      <div className="grid grid-cols-1 gap-6">
        <Card className="shadow-sm border-0 rounded-xl bg-gradient-to-br from-indigo-50 to-white">
          <CardHeader className="pb-3 border-b border-indigo-100/50">
            <CardTitle className="text-base font-semibold text-indigo-900 flex items-center">
              <Flame className="mr-2 text-indigo-500" size={18} />
              Weekly Goals (AI Planned)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {weeklyGoals.length > 0 ? (
              <ul className="space-y-3">
                {weeklyGoals.map((g: any) => {
                  const proj = projects.find(p => p.id === g.project_id);
                  const projName = proj ? proj.name : g.project_id?.substring(0, 8);
                  return (
                    <li key={g.id} className="text-sm">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800 mr-2">
                        {projName}
                      </span>
                      <span className="text-gray-700">{g.description}</span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-indigo-400/80 italic">No weekly goals mapped by AI for this week.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-7 gap-4 items-start">
        {daysOfWeek.map(({ dateObj, dateStr, dayName, isToday }) => {
          const dayTasks = tasks.filter(t => t.scheduled_date === dateStr || t.due_date === dateStr).sort((a, b) => {
            if (a.start_time && b.start_time) return a.start_time.localeCompare(b.start_time);
            if (a.start_time) return -1;
            if (b.start_time) return 1;
            return 0;
          });

          return (
            <Card key={dateStr} className={`shadow-sm border-0 rounded-xl flex flex-col ${isToday ? 'ring-2 ring-indigo-500/30 shadow-indigo-100/50' : ''}`}>
              <CardHeader className={`px-4 py-3 border-b ${isToday ? 'bg-indigo-50/80' : 'bg-gray-50/50'}`}>
                <div className="flex flex-col items-center">
                  <span className={`text-xs font-bold uppercase tracking-wider mb-1 ${isToday ? 'text-indigo-600' : 'text-gray-500'}`}>
                    {dayName}
                  </span>
                  <span className={`text-xl font-bold ${isToday ? 'text-indigo-900' : 'text-gray-800'}`}>
                    {format(dateObj, 'd')}
                  </span>
                  <span className={`text-xs font-medium ${isToday ? 'text-indigo-400' : 'text-gray-400'}`}>
                    {format(dateObj, 'MMM')}
                  </span>
                </div>
              </CardHeader>
              
              <CardContent className="p-3 flex-1 bg-white/50 space-y-3">
                {dayTasks.map(task => (
                  <div 
                    key={task.id} 
                    className={`p-3 rounded-lg border transition-all duration-200 ${
                      task.done 
                        ? 'bg-gray-50 border-gray-100 opacity-60' 
                        : 'bg-white border-gray-200 hover:border-indigo-300 hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <input 
                        type="checkbox"
                        checked={task.done}
                        onChange={() => handleTaskToggle(task.id, task.done)}
                        className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium leading-tight ${task.done ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                          {task.title}
                        </p>
                        
                        <div className="mt-2 flex flex-wrap gap-2 items-center text-xs">
                          {task.start_time && (
                            <span className="inline-flex items-center text-gray-500 font-medium">
                              <Clock className="mr-1 h-3 w-3" />
                              {task.start_time.substring(0, 5)}
                            </span>
                          )}
                          {task.priority === 'high' && (
                            <span className="inline-flex items-center text-red-600 font-bold bg-red-50 px-1.5 py-0.5 rounded">
                              🔥 High
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                
                {dayTasks.length === 0 && (
                  <div className="text-center py-6 text-gray-300 text-xs font-medium">
                    No tasks
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
