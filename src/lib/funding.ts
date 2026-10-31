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
  /** The date the funding lane is read at: how much there will be by then. */
  horizon_date: string | null;
}

/** One entry in a lane: a budget (cost) or money expected by the horizon
 *  (fund). The number is typed, so a category exists with nothing under it. */
export interface PlanCategoryRow {
  id: string;
  plan_id: string;
  kind: PlanKind;
  name: string;
  amount: number;
  /** Paid or received so far. Ignored while detailed — the lines say instead. */
  paid: number;
  currency: string;
  /** Whether this category shows the itemised plan-and-pay view. */
  detailed: boolean;
  notes: string | null;
  sort_order: number;
}

export interface PlanItemRow {
  id: string;
  plan_id: string;
  kind: PlanKind;
  label: string;
  /** The free-text category 0032 carried; category_id is what the lane uses. */
  category: string | null;
  category_id: string | null;
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

/** A lane entry with its lines, and what has actually moved, folded in. */
export interface PlanCategory extends PlanCategoryRow {
  /** The typed budget, in the plan's base currency. */
  budget: number;
  /** Paid (cost) or received (fund): typed, or added up from the lines. */
  settled: number;
  outstanding: number;
  /** Paid past the budget. Loud on its own rather than folded into the lane. */
  overBy: number;
  progressPct: number;
  /** The lines under it, and what they come to. Detailed categories only. */
  items: PlanItem[];
  planned: number;
  /** Lines adding up to more than the budget: planned, not yet spent. */
  plannedOver: number;
  /** Budget with nothing written against it yet. */
  unplanned: number;
}

/** The two lanes and what they come to. */
export interface PlanLanes {
  /** Lane 1: everything budgeted. */
  budget: number;
  budgetPaid: number;
  budgetOutstanding: number;
  /** Lane 2: money there will be by the horizon. */
  available: number;
  availableReceived: number;
  /** available - budget. Negative is the loan. */
  difference: number;
  /** What has to be borrowed: the difference when it is short, else zero. */
  loan: number;
  horizon: string;
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
  /** What is left after the costs already settled — money paid out is money
   *  you no longer have. The gap is unaffected either way: settling a
   *  budgeted cost moves the same rupees between columns. */
  fundAvailable: number;
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
  /** The budget lane, then the money lane, each in sort order. */
  budgetCategories: PlanCategory[];
  fundCategories: PlanCategory[];
  lanes: PlanLanes;
  totals: PlanTotals;
  openingBalance: number;
  months: PlanMonth[];
  undatedCosts: PlanItem[];
}

export interface FundingData {
  configured: boolean;
  plan: PlanRow | null;
  /** Why the read failed, so a missing table does not read as a missing key. */
  error?: string | null;
  categories: PlanCategoryRow[];
  items: PlanItemRow[];
  /** Everything already attributed to a plan line. */
  linked: Transaction[];
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
  'id,plan_id,kind,label,category,category_id,amount,currency,due_date,instalments,certainty,notes,sort_order';

const PLAN_CATEGORY_COLUMNS =
  'id,plan_id,kind,name,amount,paid,currency,detailed,notes,sort_order';

/** Every workspace should have a plan from migration 0032. Creating one on the
 *  first read means a database that missed the seed still opens on an empty
 *  plan rather than on an error. */
const PLAN_COLUMNS = 'id,name,base_currency,eur_rate,notes,horizon_date';

/** Where the funding lane is read to when the plan has no date of its own. */
export const DEFAULT_HORIZON = '2027-07-31';

async function ensurePlan(workspace: string): Promise<PlanRow | null> {
  const { data, error } = await tenantFilter(
    supabase().from('finance_plans').select(PLAN_COLUMNS),
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
    .select(PLAN_COLUMNS)
    .single();

  if (insertError) throw new Error(insertError.message);
  return (created || null) as PlanRow | null;
}

export async function fetchFunding(): Promise<FundingData> {
  const empty: FundingData = {
    configured: false, plan: null, error: null, categories: [], items: [], linked: [],
  };
  if (!isDirectReadConfigured()) return empty;

  try {
    const workspace = await activeWorkspaceId();
    const plan = await ensurePlan(workspace);
    if (!plan) return { ...empty, configured: true };

    const [categoryResult, itemsResult, linkedResult] = await Promise.all([
      tenantFilter(
        supabase().from('finance_plan_categories').select(PLAN_CATEGORY_COLUMNS),
        workspace
      ).eq('plan_id', plan.id).order('sort_order', { ascending: true }),
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
    ]);

    if (categoryResult.error) throw new Error(categoryResult.error.message);
    if (itemsResult.error) throw new Error(itemsResult.error.message);
    if (linkedResult.error) throw new Error(linkedResult.error.message);

    return {
      configured: true,
      plan,
      categories: (categoryResult.data || []) as PlanCategoryRow[],
      items: (itemsResult.data || []) as PlanItemRow[],
      linked: (linkedResult.data || []) as Transaction[],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Funding plan read failed:', message);
    return { ...empty, configured: true, error: message };
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

/** A lane entry with its lines folded in.
 *
 *  The budget is the typed number, always: the lane has to total correctly
 *  whether or not the category is itemised, and a category with no lines is
 *  the common case. What has been paid comes from the lines when the category
 *  is detailed — those payments are real transactions and cannot be allowed to
 *  disagree with a figure typed beside them — and from the typed figure when
 *  it is not.
 */
function toPlanCategory(
  row: PlanCategoryRow, items: PlanItem[], base: string, eurRate: number
): PlanCategory {
  const budget = toBase(Number(row.amount || 0), row.currency, base, eurRate);
  const planned = round(items.reduce((total, item) => total + item.estimate, 0));
  const settled = row.detailed
    ? round(items.reduce((total, item) => total + item.settled, 0))
    : toBase(Number(row.paid || 0), row.currency, base, eurRate);

  return {
    ...row,
    amount: Number(row.amount || 0),
    paid: Number(row.paid || 0),
    budget,
    settled,
    outstanding: round(Math.max(budget - settled, 0)),
    overBy: round(Math.max(settled - budget, 0)),
    progressPct: budget ? Math.min(Math.round((settled / budget) * 1000) / 10, 100) : 0,
    items,
    planned,
    plannedOver: row.detailed ? round(Math.max(planned - budget, 0)) : 0,
    unplanned: row.detailed ? round(Math.max(budget - planned, 0)) : 0,
  };
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

  const costPaid = round(costs.reduce((total, row) => total + row.settled, 0));
  // Funding with no date is money already in hand, less anything already paid
  // out: that money has gone and cannot fund what is still coming.
  const openingBalance = round(
    counted.filter((f) => !f.due_date).reduce((sum, f) => sum + f.outstanding, 0) - costPaid
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

  // The lanes. Each category's lines are its breakdown, so they are matched
  // by category_id; a line whose category was deleted keeps its own figures
  // but belongs to no lane entry.
  const byCategory = new Map<string, PlanItem[]>();
  for (const item of [...costs, ...funds]) {
    if (!item.category_id) continue;
    const bucket = byCategory.get(item.category_id) || [];
    bucket.push(item);
    byCategory.set(item.category_id, bucket);
  }
  const categories = (data.categories || [])
    .map((row) => toPlanCategory(row, byCategory.get(row.id) || [], base, eurRate))
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  const budgetCategories = categories.filter((c) => c.kind === 'cost');
  const fundCategories = categories.filter((c) => c.kind === 'fund');

  const laneSum = (rows: PlanCategory[], field: 'budget' | 'settled' | 'outstanding') =>
    round(rows.reduce((total, row) => total + row[field], 0));

  const budgetTotal = laneSum(budgetCategories, 'budget');
  const availableTotal = laneSum(fundCategories, 'budget');
  const difference = round(availableTotal - budgetTotal);
  const lanes: PlanLanes = {
    budget: budgetTotal,
    budgetPaid: laneSum(budgetCategories, 'settled'),
    budgetOutstanding: laneSum(budgetCategories, 'outstanding'),
    available: availableTotal,
    availableReceived: laneSum(fundCategories, 'settled'),
    difference,
    loan: round(Math.max(-difference, 0)),
    horizon: data.plan?.horizon_date || DEFAULT_HORIZON,
  };

  const sum = (rows: PlanItem[], field: 'estimate' | 'settled' | 'outstanding' | 'overBy') =>
    round(rows.reduce((total, row) => total + row[field], 0));

  const costOutstanding = sum(costs, 'outstanding');
  const fundOutstanding = sum(counted, 'outstanding');
  const fundAvailable = round(fundOutstanding - costPaid);
  const gap = round(fundAvailable - costOutstanding);
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
    budgetCategories,
    fundCategories,
    lanes,
    openingBalance,
    months,
    undatedCosts: costs.filter((c) => !c.due_date && c.outstanding > 0),
    totals: {
      baseCurrency: base,
      eurRate,
      costEstimate: sum(costs, 'estimate'),
      costPaid,
      costOutstanding,
      costOverspend: sum(costs, 'overBy'),
      fundExpected: sum(counted, 'estimate'),
      fundReceived: sum(counted, 'settled'),
      fundOutstanding,
      fundAvailable,
      gap,
      loanNeeded,
      loanByMonth,
      status,
      headline,
      unconvertible: Array.from(unconvertible).sort(),
    },
  };
}
