"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { FileText, Loader2, Trash2, Edit3, Save } from 'lucide-react';
import { downloadProjectFile, updateWidgetAction } from '@/app/actions';

interface TextWidgetProps {
  projectId: string;
  widget: any;
  fileInfo?: any;
  onDelete: () => void;
}

export default function TextWidget({ projectId, widget, fileInfo, onDelete }: TextWidgetProps) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    
    async function loadContent() {
      if (!widget.file_id) {
        if (widget.config?.content) {
          setContent(widget.config.content);
        } else {
          setContent("<i>Click here to type...</i>");
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
  }, [projectId, widget.file_id, widget.config?.content]);

  const handleBlur = async () => {
    // Only editable if it's NOT a Google Drive file
    if (widget.file_id || !contentRef.current) return;
    
    const newHtml = contentRef.current.innerHTML;
    // Don't save if it hasn't changed from original config
    if (newHtml === (widget.config?.content || "<i>Click here to type...</i>") || newHtml === content) return;

    setIsSaving(true);
    try {
      await updateWidgetAction(widget.id, { 
        config: { ...widget.config, content: newHtml } 
      });
      setContent(newHtml);
    } catch (e) {
      console.error("Failed to save text widget", e);
    } finally {
      setIsSaving(false);
    }
  };

  const fileName = fileInfo?.name || widget.title || "Sticky Note";
  const isEditable = !widget.file_id;

  return (
    <Card className="shadow-sm border-0 rounded-xl overflow-hidden flex flex-col mt-6 h-[400px]">
      <CardHeader className="border-b bg-white px-6 py-4 flex flex-row items-center justify-between">
        <div className="flex items-center space-x-2">
          {isEditable ? <Edit3 className="text-indigo-600" size={20} /> : <FileText className="text-emerald-600" size={20} />}
          <CardTitle className="text-lg font-bold text-gray-800 flex items-center space-x-2">
            <span>{fileName}</span>
            {isSaving && <Loader2 className="animate-spin text-gray-400" size={14} />}
          </CardTitle>
        </div>
        <button
          onClick={onDelete}
          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          title="Remove Widget"
        >
          <Trash2 size={16} />
        </button>
      </CardHeader>
      
      <CardContent className="p-0 flex-1 overflow-hidden bg-white group">
        {loading ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            <Loader2 className="animate-spin" size={24} />
          </div>
        ) : (
          <div className="h-full overflow-y-auto">
            {isEditable ? (
              <div 
                ref={contentRef}
                className="w-full h-full p-6 outline-none prose prose-sm max-w-none text-gray-800"
                contentEditable={true}
                onBlur={handleBlur}
                dangerouslySetInnerHTML={{ __html: content || '' }}
              />
            ) : (
              <pre className="p-6 whitespace-pre-wrap text-sm text-gray-700 font-mono">
                {content}
              </pre>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
