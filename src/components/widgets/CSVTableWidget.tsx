'use client';

import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, FileSpreadsheet, Loader2, CheckSquare, Upload } from 'lucide-react';
import { downloadProjectFile, getProjectTasks, updateTaskStatus, uploadProjectFile, getProjectFiles } from '@/app/actions';

interface CSVTableWidgetProps {
  projectId?: string;
  projectFiles?: any[];
}

export default function CSVTableWidget({ projectId, projectFiles = [] }: CSVTableWidgetProps) {
  const [data, setData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [tasksMap, setTasksMap] = useState<Record<string, boolean>>({});
  const [liveFiles, setLiveFiles] = useState<any[]>(projectFiles || []);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const firstUncheckedRef = React.useRef<HTMLTableRowElement>(null);

  const csvFiles = liveFiles.filter(f => (f.name && f.name.toLowerCase().endsWith('.csv')) || f.file_type === 'csv' || f.file_type === 'excel');

  useEffect(() => {
    let cancelled = false;
    if (projectId) {
      getProjectFiles(projectId).then(fetched => {
        if (!cancelled && fetched && fetched.length > 0) {
          setLiveFiles(fetched);
        }
      });
    }
    return () => { cancelled = true; };
  }, [projectId]);

  useEffect(() => {
    if (csvFiles.length > 0 && !selectedFileId) {
      setSelectedFileId(csvFiles[0].id);
    }
  }, [csvFiles, selectedFileId]);

  useEffect(() => {
    async function loadData() {
      if (!projectId || !selectedFileId) return;
      setLoading(true);
      try {
        // Fetch raw CSV and Live Tasks in parallel
        const [csvText, liveTasks] = await Promise.all([
          downloadProjectFile(projectId, selectedFileId),
          getProjectTasks(projectId)
        ]);

        if (liveTasks) {
          const map: Record<string, boolean> = {};
          liveTasks.forEach(t => {
            map[t.id] = !!t.done;
          });
          setTasksMap(map);
        }

        if (csvText) {
          Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
              if (results.data && results.data.length > 0) {
                setHeaders(Object.keys(results.data[0] as object));
                setData(results.data as any[]);
              } else {
                setHeaders([]);
                setData([]);
              }
            },
            error: (error: any) => {
              console.error("Error parsing CSV:", error);
            }
          });
        }
      } catch (e) {
        console.error("Failed to load CSV widget data", e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [projectId, selectedFileId]);

  useEffect(() => {
    // Scroll to the first unchecked task after data loads
    if (data.length > 0 && firstUncheckedRef.current) {
      // Small timeout to ensure rendering is fully complete
      setTimeout(() => {
        firstUncheckedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [data, tasksMap]);

  const handleToggleTask = async (taskId: string, currentStatus: boolean) => {
    // Optimistic UI update
    setTasksMap(prev => ({ ...prev, [taskId]: !currentStatus }));
    try {
      await updateTaskStatus(taskId, !currentStatus);
    } catch (e) {
      console.error(e);
      // Revert on failure
      setTasksMap(prev => ({ ...prev, [taskId]: currentStatus }));
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !projectId) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const result = await uploadProjectFile(projectId, formData);
      if (result.file) {
        setLiveFiles(prev => [...prev, result.file]);
        // Automatically select it once uploaded
        setSelectedFileId(result.file.id);
      }
    } catch (err) {
      console.error('Upload failed', err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (!projectId) return null;

  return (
    <Card className="shadow-sm border-0 rounded-xl overflow-hidden h-full flex flex-col mt-6">
      <CardHeader className="border-b bg-white px-6 py-5 flex flex-row items-center justify-between sticky top-0 z-10">
        <CardTitle className="text-lg font-semibold text-gray-800 flex items-center">
          <Table className="mr-2 text-indigo-500" size={20} />
          Live Milestone Tracker
        </CardTitle>
        <div className="flex items-center space-x-2">
          {csvFiles.length > 0 ? (
            <select
              className="text-sm border-gray-300 rounded-md bg-gray-50 text-gray-700 px-3 py-1.5 focus:ring-indigo-500 focus:border-indigo-500"
              value={selectedFileId}
              onChange={(e) => setSelectedFileId(e.target.value)}
              disabled={loading || uploading}
            >
              <option value="" disabled>Select a CSV...</option>
              {csvFiles.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          ) : (
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded hidden sm:inline-block">No CSVs found</span>
          )}
          
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept=".csv" 
            className="hidden" 
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center space-x-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
          >
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            <span>Upload</span>
          </button>
        </div>
      </CardHeader>
      
      <CardContent className="p-0 flex-1 overflow-auto bg-gray-50/30">
        {loading ? (
          <div className="flex flex-col items-center justify-center min-h-[300px] text-gray-400 p-8">
            <Loader2 size={32} className="animate-spin mb-4 text-indigo-500" />
            <p className="text-sm font-medium text-gray-500">Loading live data from Drive...</p>
          </div>
        ) : data.length > 0 ? (
          <div className="overflow-auto max-h-[450px]">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="text-xs text-gray-500 uppercase bg-gray-100 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-3 font-semibold border-b border-gray-200 w-10 text-center">
                    <CheckSquare size={16} className="text-gray-400 inline" />
                  </th>
                  {headers.filter(h => h !== 'task_id' && h.toLowerCase() !== 'hours').map((h, i) => (
                    <th key={i} className="px-6 py-3 font-semibold border-b border-gray-200">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(() => {
                  let foundFirstUnchecked = false;
                  return data.map((row, i) => {
                    const taskId = row['task_id'];
                    const isLinkedTask = taskId && tasksMap[taskId] !== undefined;
                    const isDone = isLinkedTask ? tasksMap[taskId] : false;
                    
                    const isUnchecked = taskId && !isDone;
                    const shouldAssignRef = isUnchecked && !foundFirstUnchecked;
                    if (shouldAssignRef) foundFirstUnchecked = true;
                    
                    return (
                      <tr 
                        key={i} 
                        ref={shouldAssignRef ? firstUncheckedRef : null}
                        className={`transition-colors ${isDone ? 'bg-emerald-50/30 text-gray-400' : 'hover:bg-white text-gray-700'}`}
                      >
                        <td className="px-6 py-3 border-r border-gray-100 bg-white sticky left-0 text-center">
                        {taskId ? (
                          <input 
                            type="checkbox"
                            checked={isDone}
                            onChange={() => handleToggleTask(taskId, isDone)}
                            className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            disabled={!isLinkedTask}
                            title={!isLinkedTask ? "Task ID not found in database" : ""}
                          />
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      {headers.filter(h => h !== 'task_id' && h.toLowerCase() !== 'hours').map((h, j) => (
                        <td key={j} className={`px-6 py-3 ${isDone ? 'line-through' : ''}`}>
                          {row[h] !== undefined && row[h] !== null ? String(row[h]) : ''}
                        </td>
                      ))}
                    </tr>
                  );
                });
              })()}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[300px] text-gray-400 p-8">
            <FileSpreadsheet size={48} className="mb-4 text-gray-300 opacity-50" />
            <p className="text-base font-medium text-gray-500">No milestone data</p>
            <p className="text-sm mt-1 mb-4">Upload a CSV file to begin tracking tasks.</p>
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
            >
              {uploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
              <span>Upload CSV Data</span>
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
