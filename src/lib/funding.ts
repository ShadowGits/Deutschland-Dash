import {
  supabase, tenantFilter, isDirectReadConfigured, activeWorkspaceId, USER_ID,
} from '@/lib/supabase';
import type { Transaction } from '@/lib/finance';

/* The funding plan: what the move costs, what pays for it, and whether the
 * money is there in time.
 *
 * The rows are read straight from Postgres, like the money screen, so the
 * screen paints without waiting on a Cloud Run cold start. The arithmetic
 * below is deliberately a transliteration of FinanceService.plan_overview in
 * planner_core/services.py — same names, same rules — because Claude answers
 * the same questions conversationally through the MCP tools. Change one and
 * change the other, or the two will start disagreeing about the loan.
 */

export type PlanKind = 'cost' | 'fund';
export type Certainty = 'confirmed' | 'likely' | 'maybe';

export interface PlanRow {
  id: string;
  name: string;
  base_currency: string;
  eur_rate: number;
  notes: string | null;
}

export interface PlanItemRow {
  id: string;
  plan_id: string;
  kind: PlanKind;
  label: string;
  category: string | null;
  amount: number;
  currency: string;
  due_date: string | null;
  instalments: number;
  certainty: Certainty;
  notes: string | null;
  sort_order: number;
}

/** A plan line with what has actually moved against it folded in. */
export interface PlanItem extends PlanItemRow {
  /** amount x instalments, in the plan's base currency. */
  estimate: number;
  /** Spent (a cost) or received (a funding line), in base currency. */
  settled: number;
  outstanding: number;
  /** How far past the estimate this went. Deliberately not folded into
   *  outstanding or the gap — the extra has already left the account, so it
   *  belongs against the cash-in-hand line rather than being counted twice.
   *  Reported on its own so overspending is loud instead of silent. */
  overBy: number;
  progressPct: number;
}

export interface PlanMonth {
  month: string;
  inflow: number;
  outflow: number;
  balance: number;
}

export interface PlanTotals {
  baseCurrency: string;
  eurRate: number;
  costEstimate: number;
  costPaid: number;
  costOutstanding: number;
  costOverspend: number;
  fundExpected: number;
  fundReceived: number;
  fundOutstanding: number;
  /** Is there enough money at all? Negative means a real shortfall. */
  gap: number;
  /** The worst the running balance ever gets — the bridge, even when funded. */
  loanNeeded: number;
  loanByMonth: string | null;
  status: 'green' | 'amber' | 'red';
  headline: string;
  unconvertible: string[];
}

export interface PlanView {
  costs: PlanItem[];
  funds: PlanItem[];
  totals: PlanTotals;
  openingBalance: number;
  months: PlanMonth[];
  undatedCosts: PlanItem[];
}

export interface FundingData {
  configured: boolean;
  plan: PlanRow | null;
  items: PlanItemRow[];
  /** Everything already attributed to a plan line. */
  linked: Transaction[];
  /** Recent spending with no plan line yet, offered for one-click attribution. */
  unlinked: Transaction[];
}

export const PLAN_COST_CATEGORIES = [
  'Tests', 'Tuition', 'Applications', 'Courses', 'Documents',
  'Visa', 'Travel', 'Living', 'Family', 'Other',
];

export const PLAN_FUND_CATEGORIES = [
  'Savings', 'Salary', 'Family', 'Sale', 'Scholarship', 'Loan', 'Other',
];

const CATEGORY_EMOJI: Record<string, string> = {
  Tests: '📝', Tuition: '🎓', Applications: '📮', Courses: '📚', Documents: '📄',
  Visa: '🛂', Travel: '✈️', Living: '🏠', Family: '👨‍👩‍👧',
  Savings: '🏦', Salary: '💼', Sale: '🏷️', Scholarship: '🎖️', Loan: '🏛️',
  Other: '📌',
};

export function planCategoryEmoji(category: string | null): string {
  return (category && CATEGORY_EMOJI[category]) || '📌';
}

/** A rupee either side of a total is rounding, not a shortfall. */
const EPSILON = 1;

/* ------------------------------------------------------------------ dates */

export function todayIso(): string {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
}

/** The same day in a later month, clamped so the 31st still lands in February. */
function addMonths(iso: string, months: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  const anchor = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(
    Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0)
  ).getUTCDate();
  anchor.setUTCDate(Math.min(day, lastDay));
  return anchor.toISOString().slice(0, 10);
}

export function monthLabel(month: string): string {
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-GB', {
    month: 'short', year: '2-digit', timeZone: 'UTC',
  });
}

export function dateLabel(iso: string | null): string {
  if (!iso) return '—';
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: '2-digit', timeZone: 'UTC',
  });
}

/* -------------------------------------------------------------- currency */

/** Put one line onto the plan's base currency at the plan's own rate.
 *
 *  Only the euro/rupee pair converts: those are the two the move is priced in,
 *  and inventing a rate for a third would put a number on screen nobody could
 *  reproduce later. Anything else passes through and is reported instead. */
export function toBase(
  amount: number, from: string | null, base: string, eurRate: number
): number {
  const src = (from || base).toUpperCase();
  const dst = (base || 'INR').toUpperCase();
  if (src === dst) return round(amount);
  if (src === 'EUR' && dst === 'INR') return round(amount * eurRate);
  if (src === 'INR' && dst === 'EUR' && eurRate) return round(amount / eurRate);
  return round(amount);
}

const round = (n: number) => Math.round(n * 100) / 100;

/** Short form for axis labels, where the full grouping will not fit. Rupees
 *  read in lakh and crore; everything else in thousands and millions. */
export function compactMoney(amount: number, currency: string): string {
  const sign = amount < 0 ? '-' : '';
  const value = Math.abs(amount);
  const symbol = currency === 'INR' ? '₹' : currency === 'EUR' ? '€' : '';
  const scale = (n: number) => (n >= 100 ? Math.round(n) : Math.round(n * 10) / 10);

  if (currency === 'INR') {
    if (value >= 1e7) return `${sign}${symbol}${scale(value / 1e7)}Cr`;
    if (value >= 1e5) return `${sign}${symbol}${scale(value / 1e5)}L`;
    if (value >= 1e3) return `${sign}${symbol}${scale(value / 1e3)}k`;
  } else {
    if (value >= 1e6) return `${sign}${symbol}${scale(value / 1e6)}M`;
    if (value >= 1e3) return `${sign}${symbol}${scale(value / 1e3)}k`;
  }
  return `${sign}${symbol}${Math.round(value)}`;
}

/* ------------------------------------------------------------ the reading */

const PLAN_ITEM_COLUMNS =
  'id,plan_id,kind,label,category,amount,currency,due_date,instalments,certainty,notes,sort_order';

/** Every workspace should have a plan from migration 0032. Creating one on the
 *  first read means a database that missed the seed still opens on an empty
 *  plan rather than on an error. */
async function ensurePlan(workspace: string): Promise<PlanRow | null> {
  const { data, error } = await tenantFilter(
    supabase().from('finance_plans').select('id,name,base_currency,eur_rate,notes'),
    workspace
  ).order('created_at', { ascending: true }).limit(1);

  if (error) throw new Error(error.message);
  if (data && data.length) return data[0] as PlanRow;

  const { data: created, error: insertError } = await supabase()
    .from('finance_plans')
    .insert({
      name: 'Germany move',
      base_currency: 'INR',
      eur_rate: 100,
      user_id: USER_ID,
      workspace_id: workspace,
    })
    .select('id,name,base_currency,eur_rate,notes')
    .single();

  if (insertError) throw new Error(insertError.message);
  return (created || null) as PlanRow | null;
}

export async function fetchFunding(): Promise<FundingData> {
  const empty: FundingData = {
    configured: false, plan: null, items: [], linked: [], unlinked: [],
  };
  if (!isDirectReadConfigured()) return empty;

  try {
    const workspace = await activeWorkspaceId();
    const plan = await ensurePlan(workspace);
    if (!plan) return { ...empty, configured: true };

    const [itemsResult, linkedResult, unlinkedResult] = await Promise.all([
      tenantFilter(
        supabase().from('finance_plan_items').select(PLAN_ITEM_COLUMNS),
        workspace
      ).eq('plan_id', plan.id).order('sort_order', { ascending: true }),
      // Everything already attributed, with no cap: these are what the
      // estimate-against-actual figures are summed from, and dropping the
      // oldest of them would quietly understate what has been spent.
      tenantFilter(supabase().from('finance_logs').select('*'), workspace)
        .not('plan_item_id', 'is', null)
        .order('date', { ascending: false }),
      // The offer to attribute more. Only ever a short list, so it is bounded.
      tenantFilter(supabase().from('finance_logs').select('*'), workspace)
        .is('plan_item_id', null)
        .eq('type', 'expense')
        .order('date', { ascending: false })
        .limit(20),
    ]);

    if (itemsResult.error) throw new Error(itemsResult.error.message);
    if (linkedResult.error) throw new Error(linkedResult.error.message);
    if (unlinkedResult.error) throw new Error(unlinkedResult.error.message);

    return {
      configured: true,
      plan,
      items: (itemsResult.data || []) as PlanItemRow[],
      linked: (linkedResult.data || []) as Transaction[],
      unlinked: (unlinkedResult.data || []) as Transaction[],
    };
  } catch (err) {
    console.error('Funding plan read failed:', err instanceof Error ? err.message : err);
    return { ...empty, configured: true };
  }
}

/* --------------------------------------------------------- the arithmetic */

/** What has actually moved against each plan line, in base currency. Both
 *  sides of the passbook are kept: a cost counts what went out less anything
 *  refunded, a funding line counts what came in. */
function settledByItem(
  linked: Transaction[], base: string, eurRate: number
): Record<string, { expense: number; income: number }> {
  const out: Record<string, { expense: number; income: number }> = {};
  for (const row of linked) {
    const key = row.plan_item_id;
    if (!key) continue;
    const bucket = out[key] || (out[key] = { expense: 0, income: 0 });
    const side = row.type === 'income' ? 'income' : 'expense';
    bucket[side] += toBase(Number(row.amount || 0), row.currency, base, eurRate);
  }
  return out;
}

function toPlanItem(
  row: PlanItemRow,
  moved: Record<string, { expense: number; income: number }>,
  base: string,
  eurRate: number
): PlanItem {
  const instalments = Math.max(1, Number(row.instalments || 1));
  const per = Number(row.amount || 0);
  const estimate = toBase(per * instalments, row.currency, base, eurRate);
  const flows = moved[row.id] || { expense: 0, income: 0 };
  const net = row.kind === 'cost'
    ? flows.expense - flows.income
    : flows.income - flows.expense;
  const settled = round(Math.max(net, 0));

  return {
    ...row,
    amount: per,
    instalments,
    estimate,
    settled,
    outstanding: round(Math.max(estimate - settled, 0)),
    overBy: round(Math.max(settled - estimate, 0)),
    progressPct: estimate ? Math.min(Math.round((settled / estimate) * 1000) / 10, 100) : 0,
  };
}

/** Which months this line still owes money in.
 *
 *  What has already moved comes off the earliest instalments first, so a
 *  ten-month saving plan three months in shows seven months left rather than
 *  ten smaller ones. An instalment whose date has passed but which is still
 *  unpaid moves to the current month — it is owed now, and leaving it in the
 *  past would put the low point behind us where no loan can reach it. */
function instalmentSchedule(item: PlanItem, today: string): [string, number][] {
  if (!item.due_date || item.outstanding <= 0) return [];

  const per = item.estimate / item.instalments;
  let credit = item.settled;
  const out: [string, number][] = [];

  for (let index = 0; index < item.instalments; index += 1) {
    const covered = Math.min(per, credit);
    credit -= covered;
    const owing = round(per - covered);
    if (owing <= 0) continue;
    const when = addMonths(item.due_date, index);
    out.push([(when < today ? today : when).slice(0, 7), owing]);
  }
  return out;
}

export interface ComputeOptions {
  includeUnconfirmed?: boolean;
  today?: string;
}

export function computePlan(data: FundingData, options: ComputeOptions = {}): PlanView {
  const includeUnconfirmed = options.includeUnconfirmed !== false;
  const today = options.today || todayIso();
  const base = (data.plan?.base_currency || 'INR').toUpperCase();
  const eurRate = Number(data.plan?.eur_rate || 0) || 1;

  const moved = settledByItem(data.linked, base, eurRate);
  const costs: PlanItem[] = [];
  const funds: PlanItem[] = [];
  const unconvertible = new Set<string>();

  for (const row of data.items) {
    const item = toPlanItem(row, moved, base, eurRate);
    if (![base, 'EUR', 'INR'].includes(item.currency.toUpperCase())) {
      unconvertible.add(item.currency.toUpperCase());
    }
    (item.kind === 'cost' ? costs : funds).push(item);
  }

  // A cost with no date is one whose date is not settled yet, so it sorts
  // last; a funding line with no date is money already in hand, so it sorts
  // first.
  const by = (a: string, b: string, x: PlanItem, y: PlanItem) =>
    a.localeCompare(b) || x.sort_order - y.sort_order ||
    (x.label || '').localeCompare(y.label || '');
  costs.sort((x, y) => by(x.due_date || '9999-12-31', y.due_date || '9999-12-31', x, y));
  funds.sort((x, y) => by(x.due_date || '0000-01-01', y.due_date || '0000-01-01', x, y));

  const counted = includeUnconfirmed
    ? funds
    : funds.filter((f) => f.certainty === 'confirmed');

  // Funding with no date is money already in hand, so it opens the balance.
  const openingBalance = round(
    counted.filter((f) => !f.due_date).reduce((sum, f) => sum + f.outstanding, 0)
  );

  const buckets = new Map<string, { inflow: number; outflow: number }>();
  const bucket = (month: string) => {
    const found = buckets.get(month) || { inflow: 0, outflow: 0 };
    buckets.set(month, found);
    return found;
  };
  for (const item of costs) {
    for (const [month, amount] of instalmentSchedule(item, today)) bucket(month).outflow += amount;
  }
  for (const item of counted) {
    for (const [month, amount] of instalmentSchedule(item, today)) bucket(month).inflow += amount;
  }

  const months: PlanMonth[] = [];
  let running = openingBalance;
  let low = openingBalance;
  let loanByMonth: string | null = null;
  for (const month of Array.from(buckets.keys()).sort()) {
    const flow = buckets.get(month)!;
    running = round(running + flow.inflow - flow.outflow);
    low = Math.min(low, running);
    if (loanByMonth === null && running < -EPSILON) loanByMonth = month;
    months.push({
      month,
      inflow: round(flow.inflow),
      outflow: round(flow.outflow),
      balance: running,
    });
  }

  const sum = (rows: PlanItem[], field: 'estimate' | 'settled' | 'outstanding' | 'overBy') =>
    round(rows.reduce((total, row) => total + row[field], 0));

  const costOutstanding = sum(costs, 'outstanding');
  const fundOutstanding = sum(counted, 'outstanding');
  const gap = round(fundOutstanding - costOutstanding);
  const loanNeeded = round(Math.max(-low, 0));

  let status: PlanTotals['status'];
  let headline: string;
  if (gap < -EPSILON) {
    status = 'red';
    headline = 'Not enough money for what is planned';
  } else if (loanNeeded > EPSILON) {
    status = 'amber';
    headline = 'Enough money, but some of it arrives too late';
  } else {
    status = 'green';
    headline = 'Covered, with room to spare';
  }

  return {
    costs,
    funds,
    openingBalance,
    months,
    undatedCosts: costs.filter((c) => !c.due_date && c.outstanding > 0),
    totals: {
      baseCurrency: base,
      eurRate,
      costEstimate: sum(costs, 'estimate'),
      costPaid: sum(costs, 'settled'),
      costOutstanding,
      costOverspend: sum(costs, 'overBy'),
      fundExpected: sum(counted, 'estimate'),
      fundReceived: sum(counted, 'settled'),
      fundOutstanding,
      gap,
      loanNeeded,
      loanByMonth,
      status,
      headline,
      unconvertible: Array.from(unconvertible).sort(),
    },
  };
}
