'use client';

import { useState } from 'react';
import { FileText, Table, Plus, Trash2, Eye, ExternalLink, Loader2, Folder } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createProjectDocument, deleteProjectFile } from '@/app/actions';

interface ProjectFilesWidgetProps {
  projectId: string;
  files: any[];
  onViewFile: (file: any) => void;
}

export default function ProjectFilesWidget({ projectId, files: initialFiles, onViewFile }: ProjectFilesWidgetProps) {
  const [files, setFiles] = useState<any[]>(initialFiles || []);
  const [isCreating, setIsCreating] = useState(false);
  const [docType, setDocType] = useState<'text' | 'excel'>('text');
  const [docName, setDocName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!docName.trim()) return;
    setLoading(true);

    try {
      const newFile = await createProjectDocument(projectId, docName.trim(), docType);
      if (newFile) {
        setFiles(prev => [...prev, newFile]);
        setDocName('');
        setIsCreating(false);
      }
    } catch (err) {
      console.error("Failed to create document", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (fileId: string) => {
    try {
      const success = await deleteProjectFile(projectId, fileId);
      if (success) {
        setFiles(prev => prev.filter(f => f.id !== fileId));
      }
    } catch (err) {
      console.error("Failed to delete file", err);
    }
  };

  return (
    <div className="space-y-4">
      {/* Action Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-50/80 p-4 rounded-xl border border-gray-100">
        <div className="flex items-center space-x-2 text-gray-700 font-medium text-sm">
          <Folder size={18} className="text-emerald-500" />
          <span>Google Drive Project Files ({files.length})</span>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            size="sm"
            variant="outline"
            className="text-xs bg-white text-blue-600 border-blue-200 hover:bg-blue-50"
            onClick={() => {
              setDocType('text');
              setDocName('');
              setIsCreating(true);
            }}
          >
            <Plus size={14} className="mr-1" />
            + Text Doc
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="text-xs bg-white text-emerald-600 border-emerald-200 hover:bg-emerald-50"
            onClick={() => {
              setDocType('excel');
              setDocName('');
              setIsCreating(true);
            }}
          >
            <Plus size={14} className="mr-1" />
            + Spreadsheet
          </Button>
        </div>
      </div>

      {/* Inline Create Form Modal/Box */}
      {isCreating && (
        <div className="p-4 bg-white border border-gray-200 rounded-xl shadow-sm space-y-3 animate-in fade-in">
          <h4 className="text-sm font-semibold text-gray-800">
            Create New {docType === 'excel' ? 'Google Sheet Spreadsheet' : 'Google Doc Text Document'}
          </h4>
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder={docType === 'excel' ? "e.g., Budget Tracker" : "e.g., Meeting Notes"}
              value={docName}
              onChange={e => setDocName(e.target.value)}
              className="text-sm"
              autoFocus
            />
            <Button 
              size="sm" 
              onClick={handleCreate} 
              disabled={loading || !docName.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : "Create"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setIsCreating(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Files List */}
      {files.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {files.map(file => {
            const isExcel = file.file_type === 'excel';
            const Icon = isExcel ? Table : FileText;

            return (
              <div
                key={file.id}
                className="group bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all flex flex-col justify-between"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3 overflow-hidden">
                    <div className={`p-2.5 rounded-lg flex-shrink-0 ${isExcel ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                      <Icon size={20} />
                    </div>
                    <div className="truncate">
                      <p className="font-semibold text-gray-800 text-sm truncate" title={file.name}>
                        {file.name}
                      </p>
                      <p className="text-[11px] text-gray-400 capitalize">
                        {file.file_type === 'excel' ? 'Google Sheet' : 'Google Doc'}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDelete(file.id)}
                    className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                    title="Delete File"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="w-full text-xs h-8 font-medium bg-gray-100 hover:bg-emerald-50 hover:text-emerald-700 text-gray-700"
                    onClick={() => onViewFile(file)}
                  >
                    <Eye size={14} className="mr-1.5" />
                    Preview in Dash
                  </Button>

                  {file.drive_web_view_link && file.drive_web_view_link !== '#' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs h-8 text-gray-500 hover:text-gray-900 px-2"
                      onClick={() => window.open(file.drive_web_view_link, '_blank')}
                      title="Open in Drive Tab"
                    >
                      <ExternalLink size={14} />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-8 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
          <Folder size={32} className="mx-auto text-gray-300 mb-2" />
          <p className="text-sm font-medium text-gray-500">No project files yet.</p>
          <p className="text-xs text-gray-400 mt-1">Create a text doc or spreadsheet above to automatically organize your project in Google Drive!</p>
        </div>
      )}
    </div>
  );
}
