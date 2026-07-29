'use client';

import { X, ExternalLink, FileText, Table } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DocumentViewerModalProps {
  file: {
    name: string;
    file_type: string;
    drive_embed_link?: string;
    drive_web_view_link?: string;
  } | null;
  onClose: () => void;
}

export default function DocumentViewerModal({ file, onClose }: DocumentViewerModalProps) {
  if (!file) return null;

  const Icon = file.file_type === 'excel' ? Table : FileText;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 md:p-8 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-5xl h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b bg-gray-50 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg ${file.file_type === 'excel' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>
              <Icon size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-lg">{file.name}</h3>
              <p className="text-xs text-gray-500 capitalize">{file.file_type} Document</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {file.drive_web_view_link && file.drive_web_view_link !== '#' && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs flex items-center space-x-1.5 border-gray-300 hover:bg-gray-100"
                onClick={() => window.open(file.drive_web_view_link, '_blank')}
              >
                <span>Open in Drive</span>
                <ExternalLink size={14} />
              </Button>
            )}
            
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Embedded Viewer iFrame */}
        <div className="flex-1 bg-gray-100 relative overflow-hidden">
          {file.drive_embed_link && file.drive_embed_link !== '#' ? (
            <iframe
              src={file.drive_embed_link}
              className="w-full h-full border-0"
              title={file.name}
              allow="autoplay"
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 p-8 text-center">
              <Icon size={48} className="mb-4 text-gray-300" />
              <p className="text-base font-medium">Inline preview not configured for this file.</p>
              <p className="text-sm text-gray-400 mt-1">Make sure your Google Service Account environment variables are configured.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
