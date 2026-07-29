'use client';

import { useState } from 'react';
import { BookOpen, GraduationCap, CheckCircle, Clock, Star } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface StudyWidgetProps {
  topics: any[];
}

export default function StudyWidget({ topics }: StudyWidgetProps) {
  const [selectedSubject, setSelectedSubject] = useState<string>('All');

  const subjects = ['All', ...Array.from(new Set(topics.map(t => t.subject).filter(Boolean)))];

  const filteredTopics = selectedSubject === 'All' 
    ? topics 
    : topics.filter(t => t.subject === selectedSubject);

  return (
    <Card className="shadow-sm border-0 rounded-xl">
      <CardHeader className="border-b bg-white rounded-t-xl px-6 py-5 flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold text-gray-800 flex items-center">
          <BookOpen className="mr-2 text-indigo-600" size={20} />
          Study Curriculum & Topics ({filteredTopics.length})
        </CardTitle>

        {/* Filter Pills */}
        <div className="flex flex-wrap gap-1.5">
          {subjects.map(subj => (
            <button
              key={subj}
              onClick={() => setSelectedSubject(subj)}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                selectedSubject === subj
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {subj}
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTopics.map((topic, idx) => (
            <div
              key={topic.id || idx}
              className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold text-indigo-600 uppercase tracking-wider bg-indigo-50 px-2.5 py-0.5 rounded-full">
                    {topic.subject}
                  </span>
                  <Badge variant="outline" className="text-[10px] capitalize border-gray-300">
                    {topic.difficulty || 'Medium'}
                  </Badge>
                </div>

                <h4 className="font-semibold text-gray-900 text-sm mb-1">{topic.topic}</h4>
                <p className="text-xs text-gray-500 mb-3">{topic.unit}</p>
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center space-x-1 text-amber-500">
                  <Star size={14} className="fill-amber-400" />
                  <span className="font-medium">{topic.confidence || 1}/5</span>
                </div>

                <div className="flex items-center space-x-1">
                  <Clock size={13} className="text-gray-400" />
                  <span>{topic.hours_spent || 0} hrs</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
