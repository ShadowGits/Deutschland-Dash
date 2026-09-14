"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { FileText, Loader2, Trash2, Edit3, Bold, Italic, Underline, List, ListOrdered, Heading2, RemoveFormatting } from 'lucide-react';
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

  // Formats the current selection in the editable box using the browser's
  // built-in commands. preventDefault on mousedown keeps the cursor in the box
  // so the button never steals focus and loses the selection.
  const exec = (command: string, value?: string) => {
    contentRef.current?.focus();
    // Emit real tags (<b>, <ul>) rather than inline styles, so the saved HTML
    // stays clean and the .rich-text rules can style it.
    try { document.execCommand('styleWithCSS', false, 'false'); } catch { /* not supported everywhere */ }
    document.execCommand(command, false, value);
  };
  // Heading acts as a toggle: pressing it inside an existing heading drops the
  // line back to a paragraph rather than doing nothing.
  const toggleHeading = () => {
    let node = window.getSelection()?.anchorNode as Node | null;
    let inHeading = false;
    while (node && node !== contentRef.current) {
      if (node.nodeType === 1 && /^H[1-6]$/.test((node as HTMLElement).tagName)) {
        inHeading = true;
        break;
      }
      node = node.parentNode;
    }
    exec('formatBlock', inHeading ? '<p>' : '<h3>');
  };

  const Tool = ({ cmd, value, title, run, children }: any) => (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => { e.preventDefault(); run ? run() : exec(cmd, value); }}
      className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
    >
      {children}
    </button>
  );

  const fileName = fileInfo?.name || widget.title || "Sticky Note";
  const isEditable = !widget.file_id;

  return (
    <Card className="shadow-sm border-0 rounded-xl overflow-hidden flex flex-col h-[400px]">
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
              <div className="flex flex-col h-full">
                <div className="flex items-center gap-0.5 px-3 py-1.5 border-b bg-gray-50/70 sticky top-0 z-10">
                  <Tool cmd="bold" title="Bold"><Bold size={16} /></Tool>
                  <Tool cmd="italic" title="Italic"><Italic size={16} /></Tool>
                  <Tool cmd="underline" title="Underline"><Underline size={16} /></Tool>
                  <span className="w-px h-5 bg-gray-200 mx-1" />
                  <Tool cmd="insertUnorderedList" title="Bulleted list"><List size={16} /></Tool>
                  <Tool cmd="insertOrderedList" title="Numbered list"><ListOrdered size={16} /></Tool>
                  <Tool run={toggleHeading} title="Heading"><Heading2 size={16} /></Tool>
                  <span className="w-px h-5 bg-gray-200 mx-1" />
                  <Tool cmd="removeFormat" title="Clear formatting"><RemoveFormatting size={16} /></Tool>
                </div>
                <div
                  ref={contentRef}
                  className="rich-text flex-1 w-full p-6 outline-none overflow-y-auto max-w-none text-gray-800"
                  contentEditable={true}
                  onBlur={handleBlur}
                  dangerouslySetInnerHTML={{ __html: content || '' }}
                />
              </div>
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
