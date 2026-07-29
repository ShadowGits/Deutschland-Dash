'use client';

import { DollarSign, PiggyBank } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface FinanceGoalsWidgetProps {
  goals: any[];
}

export default function FinanceGoalsWidget({ goals }: FinanceGoalsWidgetProps) {
  return (
    <Card className="shadow-sm border-0 rounded-xl">
      <CardHeader className="border-b bg-white rounded-t-xl px-6 py-5">
        <CardTitle className="text-lg font-semibold text-gray-800 flex items-center">
          <PiggyBank className="mr-2 text-emerald-600" size={20} />
          Finance & Savings Goals ({goals.length})
        </CardTitle>
      </CardHeader>

      <CardContent className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {goals.map((g, idx) => {
            const target = Number(g.target_amount || 0);
            const saved = Number(g.saved_amount || 0);
            const pct = target > 0 ? Math.min(100, Math.round((saved / target) * 100)) : 0;

            return (
              <div
                key={g.id || idx}
                className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <h4 className="font-semibold text-gray-900 text-base">{g.goal}</h4>
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                      {pct}%
                    </span>
                  </div>

                  <div className="mt-3 flex items-baseline justify-between">
                    <span className="text-2xl font-bold text-gray-800">€{saved.toLocaleString()}</span>
                    <span className="text-xs text-gray-400 font-medium">Target: €{target.toLocaleString()}</span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-4">
                  <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
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
