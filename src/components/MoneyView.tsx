'use client';

import { useState, useTransition } from 'react';
import {
  ChevronLeft, ChevronRight, Plus, Repeat, TrendingDown, TrendingUp,
  Rows3, List, Trash2, X,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import {
  categoryEmoji, formatMoney, EXPENSE_CATEGORIES, INCOME_CATEGORIES,
  type MoneyMonth, type Transaction, type CurrencyTotals,
} from '@/lib/finance';
import {
  createTransaction, updateTransaction, deleteTransaction, loadMoneyMonth,
} from '@/app/finance-actions';

/* The passbook. Entry happens by telling Claude what you spent, so this screen
   is built for reading a month back and correcting the odd row — not for bulk
   data entry. Table mode covers the times you do want a grid. */

const BAR_COLOURS = [
  'bg-emerald-500', 'bg-sky-500', 'bg-violet-500', 'bg-amber-500',
  'bg-rose-500', 'bg-teal-500', 'bg-indigo-500', 'bg-orange-500',
];

function shiftMonth(month: string, by: number): string {
  const [year, mon] = month.split('-').map(Number);
  const d = new Date(Date.UTC(year, mon - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function dayLabel(iso: string): string {
  const today = new Date();
  const asUtc = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  if (iso === asUtc(today)) return 'Today';
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (iso === asUtc(yesterday)) return 'Yesterday';
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
  });
}

function groupByDate(rows: Transaction[]): [string, Transaction[]][] {
  const groups = new Map<string, Transaction[]>();
  for (const row of rows) {
    const bucket = groups.get(row.date) || [];
    bucket.push(row);
    groups.set(row.date, bucket);
  }
  return Array.from(groups.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
}

function SummaryCard({ totals }: { totals: CurrencyTotals }) {
  const up = totals.changePct !== null && totals.changePct > 0;
  const flat = totals.changePct === null || totals.changePct === 0;

  return (
    <Card className="shadow-sm border-0 rounded-xl">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">
              Spent · {totals.currency}
            </p>
            <h3 className="text-3xl font-bold text-gray-800">
              {formatMoney(totals.expense, totals.currency)}
            </h3>
          </div>
          {!flat && (
            <span
              className={`flex items-center text-xs font-semibold px-2.5 py-1 rounded-full ${
                up ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'
              }`}
            >
              {up ? <TrendingUp size={13} className="mr-1" /> : <TrendingDown size={13} className="mr-1" />}
              {Math.abs(totals.changePct as number)}%
            </span>
          )}
        </div>

        <p className="text-xs text-gray-400 mt-1">
          {totals.previousExpense
            ? `Last month ${formatMoney(totals.previousExpense, totals.currency)}`
            : 'No spending last month'}
        </p>

        {totals.income > 0 && (
          <div className="mt-4 pt-4 border-t flex items-center justify-between text-sm">
            <span className="text-gray-500">
              In {formatMoney(totals.income, totals.currency)}
            </span>
            <span className={`font-semibold ${totals.net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {totals.net >= 0 ? 'Saved ' : 'Over by '}
              {formatMoney(Math.abs(totals.net), totals.currency)}
            </span>
          </div>
        )}

        {totals.byCategory.length > 0 && (
          <div className="mt-5 space-y-2.5">
            {totals.byCategory.slice(0, 6).map((cat, idx) => (
              <div key={cat.category}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-gray-600 font-medium">
                    {categoryEmoji(cat.category)} {cat.category}
                  </span>
                  <span className="text-gray-400">
                    {formatMoney(cat.amount, totals.currency)}
                  </span>
                </div>
                <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`${BAR_COLOURS[idx % BAR_COLOURS.length]} h-full rounded-full transition-all duration-500`}
                    style={{ width: `${Math.max(cat.sharePct, 1.5)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** What the form edits — narrower than Transaction so a saved row always
 *  carries a real description and amount. */
interface RowFormValues {
  date: string;
  description: string;
  amount: number;
  currency: string;
  type: 'expense' | 'income';
  category: string | null;
  merchant: string | null;
}

interface RowFormProps {
  initial: Partial<Transaction>;
  saving: boolean;
  onSave: (values: RowFormValues) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

function RowForm({ initial, saving, onSave, onCancel, onDelete }: RowFormProps) {
  const [values, setValues] = useState<RowFormValues>({
    date: initial.date || new Date().toISOString().slice(0, 10),
    description: initial.description || '',
    amount: Number(initial.amount ?? 0),
    currency: initial.currency || 'INR',
    type: initial.type || 'expense',
    category: initial.category || null,
    merchant: initial.merchant || null,
  });

  const set = (patch: Partial<RowFormValues>) => setValues((v) => ({ ...v, ...patch }));
  const categories = values.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input
          type="text"
          value={values.description as string}
          onChange={(e) => set({ description: e.target.value })}
          placeholder="What was it?"
          className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          autoFocus
        />
        <div className="flex gap-2">
          <select
            value={values.currency as string}
            onChange={(e) => set({ currency: e.target.value })}
            className="px-2 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="INR">₹</option>
            <option value="EUR">€</option>
          </select>
          <input
            type="number"
            min="0"
            step="0.01"
            value={values.amount as number}
            onChange={(e) => set({ amount: Number(e.target.value) })}
            placeholder="Amount"
            className="flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <select
          value={values.type as string}
          onChange={(e) => set({ type: e.target.value as 'expense' | 'income', category: null })}
          className="px-3 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="expense">Spent</option>
          <option value="income">Received</option>
        </select>
        <select
          value={values.category || ''}
          onChange={(e) => set({ category: e.target.value || null })}
          className="px-3 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="">No category</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <input
          type="date"
          value={values.date as string}
          onChange={(e) => set({ date: e.target.value })}
          className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      <div className="flex items-center justify-between pt-1">
        <div>
          {onDelete && (
            <button
              onClick={onDelete}
              disabled={saving}
              className="flex items-center text-sm text-rose-600 hover:text-rose-700 disabled:opacity-50"
            >
              <Trash2 size={14} className="mr-1.5" />
              Delete
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            disabled={saving}
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(values)}
            disabled={saving || !String(values.description).trim() || !(Number(values.amount) > 0)}
            className="px-4 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MoneyView({ initial }: { initial: MoneyMonth }) {
  const [data, setData] = useState<MoneyMonth>(initial);
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [tableMode, setTableMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const refresh = (month: string) => {
    startTransition(async () => {
      setData(await loadMoneyMonth(month));
      setEditing(null);
      setAdding(false);
    });
  };

  const save = (id: string | null, values: RowFormValues) => {
    setError(null);
    startTransition(async () => {
      const result = id
        ? await updateTransaction(id, values)
        : await createTransaction(values);
      if (!result.ok) {
        setError(result.error || 'Could not save');
        return;
      }
      setData(await loadMoneyMonth(data.month));
      setEditing(null);
      setAdding(false);
    });
  };

  const remove = (id: string) => {
    setError(null);
    startTransition(async () => {
      const result = await deleteTransaction(id);
      if (!result.ok) {
        setError(result.error || 'Could not delete');
        return;
      }
      setData(await loadMoneyMonth(data.month));
      setEditing(null);
    });
  };

  if (!data.configured) {
    return (
      <Card className="shadow-sm border-0 rounded-xl">
        <CardContent className="p-8 text-center text-gray-500">
          <p className="font-medium text-gray-700 mb-2">Money is not connected yet</p>
          <p className="text-sm">
            Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PLANNER_USER_ID and
            PLANNER_WORKSPACE_ID in the dashboard environment to switch this
            screen on.
          </p>
        </CardContent>
      </Card>
    );
  }

  const groups = groupByDate(data.transactions);

  return (
    <div className="space-y-6">
      {/* Month bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => refresh(shiftMonth(data.month, -1))}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
            aria-label="Previous month"
          >
            <ChevronLeft size={18} />
          </button>
          <h2 className="text-lg font-semibold text-gray-800 min-w-[150px] text-center">
            {data.monthLabel}
          </h2>
          <button
            onClick={() => refresh(shiftMonth(data.month, 1))}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
            aria-label="Next month"
          >
            <ChevronRight size={18} />
          </button>
          {pending && <span className="text-xs text-gray-400 ml-2">Loading…</span>}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setTableMode((v) => !v)}
            className="flex items-center px-3 py-1.5 text-sm text-gray-600 border rounded-lg hover:bg-gray-50"
          >
            {tableMode ? <List size={14} className="mr-1.5" /> : <Rows3 size={14} className="mr-1.5" />}
            {tableMode ? 'Passbook' : 'Table'}
          </button>
          <button
            onClick={() => { setAdding(true); setEditing(null); }}
            className="flex items-center px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
          >
            <Plus size={14} className="mr-1.5" />
            Add
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center justify-between bg-rose-50 text-rose-700 text-sm px-4 py-3 rounded-lg">
          {error}
          <button onClick={() => setError(null)}><X size={14} /></button>
        </div>
      )}

      {/* Summary */}
      {data.currencies.length > 0 && (
        <div className={`grid grid-cols-1 gap-6 ${data.currencies.length > 1 ? 'lg:grid-cols-2' : ''}`}>
          {data.currencies.map((totals) => (
            <SummaryCard key={totals.currency} totals={totals} />
          ))}
        </div>
      )}

      {adding && (
        <RowForm
          initial={{ date: new Date().toISOString().slice(0, 10) }}
          saving={pending}
          onSave={(values) => save(null, values)}
          onCancel={() => setAdding(false)}
        />
      )}

      {/* Passbook */}
      <Card className="shadow-sm border-0 rounded-xl">
        <CardContent className="p-0">
          {data.transactions.length === 0 ? (
            <div className="p-10 text-center text-gray-500">
              <p className="font-medium text-gray-700 mb-1">Nothing logged this month</p>
              <p className="text-sm">Tell Claude what you spent, or add a row here.</p>
            </div>
          ) : tableMode ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="text-left font-semibold px-6 py-3">Date</th>
                    <th className="text-left font-semibold px-6 py-3">Description</th>
                    <th className="text-left font-semibold px-6 py-3">Category</th>
                    <th className="text-right font-semibold px-6 py-3">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.transactions.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => setEditing(row.id)}
                      className="hover:bg-gray-50 cursor-pointer"
                    >
                      <td className="px-6 py-3 text-gray-500 whitespace-nowrap">
                        {new Date(`${row.date}T00:00:00Z`).toLocaleDateString('en-GB', {
                          day: '2-digit', month: 'short', timeZone: 'UTC',
                        })}
                      </td>
                      <td className="px-6 py-3 text-gray-800">
                        {row.description}
                        {row.recurring_id && (
                          <Repeat size={12} className="inline ml-2 text-gray-400" />
                        )}
                      </td>
                      <td className="px-6 py-3 text-gray-500">
                        {row.category ? `${categoryEmoji(row.category)} ${row.category}` : '—'}
                      </td>
                      <td
                        className={`px-6 py-3 text-right font-semibold whitespace-nowrap ${
                          row.type === 'income' ? 'text-emerald-600' : 'text-gray-800'
                        }`}
                      >
                        {row.type === 'income' ? '+' : ''}
                        {formatMoney(Number(row.amount), row.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="divide-y">
              {groups.map(([day, rows]) => (
                <div key={day}>
                  <div className="px-6 py-2.5 bg-gray-50 flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      {dayLabel(day)}
                    </span>
                    <span className="text-xs text-gray-400">
                      {rows
                        .filter((r) => r.type !== 'income')
                        .reduce((sum, r) => sum + Number(r.amount || 0), 0) > 0 &&
                        formatMoney(
                          rows.filter((r) => r.type !== 'income')
                            .reduce((sum, r) => sum + Number(r.amount || 0), 0),
                          rows[0].currency
                        )}
                    </span>
                  </div>

                  {rows.map((row) =>
                    editing === row.id ? (
                      <div key={row.id} className="p-4">
                        <RowForm
                          initial={row}
                          saving={pending}
                          onSave={(values) => save(row.id, values)}
                          onCancel={() => setEditing(null)}
                          onDelete={() => remove(row.id)}
                        />
                      </div>
                    ) : (
                      <button
                        key={row.id}
                        onClick={() => { setEditing(row.id); setAdding(false); }}
                        className="w-full flex items-center px-6 py-3.5 hover:bg-gray-50 text-left transition-colors"
                      >
                        <div className="h-9 w-9 rounded-full bg-gray-100 flex items-center justify-center text-base flex-shrink-0">
                          {categoryEmoji(row.category)}
                        </div>
                        <div className="ml-3.5 min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-800 truncate">
                            {row.description}
                            {row.recurring_id && (
                              <Repeat size={12} className="inline ml-2 text-gray-400" />
                            )}
                          </p>
                          <p className="text-xs text-gray-400 truncate">
                            {[row.category, row.merchant, row.payment_method]
                              .filter(Boolean)
                              .join(' · ') || 'Uncategorised'}
                          </p>
                        </div>
                        <span
                          className={`ml-3 text-sm font-semibold whitespace-nowrap ${
                            row.type === 'income' ? 'text-emerald-600' : 'text-gray-800'
                          }`}
                        >
                          {row.type === 'income' ? '+' : ''}
                          {formatMoney(Number(row.amount), row.currency)}
                        </span>
                      </button>
                    )
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
