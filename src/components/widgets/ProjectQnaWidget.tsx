"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Loader2, Plus, Edit2, Trash2, Check, X, MessageSquare, AlertCircle } from 'lucide-react';
import { fetchProjectTable, createProjectQna, updateProjectQna, deleteProjectQna } from '@/lib/api';

export default function ProjectQnaWidget({ projectId }: { projectId: string }) {
  const [qnas, setQnas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [status, setStatus] = useState("Drafting");

  const loadData = async () => {
    try {
      const data = await fetchProjectTable(projectId, "project_qna");
      setQnas(data || []);
    } catch (e) {
      console.error("Failed to fetch QnAs", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [projectId]);

  const handleSave = async (id?: string) => {
    if (!question.trim()) return;
    try {
      if (id) {
        await updateProjectQna(id, { question, answer, status });
        setEditingId(null);
      } else {
        await createProjectQna(projectId, { question, answer, status });
        setIsAdding(false);
      }
      loadData();
      setQuestion("");
      setAnswer("");
      setStatus("Drafting");
    } catch (e) {
      console.error("Failed to save QnA", e);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this QnA?")) return;
    try {
      await deleteProjectQna(id);
      loadData();
    } catch (e) {
      console.error("Failed to delete QnA", e);
    }
  };

  const startEdit = (q: any) => {
    setEditingId(q.id);
    setQuestion(q.question || "");
    setAnswer(q.answer || "");
    setStatus(q.status || "Drafting");
    setIsAdding(false);
  };

  if (loading) {
    return (
      <Card className="shadow-sm border-0 rounded-xl mt-6">
        <CardContent className="p-8 flex justify-center text-gray-400">
          <Loader2 className="animate-spin" size={24} />
        </CardContent>
      </Card>
    );
  }

  // Only show if there are QnAs, or we are specifically allowed to add them.
  // We'll show the widget always so the user can add the first QnA.

  return (
    <Card className="shadow-sm border-0 rounded-xl overflow-hidden flex flex-col mt-6">
      <CardHeader className="border-b bg-white px-6 py-4 flex flex-row items-center justify-between">
        <div className="flex items-center space-x-2">
          <MessageSquare className="text-indigo-600" size={20} />
          <CardTitle className="text-lg font-bold text-gray-800">Q & A</CardTitle>
        </div>
        <button
          onClick={() => {
            setIsAdding(true);
            setEditingId(null);
            setQuestion("");
            setAnswer("");
            setStatus("Drafting");
          }}
          className="flex items-center space-x-1 text-sm bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors font-medium"
        >
          <Plus size={16} />
          <span>Add Question</span>
        </button>
      </CardHeader>
      
      <CardContent className="p-0">
        {qnas.length === 0 && !isAdding && (
          <div className="p-8 text-center text-gray-500 flex flex-col items-center">
            <AlertCircle className="text-gray-300 mb-2" size={32} />
            <p>No questions yet. Click "Add Question" to start building your QnA.</p>
          </div>
        )}

        <div className="divide-y divide-gray-100">
          {/* Add Form */}
          {isAdding && (
            <div className="p-6 bg-indigo-50/50">
              <div className="space-y-4">
                <input 
                  type="text" 
                  placeholder="Question..." 
                  className="w-full p-3 border border-indigo-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  autoFocus
                />
                <textarea 
                  placeholder="Draft your answer here..." 
                  className="w-full p-3 border border-indigo-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[120px]"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                />
                <div className="flex items-center justify-between">
                  <select 
                    value={status} 
                    onChange={(e) => setStatus(e.target.value)}
                    className="p-2 border border-gray-200 rounded-lg text-sm bg-white"
                  >
                    <option value="Drafting">Drafting</option>
                    <option value="Ready">Ready</option>
                    <option value="Needs Review">Needs Review</option>
                  </select>
                  <div className="flex space-x-2">
                    <button onClick={() => setIsAdding(false)} className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-lg">Cancel</button>
                    <button onClick={() => handleSave()} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center space-x-1">
                      <Check size={16} />
                      <span>Save Question</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* List QnAs */}
          {qnas.map(q => (
            <div key={q.id}>
              {editingId === q.id ? (
                <div className="p-6 bg-gray-50">
                  <div className="space-y-4">
                    <input 
                      type="text" 
                      className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                    />
                    <textarea 
                      className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[120px]"
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                    />
                    <div className="flex items-center justify-between">
                      <select 
                        value={status} 
                        onChange={(e) => setStatus(e.target.value)}
                        className="p-2 border border-gray-200 rounded-lg text-sm bg-white"
                      >
                        <option value="Drafting">Drafting</option>
                        <option value="Ready">Ready</option>
                        <option value="Needs Review">Needs Review</option>
                      </select>
                      <div className="flex space-x-2">
                        <button onClick={() => setEditingId(null)} className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-lg">Cancel</button>
                        <button onClick={() => handleSave(q.id)} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Save</button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-6 hover:bg-gray-50 transition-colors group">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="text-lg font-semibold text-gray-900 mb-2">{q.question}</h4>
                      {q.answer ? (
                        <p className="text-gray-600 whitespace-pre-wrap text-sm leading-relaxed">{q.answer}</p>
                      ) : (
                        <p className="text-gray-400 italic text-sm">No answer drafted yet.</p>
                      )}
                      <div className="mt-4 flex items-center space-x-2">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                          q.status === 'Ready' ? 'bg-green-100 text-green-700' : 
                          q.status === 'Needs Review' ? 'bg-amber-100 text-amber-700' : 
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {q.status || 'Drafting'}
                        </span>
                      </div>
                    </div>
                    
                    {/* Action buttons (fade in on hover) */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1 ml-4">
                      <button onClick={() => startEdit(q)} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => handleDelete(q.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
