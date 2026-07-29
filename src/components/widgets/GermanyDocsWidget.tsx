'use client';

import { FileCheck, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface GermanyDocsWidgetProps {
  documents: any[];
}

export default function GermanyDocsWidget({ documents }: GermanyDocsWidgetProps) {
  return (
    <Card className="shadow-sm border-0 rounded-xl">
      <CardHeader className="border-b bg-white rounded-t-xl px-6 py-5">
        <CardTitle className="text-lg font-semibold text-gray-800 flex items-center">
          <FileCheck className="mr-2 text-blue-600" size={20} />
          Germany Document Checklist ({documents.length})
        </CardTitle>
      </CardHeader>

      <CardContent className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map((doc, idx) => {
            const isDone = doc.status?.toLowerCase() === 'done' || doc.status?.toLowerCase() === 'completed';
            
            return (
              <div
                key={doc.id || idx}
                className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <h4 className="font-semibold text-gray-900 text-sm">{doc.document}</h4>
                    {isDone ? (
                      <span className="flex items-center text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                        <CheckCircle2 size={12} className="mr-1" />
                        Done
                      </span>
                    ) : (
                      <span className="flex items-center text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                        <Clock size={12} className="mr-1" />
                        {doc.status || 'Pending'}
                      </span>
                    )}
                  </div>

                  {doc.category && (
                    <p className="text-xs text-gray-400 mt-1">{doc.category}</p>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap items-center gap-1.5">
                  {doc.needs_apostille && (
                    <Badge variant="outline" className="text-[10px] border-orange-200 bg-orange-50 text-orange-700">
                      Needs Apostille
                    </Badge>
                  )}
                  {doc.needs_translation && (
                    <Badge variant="outline" className="text-[10px] border-purple-200 bg-purple-50 text-purple-700">
                      Needs Translation
                    </Badge>
                  )}
                  {doc.deadline && (
                    <span className="text-[10px] text-gray-500 ml-auto font-medium">
                      Due: {doc.deadline}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
