import { supabase, tenantFilter, isDirectReadConfigured } from '@/lib/supabase';

export interface Transaction {
  id: string;
  date: string;
  description: string | null;
  amount: number;
  currency: string;
  type: 'expense' | 'income';
  category: string | null;
  merchant: string | null;
  payment_method: string | null;
  goal_id: string | null;
  recurring_id: string | null;
  notes: string | null;
}

export interface CategoryTotal {
  category: string;
  amount: number;
  sharePct: number;
}

export interface CurrencyTotals {
  currency: string;
  expense: number;
  income: number;
  net: number;
  previousExpense: number;
  changePct: number | null;
  byCategory: CategoryTotal[];
}

export interface MoneyMonth {
  month: string;
  monthLabel: string;
  transactions: Transaction[];
  currencies: CurrencyTotals[];
  configured: boolean;
}

export const EXPENSE_CATEGORIES = [
  'Food', 'Groceries', 'Transport', 'Rent', 'Utilities', 'Health',
  'Education', 'Shopping', 'Entertainment', 'Subscriptions', 'Travel',
  'Savings', 'Fees', 'Family', 'Other',
];

export const INCOME_CATEGORIES = ['Salary', 'Freelance', 'Refund', 'Gift', 'Interest', 'Other'];

const CATEGORY_EMOJI: Record<string, string> = {
  Food: '🍜', Groceries: '🛒', Transport: '🚗', Rent: '🏠', Utilities: '💡',
  Health: '💊', Education: '📚', Shopping: '🛍️', Entertainment: '🎬',
  Subscriptions: '🔁', Travel: '✈️', Savings: '🏦', Fees: '📋', Family: '👨‍👩‍👧',
  Salary: '💼', Freelance: '💻', Refund: '↩️', Gift: '🎁', Interest: '📈',
  Other: '📌',
};

export function categoryEmoji(category: string | null): string {
  return (category && CATEGORY_EMOJI[category]) || '📌';
}

/** Rupees read naturally in the Indian grouping; euros in the European one. */
export function formatMoney(amount: number, currency: string): string {
  const locale = currency === 'INR' ? 'en-IN' : 'de-DE';
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

function monthBounds(month: string) {
  const [year, mon] = month.split('-').map(Number);
  const start = new Date(Date.UTC(year, mon - 1, 1));
  const end = new Date(Date.UTC(year, mon, 0));
  const prevStart = new Date(Date.UTC(year, mon - 2, 1));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end), prevStart: iso(prevStart) };
}

export function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function summarise(rows: Transaction[], previous: Transaction[]): CurrencyTotals[] {
  const codes = Array.from(new Set(rows.map((r) => r.currency || 'INR'))).sort();

  return codes.map((code) => {
    const scoped = rows.filter((r) => (r.currency || 'INR') === code);
    const expense = scoped.filter((r) => r.type !== 'income')
      .reduce((sum, r) => sum + Number(r.amount || 0), 0);
    const income = scoped.filter((r) => r.type === 'income')
      .reduce((sum, r) => sum + Number(r.amount || 0), 0);
    const previousExpense = previous
      .filter((r) => (r.currency || 'INR') === code && r.type !== 'income')
      .reduce((sum, r) => sum + Number(r.amount || 0), 0);

    const buckets = new Map<string, number>();
    for (const row of scoped) {
      if (row.type === 'income') continue;
      const name = row.category || 'Uncategorised';
      buckets.set(name, (buckets.get(name) || 0) + Number(row.amount || 0));
    }
    const byCategory = Array.from(buckets, ([category, amount]) => ({
      category,
      amount: Math.round(amount * 100) / 100,
      sharePct: expense ? Math.round((amount / expense) * 1000) / 10 : 0,
    })).sort((a, b) => b.amount - a.amount);

    return {
      currency: code,
      expense: Math.round(expense * 100) / 100,
      income: Math.round(income * 100) / 100,
      net: Math.round((income - expense) * 100) / 100,
      previousExpense: Math.round(previousExpense * 100) / 100,
      changePct: previousExpense
        ? Math.round(((expense - previousExpense) / previousExpense) * 1000) / 10
        : null,
      byCategory,
    };
  });
}

/** One round trip covers the month on screen and the month before it, so the
 *  header can show the direction of travel without a second query. */
export async function fetchMoneyMonth(month?: string): Promise<MoneyMonth> {
  const target = month || currentMonth();
  const label = new Date(`${target}-01T00:00:00Z`).toLocaleDateString('en-GB', {
    month: 'long', year: 'numeric', timeZone: 'UTC',
  });

  if (!isDirectReadConfigured()) {
    return { month: target, monthLabel: label, transactions: [], currencies: [], configured: false };
  }

  const { start, end, prevStart } = monthBounds(target);
  const { data, error } = await tenantFilter(
    supabase().from('finance_logs').select('*')
  )
    .gte('date', prevStart)
    .lte('date', end)
    .order('date', { ascending: false });

  if (error) {
    console.error('Finance read failed:', error.message);
    return { month: target, monthLabel: label, transactions: [], currencies: [], configured: true };
  }

  const rows = (data || []) as Transaction[];
  const inMonth = rows.filter((r) => r.date >= start && r.date <= end);
  const inPrevious = rows.filter((r) => r.date < start);

  return {
    month: target,
    monthLabel: label,
    transactions: inMonth,
    currencies: summarise(inMonth, inPrevious),
    configured: true,
  };
}
