"use client";

import React, { useState } from 'react';
import { Plus, X, LayoutDashboard, FileText, Table, MessageSquare, Loader2 } from 'lucide-react';
import { createWidgetAction } from '@/app/actions';

interface AddWidgetModalProps {
  projectId: string;
  projectFiles: any[];
  onWidgetAdded: () => void;
}

export default function AddWidgetModal({ projectId, projectFiles, onWidgetAdded }: AddWidgetModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [widgetType, setWidgetType] = useState('qna');
  const [title, setTitle] = useState('');
  const [fileId, setFileId] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAdd = async () => {
    setLoading(true);
    try {
      await createWidgetAction(projectId, {
        widget_type: widgetType,
        title: title || undefined,
        file_id: (widgetType === 'csv' || widgetType === 'text') ? fileId : undefined,
        config: {}
      });
      setIsOpen(false);
      setWidgetType('qna');
      setTitle('');
      setFileId('');
      onWidgetAdded();
    } catch (e) {
      console.error(e);
      alert('Failed to add widget');
    } finally {
      setLoading(false);
    }
  };

  const WIDGET_OPTIONS = [
    { id: 'qna', label: 'Q&A Widget', icon: <MessageSquare size={16} /> },
    { id: 'csv', label: 'CSV Display', icon: <Table size={16} /> },
    { id: 'text', label: 'Text Display', icon: <FileText size={16} /> }
  ];

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="flex items-center space-x-2 bg-white border border-gray-200 shadow-sm text-gray-700 px-4 py-2.5 rounded-xl hover:bg-gray-50 transition-colors font-medium mt-6"
      >
        <Plus size={18} />
        <span>Add Widget</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900 flex items-center space-x-2">
                <LayoutDashboard className="text-indigo-600" />
                <span>Add Widget</span>
              </h2>
              <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-full">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-6">
              <div className="space-y-3">
                <label className="text-sm font-semibold text-gray-700">Widget Type</label>
                <div className="grid grid-cols-1 gap-2">
                  {WIDGET_OPTIONS.map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => setWidgetType(opt.id)}
                      className={`flex items-center space-x-3 p-3 rounded-lg border text-left transition-colors ${
                        widgetType === opt.id 
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-medium' 
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {opt.icon}
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Title (Optional)</label>
                <input 
                  type="text" 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Custom widget title..."
                  className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50/50"
                />
              </div>

              {(widgetType === 'csv' || widgetType === 'text') && (
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">Select File</label>
                  {projectFiles.length > 0 ? (
                    <select 
                      value={fileId} 
                      onChange={(e) => setFileId(e.target.value)}
                      className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50/50"
                    >
                      <option value="" disabled>-- Select a file --</option>
                      {projectFiles.filter(f => {
                        if (widgetType === 'csv') return f.name.endsWith('.csv');
                        if (widgetType === 'text') return f.name.endsWith('.md') || f.name.endsWith('.txt');
                        return true;
                      }).map(f => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-sm text-red-500 p-3 bg-red-50 rounded-lg">No matching files uploaded to this project yet. Please upload a file first.</p>
                  )}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end space-x-3">
              <button 
                onClick={() => setIsOpen(false)}
                className="px-5 py-2.5 rounded-xl font-medium text-gray-600 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleAdd}
                disabled={loading || ((widgetType === 'csv' || widgetType === 'text') && !fileId)}
                className="px-5 py-2.5 rounded-xl font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50 flex items-center space-x-2"
              >
                {loading && <Loader2 size={16} className="animate-spin" />}
                <span>Add Widget</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
