'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar as CalendarIcon, Clock, Flame, Target } from 'lucide-react';
import { format, parseISO, isSameDay, addDays } from 'date-fns';
import { updateTaskStatus } from '@/lib/api';

interface WeeklyViewProps {
  weekData: any;
}

export default function WeeklyView({ weekData }: WeeklyViewProps) {
  const [tasks, setTasks] = useState<any[]>(weekData?.tasks || []);
  const monthlyGoals = weekData?.monthly_goals || [];
  const weeklyGoals = weekData?.weekly_goals || [];
  
  // Use week_start if provided, otherwise today
  const today = new Date();
  const weekStartStr = weekData?.week_start;
  const startDate = weekStartStr ? parseISO(weekStartStr) : today;

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
      await updateTaskStatus(taskId, newDone);
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
      </div>

      {/* Goals Banners */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                {weeklyGoals.map((g: any) => (
                  <li key={g.id} className="text-sm">
                    <span className="font-bold text-indigo-900 mr-2">{g.project_id?.substring(0, 8)}</span>
                    <span className="text-gray-700">{g.description}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-indigo-400/80 italic">No weekly goals mapped by AI for this week.</p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-0 rounded-xl bg-gradient-to-br from-emerald-50 to-white">
          <CardHeader className="pb-3 border-b border-emerald-100/50">
            <CardTitle className="text-base font-semibold text-emerald-900 flex items-center">
              <Target className="mr-2 text-emerald-500" size={18} />
              Current Month's Goals
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {monthlyGoals.length > 0 ? (
              <ul className="space-y-3">
                {monthlyGoals.map((g: any) => (
                  <li key={g.id} className="text-sm">
                    <span className="font-bold text-emerald-900 mr-2">{g.project_id?.substring(0, 8)}</span>
                    <span className="text-gray-700">{g.description}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-emerald-400/80 italic">No monthly goals set for this month.</p>
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
            <Card key={dateStr} className={`shadow-sm border-0 rounded-xl overflow-hidden min-h-[300px] flex flex-col ${isToday ? 'ring-2 ring-indigo-500/30 shadow-indigo-100/50' : ''}`}>
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
              
              <CardContent className="p-3 flex-1 bg-white/50 space-y-3 overflow-y-auto max-h-[600px] scrollbar-thin">
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
