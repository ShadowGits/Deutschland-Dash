"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { FileText, Loader2, Trash2 } from 'lucide-react';
import { downloadProjectFile } from '@/app/actions';

interface TextWidgetProps {
  projectId: string;
  widget: any;
  fileInfo?: any;
  onDelete: () => void;
}

export default function TextWidget({ projectId, widget, fileInfo, onDelete }: TextWidgetProps) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    
    async function loadContent() {
      if (!widget.file_id) {
        if (widget.config?.content) {
          setContent(widget.config.content);
        } else {
          setContent("No file or text provided.");
        }
        setLoading(false);
        return;
      }
      
      try {
        const text = await downloadProjectFile(projectId, widget.file_id);
        if (mounted) {
          setContent(text || "Could not load file content.");
        }
      } catch (e) {
        if (mounted) {
          setContent("Failed to load file.");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }
    
    loadContent();
    return () => { mounted = false; };
  }, [projectId, widget.file_id]);

  const fileName = fileInfo?.name || widget.title || "Text Document";

  return (
    <Card className="shadow-sm border-0 rounded-xl overflow-hidden flex flex-col mt-6 h-[400px]">
      <CardHeader className="border-b bg-white px-6 py-4 flex flex-row items-center justify-between">
        <div className="flex items-center space-x-2">
          <FileText className="text-emerald-600" size={20} />
          <CardTitle className="text-lg font-bold text-gray-800">{fileName}</CardTitle>
        </div>
        <button
          onClick={onDelete}
          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          title="Remove Widget"
        >
          <Trash2 size={16} />
        </button>
      </CardHeader>
      
      <CardContent className="p-0 flex-1 overflow-hidden bg-gray-50/50">
        {loading ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            <Loader2 className="animate-spin" size={24} />
          </div>
        ) : (
          <div className="p-6 h-full overflow-y-auto">
            <pre className="whitespace-pre-wrap text-sm text-gray-700 font-mono">
              {content}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
