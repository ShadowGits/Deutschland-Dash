"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckSquare, X, Plus, Loader2, Calendar } from 'lucide-react';
import { getProjectTasks, addTaskToProject, updateTaskStatus } from '@/app/actions';

interface ProjectTasksWidgetProps {
  projectId: string;
  widget: any;
  onDelete: () => Promise<void>;
}

export default function ProjectTasksWidget({ projectId, widget, onDelete }: ProjectTasksWidgetProps) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDate, setNewTaskDate] = useState('');
  
  const loadTasks = async () => {
    setLoading(true);
    try {
      const data = await getProjectTasks(projectId);
      setTasks(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, [projectId]);

  const handleToggle = async (taskId: string, currentDone: boolean) => {
    // Optimistic update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: currentDone ? 'todo' : 'done' } : t));
    try {
      await updateTaskStatus(taskId, !currentDone);
    } catch (e) {
      // Revert on failure
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: currentDone ? 'done' : 'todo' } : t));
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    
    setAdding(true);
    try {
      await addTaskToProject(projectId, newTaskTitle, newTaskDate || undefined);
      setNewTaskTitle('');
      setNewTaskDate('');
      await loadTasks();
    } catch (err) {
      console.error(err);
    } finally {
      setAdding(false);
    }
  };

  const openTasks = tasks.filter(t => t.status !== 'done');
  const doneTasks = tasks.filter(t => t.status === 'done');
  const sortedTasks = [...openTasks, ...doneTasks];

  return (
    <Card className="shadow-sm border-0 rounded-xl mb-6">
      <CardHeader className="border-b bg-white rounded-t-xl px-6 py-4 flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold text-gray-800 flex items-center">
          <CheckSquare className="mr-2 text-indigo-600" size={20} />
          {widget.title || "Project Tasks"}
        </CardTitle>
        <button 
          onClick={onDelete}
          className="p-2 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-full transition-colors"
          title="Remove Widget"
        >
          <X size={16} />
        </button>
      </CardHeader>
      <CardContent className="p-0">
        <div className="p-4 border-b bg-gray-50/50">
          <form onSubmit={handleAddTask} className="flex gap-2">
            <input 
              type="text" 
              placeholder="Add a new task..." 
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              className="flex-1 p-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <input 
              type="date"
              value={newTaskDate}
              onChange={(e) => setNewTaskDate(e.target.value)}
              className="p-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-gray-600"
            />
            <button 
              type="submit"
              disabled={adding || !newTaskTitle.trim()}
              className="px-4 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center"
            >
              {adding ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
            </button>
          </form>
        </div>

        <div className="max-h-[400px] overflow-y-auto p-2">
          {loading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="animate-spin text-indigo-600" size={24} />
            </div>
          ) : tasks.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p>No tasks found. Create one above!</p>
            </div>
          ) : (
            <ul className="space-y-1">
              {sortedTasks.map(task => (
                <li key={task.id} className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${task.status === 'done' ? 'bg-gray-50' : 'hover:bg-gray-50'}`}>
                  <input 
                    type="checkbox" 
                    checked={task.status === 'done'}
                    onChange={() => handleToggle(task.id, task.status === 'done')}
                    className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${task.status === 'done' ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                      {task.title}
                    </p>
                    {task.scheduled_date && (
                      <p className="text-xs text-gray-500 flex items-center mt-0.5">
                        <Calendar size={12} className="mr-1" />
                        {task.scheduled_date}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
