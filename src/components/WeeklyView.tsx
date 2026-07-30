'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar as CalendarIcon, Clock, CheckCircle2, Circle } from 'lucide-react';
import { format, parseISO, isSameDay } from 'date-fns';

interface WeeklyViewProps {
  weekData: any;
}

export default function WeeklyView({ weekData }: WeeklyViewProps) {
  const tasks = weekData?.tasks || [];
  
  // Group tasks by scheduled_date
  const groupedTasks: Record<string, any[]> = {};
  
  tasks.forEach((task: any) => {
    if (task.scheduled_date) {
      if (!groupedTasks[task.scheduled_date]) {
        groupedTasks[task.scheduled_date] = [];
      }
      groupedTasks[task.scheduled_date].push(task);
    }
  });

  // Sort dates
  const sortedDates = Object.keys(groupedTasks).sort();
  const today = new Date();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center">
          <CalendarIcon className="mr-3 text-indigo-500" size={28} />
          Weekly Plan
        </h2>
      </div>

      {sortedDates.length === 0 ? (
        <Card className="shadow-sm border-0 rounded-xl">
          <CardContent className="p-12 text-center text-gray-500">
            No tasks scheduled for this week.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {sortedDates.map(dateStr => {
            const date = parseISO(dateStr);
            const isToday = isSameDay(date, today);
            const dayTasks = groupedTasks[dateStr].sort((a, b) => {
              if (a.start_time && b.start_time) return a.start_time.localeCompare(b.start_time);
              if (a.start_time) return -1;
              if (b.start_time) return 1;
              return 0;
            });

            return (
              <Card key={dateStr} className={`shadow-sm border-0 rounded-xl overflow-hidden ${isToday ? 'ring-2 ring-indigo-500/20' : ''}`}>
                <CardHeader className={`border-b px-6 py-4 ${isToday ? 'bg-indigo-50/50' : 'bg-gray-50/50'}`}>
                  <CardTitle className="flex items-center justify-between text-base">
                    <div className="flex items-center space-x-2">
                      <span className={`font-bold ${isToday ? 'text-indigo-700' : 'text-gray-800'}`}>
                        {format(date, 'EEEE')}
                      </span>
                      <span className="text-sm font-medium text-gray-500">
                        {format(date, 'MMM d')}
                      </span>
                    </div>
                    {isToday && (
                      <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-100 px-2 py-1 rounded-full">
                        Today
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ul className="divide-y divide-gray-100">
                    {dayTasks.map(task => (
                      <li key={task.id} className="p-4 hover:bg-gray-50/50 transition-colors">
                        <div className="flex items-start">
                          <div className="flex-shrink-0 mt-0.5">
                            {task.done ? (
                              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                            ) : (
                              <Circle className="h-5 w-5 text-gray-300" />
                            )}
                          </div>
                          <div className="ml-3 flex-1">
                            <p className={`text-sm font-medium ${task.done ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                              {task.title}
                            </p>
                            <div className="mt-1 flex items-center space-x-4 text-xs text-gray-500">
                              {task.start_time && (
                                <span className="flex items-center">
                                  <Clock className="mr-1 h-3.5 w-3.5" />
                                  {task.start_time.substring(0, 5)}
                                  {task.estimated_minutes ? ` (${task.estimated_minutes}m)` : ''}
                                </span>
                              )}
                              <span className={`capitalize px-2 py-0.5 rounded-full ${
                                task.priority === 'high' ? 'bg-red-100 text-red-700' : 
                                task.priority === 'medium' ? 'bg-orange-100 text-orange-700' : 
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {task.priority}
                              </span>
                            </div>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
