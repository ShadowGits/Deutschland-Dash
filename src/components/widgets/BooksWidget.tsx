'use client';

import { BookOpenCheck, Bookmark } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface BooksWidgetProps {
  books: any[];
}

export default function BooksWidget({ books }: BooksWidgetProps) {
  return (
    <Card className="shadow-sm border-0 rounded-xl">
      <CardHeader className="border-b bg-white rounded-t-xl px-6 py-5">
        <CardTitle className="text-lg font-semibold text-gray-800 flex items-center">
          <BookOpenCheck className="mr-2 text-emerald-600" size={20} />
          Reading & Book Tracker ({books.length})
        </CardTitle>
      </CardHeader>

      <CardContent className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {books.map((b, idx) => {
            const pct = Math.min(100, Math.max(0, b.completion_pct || 0));
            return (
              <div
                key={b.id || idx}
                className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <h4 className="font-semibold text-gray-900 text-base">{b.book}</h4>
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                      {pct}%
                    </span>
                  </div>
                  {b.chapter && (
                    <p className="text-xs text-gray-500 mt-1 flex items-center">
                      <Bookmark size={13} className="mr-1 text-gray-400" />
                      Chapter: {b.chapter}
                    </p>
                  )}
                  {b.notes && (
                    <p className="text-xs text-gray-600 mt-2 bg-gray-50 p-2.5 rounded-lg border border-gray-100 italic">
                      "{b.notes}"
                    </p>
                  )}
                </div>

                {/* Progress Bar */}
                <div className="mt-4">
                  <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
