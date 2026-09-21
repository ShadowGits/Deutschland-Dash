'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  Wallet, PiggyBank, TrendingDown, Plus, Trash2, X, AlertCircle,
  CheckCircle2, Landmark, Link2, Check,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatMoney, categoryEmoji, type Transaction } from '@/lib/finance';
import {
  computePlan, planCategoryEmoji, compactMoney, monthLabel, dateLabel, todayIso,
  PLAN_COST_CATEGORIES, PLAN_FUND_CATEGORIES,
  type FundingData, type PlanItem, type PlanKind, type Certainty, type PlanView,
} from '@/lib/funding';
import {
  createPlanItem, updatePlanItem, deletePlanItem, updatePlan, linkTransaction,
  settlePlanItem, reloadFunding, type PlanItemInput,
} from '@/app/funding-actions';

/* The funding plan.
 *
 * Two questions, deliberately answered by two different numbers. The gap is
 * whether there is enough money at all. The loan is the worst the running
 * balance ever gets, which is what a bridge has to cover even when the plan is
 * fully funded — money arriving in March does not pay a bill due in January.
 * A single total hides that second case, which is the one that actually bites.
 */

const TONE = {
  green: {
    ring: 'border-emerald-200', bg: 'bg-emerald-50', text: 'text-emerald-700',
    dot: 'bg-emerald-500', chip: 'bg-emerald-100 text-emerald-700',
  },
  amber: {
    ring: 'border-amber-200', bg: 'bg-amber-50', text: 'text-amber-700',
    dot: 'bg-amber-500', chip: 'bg-amber-100 text-amber-700',
  },
  red: {
    ring: 'border-rose-200', bg: 'bg-rose-50', text: 'text-rose-700',
    dot: 'bg-rose-500', chip: 'bg-rose-100 text-rose-700',
  },
} as const;

const CERTAINTY_CHIP: Record<Certainty, string> = {
  confirmed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  likely: 'bg-sky-50 text-sky-700 border-sky-200',
  maybe: 'bg-gray-100 text-gray-500 border-gray-200',
};

const CERTAINTY_LABEL: Record<Certainty, string> = {
  confirmed: 'Confirmed',
  likely: 'Likely',
  maybe: 'Maybe',
};

/* ------------------------------------------------------------------ stats */

function Stat({
  label, value, sub, tone = 'plain',
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
  tone?: 'plain' | 'cost' | 'fund';
}) {
  const accent =
    tone === 'cost' ? 'text-rose-600' : tone === 'fund' ? 'text-emerald-600' : 'text-gray-800';
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${accent}`}>{value}</p>
      {sub && <div className="text-xs text-gray-500 mt-1.5">{sub}</div>}
    </div>
  );
}

function PositionCard({ view }: { view: PlanView }) {
  const { totals } = view;
  const tone = TONE[totals.status];
  const currency = totals.baseCurrency;
  const short = totals.gap < 0;

  return (
    <div className={`rounded-xl border-2 ${tone.ring} ${tone.bg} p-5 flex flex-col`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={`h-2.5 w-2.5 rounded-full ${tone.dot}`} />
        <p className={`text-xs font-semibold uppercase tracking-wider ${tone.text}`}>
          {short ? 'Shortfall' : 'Surplus'}
        </p>
      </div>

      <p className={`text-2xl font-bold tabular-nums ${tone.text}`}>
        {formatMoney(Math.abs(totals.gap), currency)}
      </p>
      <p className="text-xs text-gray-600 mt-1.5">{totals.headline}</p>

      {totals.loanNeeded > 0 && (
        <div className="mt-3 pt-3 border-t border-white/70 flex items-start gap-2">
          <Landmark size={15} className={`${tone.text} mt-0.5 flex-shrink-0`} />
          <p className="text-xs text-gray-700 leading-relaxed">
            <span className="font-semibold">
              Bridge of {formatMoney(totals.loanNeeded, currency)}
            </span>
            {totals.loanByMonth && <> needed by {monthLabel(totals.loanByMonth)}</>}
            {!short && ' — the money exists, it just lands later than the bills.'}
          </p>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- runway */

/** The running balance month by month. The point of the picture is the part
 *  below the line: that dip is the loan, and where it starts is the deadline. */
function Runway({ view }: { view: PlanView }) {
  const currency = view.totals.baseCurrency;
  const series = [
    { key: 'now', label: 'Now', balance: view.openingBalance, inflow: 0, outflow: 0 },
    ...view.months.map((m) => ({
      key: m.month, label: monthLabel(m.month),
      balance: m.balance, inflow: m.inflow, outflow: m.outflow,
    })),
  ];

  const posMax = Math.max(0, ...series.map((s) => s.balance));
  const negMax = Math.max(0, ...series.map((s) => -s.balance));
  const span = posMax + negMax;
  const topPct = span === 0 ? 100 : (posMax / span) * 100;
  // With a long plan the labels collide, so only every nth month is named.
  const step = Math.ceil(series.length / 9);

  return (
    <div>
      <div className="flex items-baseline justify-between mb-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Money in hand, month by month
        </p>
        <p className="text-xs text-gray-400">
          {compactMoney(view.openingBalance, currency)} today
          {view.months.length > 0 && (
            <> → {compactMoney(view.months[view.months.length - 1].balance, currency)} at the end</>
          )}
        </p>
      </div>

      <div className="relative h-40 flex gap-[3px] items-stretch">
        {/* The zero line: everything under it is borrowed. */}
        <div
          className="absolute left-0 right-0 border-t border-dashed border-gray-300 pointer-events-none"
          style={{ top: `${topPct}%` }}
        />
        {series.map((point) => {
          const negative = point.balance < 0;
          const height = negative
            ? (negMax ? (-point.balance / negMax) * 100 : 0)
            : (posMax ? (point.balance / posMax) * 100 : 0);
          return (
            <div
              key={point.key}
              className="flex-1 min-w-[10px] flex flex-col group"
              title={`${point.label} · balance ${formatMoney(point.balance, currency)}${
                point.inflow ? ` · in ${formatMoney(point.inflow, currency)}` : ''
              }${point.outflow ? ` · out ${formatMoney(point.outflow, currency)}` : ''}`}
            >
              <div className="flex items-end" style={{ height: `${topPct}%` }}>
                {!negative && (
                  <div
                    className={`w-full rounded-t-sm transition-colors ${
                      point.key === 'now'
                        ? 'bg-gray-300 group-hover:bg-gray-400'
                        : 'bg-emerald-400 group-hover:bg-emerald-500'
                    }`}
                    style={{ height: `${Math.max(height, point.balance > 0 ? 3 : 0)}%` }}
                  />
                )}
              </div>
              <div className="flex items-start" style={{ height: `${100 - topPct}%` }}>
                {negative && (
                  <div
                    className="w-full rounded-b-sm bg-rose-500 group-hover:bg-rose-600 transition-colors"
                    style={{ height: `${Math.max(height, 3)}%` }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-[3px] mt-2">
        {series.map((point, index) => (
          <div key={point.key} className="flex-1 min-w-[10px] text-center">
            <span className="text-[10px] text-gray-400 whitespace-nowrap">
              {index % step === 0 ? point.label : ''}
            </span>
          </div>
        ))}
      </div>

      {view.undatedCosts.length > 0 && (
        <div className="mt-4 flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
          <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
          <span>
            {view.undatedCosts.length} cost
            {view.undatedCosts.length > 1 ? 's have' : ' has'} no date, so
            {view.undatedCosts.length > 1 ? ' they count' : ' it counts'} towards the
            shortfall but not towards the chart. Add a date for the bridge figure to
            be trustworthy: {view.undatedCosts.map((c) => c.label).join(', ')}.
          </span>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ form */

const BLANK: PlanItemInput = {
  kind: 'cost', label: '', amount: 0, currency: 'INR',
  category: null, due_date: null, instalments: 1, certainty: 'likely',
};

function ItemForm({
  kind, initial, saving, onSave, onCancel, onDelete,
}: {
  kind: PlanKind;
  initial: Partial<PlanItemInput>;
  saving: boolean;
  onSave: (values: PlanItemInput) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [values, setValues] = useState<PlanItemInput>({ ...BLANK, kind, ...initial });
  const set = (patch: Partial<PlanItemInput>) => setValues((v) => ({ ...v, ...patch }));
  const categories = kind === 'cost' ? PLAN_COST_CATEGORIES : PLAN_FUND_CATEGORIES;
  const total = Number(values.amount || 0) * Number(values.instalments || 1);
  const field =
    'px-2.5 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 min-w-0';

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5 space-y-2.5">
      <input
        type="text"
        value={values.label}
        onChange={(e) => set({ label: e.target.value })}
        placeholder={kind === 'cost' ? 'What is it for?' : 'Where is it coming from?'}
        className={`${field} w-full`}
        autoFocus
      />

      <div className="grid grid-cols-[auto_1fr_auto] gap-2">
        <select
          value={values.currency}
          onChange={(e) => set({ currency: e.target.value })}
          className={field}
        >
          <option value="INR">₹</option>
          <option value="EUR">€</option>
        </select>
        <input
          type="number"
          min="0"
          step="1"
          value={values.amount || ''}
          onChange={(e) => set({ amount: Number(e.target.value) })}
          placeholder="Amount"
          className={field}
        />
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400">×</span>
          <input
            type="number"
            min="1"
            step="1"
            value={values.instalments}
            onChange={(e) => set({ instalments: Math.max(1, Number(e.target.value) || 1) })}
            title="How many monthly instalments"
            className={`${field} w-[68px]`}
          />
        </div>
      </div>

      {values.instalments > 1 && (
        <p className="text-xs text-gray-500">
          {formatMoney(Number(values.amount || 0), values.currency)} a month for{' '}
          {values.instalments} months ={' '}
          <span className="font-semibold">{formatMoney(total, values.currency)}</span>
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <select
          value={values.category || ''}
          onChange={(e) => set({ category: e.target.value || null })}
          className={field}
        >
          <option value="">No category</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input
          type="date"
          value={values.due_date || ''}
          onChange={(e) => set({ due_date: e.target.value || null })}
          title={kind === 'cost' ? 'When it has to be paid' : 'When the money lands'}
          className={field}
        />
      </div>

      {kind === 'fund' ? (
        <div className="flex gap-1.5">
          {(Object.keys(CERTAINTY_LABEL) as Certainty[]).map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => set({ certainty: level })}
              className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                values.certainty === level
                  ? CERTAINTY_CHIP[level]
                  : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'
              }`}
            >
              {CERTAINTY_LABEL[level]}
            </button>
          ))}
        </div>
      ) : (
        !values.due_date && (
          <p className="text-xs text-amber-600">
            Without a date this counts towards the shortfall but not the chart.
          </p>
        )
      )}

      <div className="flex items-center justify-between pt-0.5">
        {onDelete ? (
          <button
            onClick={onDelete}
            disabled={saving}
            className="flex items-center text-xs text-rose-600 hover:text-rose-700 disabled:opacity-50"
          >
            <Trash2 size={13} className="mr-1" />
            Remove
          </button>
        ) : <span />}
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            disabled={saving}
            className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(values)}
            disabled={saving || !values.label.trim() || !(Number(values.amount) > 0)}
            className="px-3.5 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- ledger */

/** What to offer as the amount when ticking a line as paid.
 *
 *  In the line's own currency, never the converted one. A line paid in
 *  instalments offers one instalment, because that is what you actually just
 *  paid; a one-off offers whatever is still outstanding. */
function suggestedPayment(item: PlanItem): number {
  if (item.instalments > 1) return item.amount;
  const nativeTotal = item.amount * item.instalments;
  const ratio = item.estimate > 0 ? item.outstanding / item.estimate : 1;
  return Math.round(nativeTotal * ratio * 100) / 100;
}

function LedgerRow({
  item, baseCurrency, onClick, onSettle,
}: {
  item: PlanItem;
  baseCurrency: string;
  onClick: () => void;
  /** Costs only: tick it as paid without leaving the screen. */
  onSettle?: () => void;
}) {
  const native = item.currency.toUpperCase() !== baseCurrency.toUpperCase();
  const meta = [
    item.category,
    native ? formatMoney(item.amount * item.instalments, item.currency) : null,
    item.instalments > 1 ? `${item.instalments} × monthly` : null,
    item.due_date ? dateLabel(item.due_date) : 'no date',
  ].filter(Boolean).join(' · ');

  const over = item.overBy > 0;
  const bar = over
    ? 'bg-rose-600'
    : item.outstanding === 0
      ? 'bg-emerald-500'
      : item.kind === 'cost' ? 'bg-gray-400' : 'bg-emerald-500';

  return (
    <div className="flex items-stretch hover:bg-gray-50 transition-colors">
    <button
      onClick={onClick}
      className="flex-1 min-w-0 text-left px-4 py-3"
    >
      <div className="flex items-start gap-3">
        <span className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-sm flex-shrink-0">
          {planCategoryEmoji(item.category)}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-medium text-gray-800 truncate">{item.label}</p>
            <span className="text-sm font-semibold text-gray-800 tabular-nums whitespace-nowrap">
              {formatMoney(item.estimate, baseCurrency)}
            </span>
          </div>

          <div className="flex items-baseline justify-between gap-3 mt-0.5">
            <p className="text-xs text-gray-400 truncate">{meta}</p>
            {item.kind === 'fund' && item.settled === 0 ? (
              <span
                className={`text-[10px] font-medium px-1.5 py-0.5 rounded border whitespace-nowrap ${
                  CERTAINTY_CHIP[item.certainty]
                }`}
              >
                {CERTAINTY_LABEL[item.certainty]}
              </span>
            ) : over ? (
              <span className="text-xs font-semibold text-rose-600 whitespace-nowrap tabular-nums">
                {formatMoney(item.overBy, baseCurrency)} over
              </span>
            ) : item.settled > 0 && item.outstanding === 0 ? (
              // The settled state is a badge, not a line of grey text, so it
              // cannot be mistaken for the button that records a payment.
              <span className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border bg-emerald-50 text-emerald-700 border-emerald-200 whitespace-nowrap">
                <Check size={11} />
                {item.kind === 'cost' ? 'Paid' : 'Received'}
              </span>
            ) : item.settled > 0 ? (
              <span className="text-xs text-gray-400 whitespace-nowrap tabular-nums">
                {formatMoney(item.outstanding, baseCurrency)} left
              </span>
            ) : null}
          </div>

          {item.settled > 0 && (
            <>
              <div className="mt-2 w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${bar}`}
                  style={{ width: `${Math.max(item.progressPct, 2)}%` }}
                />
              </div>
              {over && (
                <p className="text-xs text-rose-600 mt-1.5">
                  Spent {formatMoney(item.settled, baseCurrency)} against an estimate of{' '}
                  {formatMoney(item.estimate, baseCurrency)}.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </button>

    {onSettle && (
      // An action, and it has to look like one. Labelled "Paid" with a tick it
      // read as a status badge, so a plan where nothing had been paid looked
      // fully settled on every row.
      <button
        onClick={onSettle}
        title="Record money actually paid against this line"
        className="flex items-center gap-1 self-center flex-shrink-0 px-2.5 py-1.5 my-2 mr-3 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:border-emerald-400 hover:text-emerald-700 hover:bg-emerald-50 transition-colors whitespace-nowrap"
      >
        <Plus size={13} />
        {item.outstanding > 0 ? 'Mark paid' : 'Add payment'}
      </button>
    )}
    </div>
  );
}

/** Recording a payment. The passbook row and the attribution to the plan line
 *  are written together, because split across two screens the second half
 *  never happens and the plan never learns what anything really cost. */
function SettleForm({
  item, saving, onSave, onCancel,
}: {
  item: PlanItem;
  saving: boolean;
  onSave: (values: { amount: number; currency: string; date: string }) => void;
  onCancel: () => void;
}) {
  const [amount, setAmount] = useState(suggestedPayment(item));
  const [currency, setCurrency] = useState(item.currency);
  const [date, setDate] = useState(todayIso());
  const field =
    'px-2.5 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 min-w-0';

  return (
    <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-3.5 space-y-2.5">
      <p className="text-xs font-semibold text-emerald-800">
        Record a payment — {item.label}
      </p>

      <div className="grid grid-cols-[auto_1fr_auto] gap-2">
        <select
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          className={field}
        >
          <option value="INR">₹</option>
          <option value="EUR">€</option>
        </select>
        <input
          type="number"
          min="0"
          step="1"
          value={amount || ''}
          onChange={(e) => setAmount(Number(e.target.value))}
          placeholder="How much did it actually cost?"
          className={field}
          autoFocus
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={field}
        />
      </div>

      {item.instalments > 1 && (
        <p className="text-xs text-gray-500">
          One instalment of {item.instalments}. Record each as you pay it.
        </p>
      )}

      <div className="flex items-center justify-end gap-2 pt-0.5">
        <button
          onClick={onCancel}
          disabled={saving}
          className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={() => onSave({ amount, currency, date })}
          disabled={saving || !(amount > 0) || !date}
          className="px-3.5 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Record it'}
        </button>
      </div>
    </div>
  );
}

function Ledger({
  kind, items, baseCurrency, total, editing, adding, seed, settling, saving,
  onEdit, onAdd, onSave, onDelete, onCancel, onSettle, onRecord,
}: {
  kind: PlanKind;
  items: PlanItem[];
  baseCurrency: string;
  total: number;
  editing: string | null;
  adding: boolean;
  /** What a suggestion chip prefilled, so "+ Tests" opens a named line. */
  seed: Partial<PlanItemInput>;
  settling: string | null;
  saving: boolean;
  onEdit: (id: string | null) => void;
  onAdd: (seed?: Partial<PlanItemInput>) => void;
  onSave: (id: string | null, values: PlanItemInput) => void;
  onDelete: (id: string) => void;
  onCancel: () => void;
  onSettle: (id: string) => void;
  onRecord: (item: PlanItem, values: { amount: number; currency: string; date: string }) => void;
}) {
  const cost = kind === 'cost';
  const suggestions = cost
    ? ['Tests', 'Tuition', 'Applications', 'Courses', 'Visa', 'Travel']
    : ['Savings', 'Salary', 'Family', 'Loan'];

  return (
    <div className="flex flex-col rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div
        className={`px-4 py-3 border-b flex items-center justify-between ${
          cost ? 'bg-rose-50/60 border-rose-100' : 'bg-emerald-50/60 border-emerald-100'
        }`}
      >
        <div className="flex items-center gap-2">
          {cost
            ? <TrendingDown size={16} className="text-rose-500" />
            : <PiggyBank size={16} className="text-emerald-600" />}
          <h4 className="text-sm font-semibold text-gray-700">
            {cost ? 'What it costs' : 'Where the money comes from'}
          </h4>
        </div>
        <span className="text-sm font-bold text-gray-800 tabular-nums">
          {formatMoney(total, baseCurrency)}
        </span>
      </div>

      <div className="divide-y divide-gray-100 flex-1">
        {items.length === 0 && !adding && (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-gray-500 mb-1">
              {cost ? 'No costs listed yet' : 'No money listed yet'}
            </p>
            <p className="text-xs text-gray-400 mb-4">
              {cost
                ? 'Everything the move will cost — tests, tuition, applications.'
                : 'What you have now and what is still coming in.'}
            </p>
            <div className="flex flex-wrap gap-1.5 justify-center">
              {suggestions.map((name) => (
                <button
                  key={name}
                  onClick={() => onAdd({ label: name, category: name })}
                  className="px-2.5 py-1 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-full hover:border-gray-300 hover:bg-gray-100 transition-colors"
                >
                  + {name}
                </button>
              ))}
            </div>
          </div>
        )}

        {items.map((item) =>
          editing === item.id ? (
            <div key={item.id} className="p-3">
              <ItemForm
                kind={kind}
                initial={item}
                saving={saving}
                onSave={(values) => onSave(item.id, values)}
                onCancel={onCancel}
                onDelete={() => onDelete(item.id)}
              />
            </div>
          ) : settling === item.id ? (
            <div key={item.id} className="p-3">
              <SettleForm
                item={item}
                saving={saving}
                onSave={(values) => onRecord(item, values)}
                onCancel={onCancel}
              />
            </div>
          ) : (
            <LedgerRow
              key={item.id}
              item={item}
              baseCurrency={baseCurrency}
              onClick={() => onEdit(item.id)}
              onSettle={cost ? () => onSettle(item.id) : undefined}
            />
          )
        )}

        {adding && (
          <div className="p-3">
            {/* Keyed on the seed so picking a different chip refills the form
                rather than leaving the first one's name in place. */}
            <ItemForm
              key={JSON.stringify(seed)}
              kind={kind}
              initial={{ ...seed, kind }}
              saving={saving}
              onSave={(values) => onSave(null, values)}
              onCancel={onCancel}
            />
          </div>
        )}
      </div>

      {!adding && (
        <button
          onClick={() => onAdd()}
          className="px-4 py-2.5 border-t border-gray-100 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 flex items-center justify-center transition-colors"
        >
          <Plus size={13} className="mr-1.5" />
          Add {cost ? 'a cost' : 'money'}
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------ attributing spend */

/** Spending only shows up against an estimate once it is attributed to one.
 *  Left to a separate screen nobody ever does it, so the unattributed rows sit
 *  here, next to the lines they probably belong to. */
function LinkStrip({
  rows, costs, saving, onLink,
}: {
  rows: Transaction[];
  costs: PlanItem[];
  saving: boolean;
  onLink: (transactionId: string, planItemId: string) => void;
}) {
  if (rows.length === 0 || costs.length === 0) return null;

  return (
    <Card className="shadow-sm border-0 rounded-xl">
      <CardHeader className="border-b bg-white rounded-t-xl px-6 py-4">
        <CardTitle className="text-sm font-semibold text-gray-700 flex items-center">
          <Link2 className="mr-2 text-gray-400" size={16} />
          Recent spending not yet on the plan
          <span className="ml-2 text-xs font-normal text-gray-400">
            pick the line it belongs to
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 max-h-72 overflow-y-auto divide-y divide-gray-100">
        {rows.map((row) => (
          <div key={row.id} className="flex items-center gap-3 px-6 py-2.5">
            <span className="h-7 w-7 rounded-full bg-gray-100 flex items-center justify-center text-xs flex-shrink-0">
              {categoryEmoji(row.category)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-gray-800 truncate">{row.description}</p>
              <p className="text-xs text-gray-400">{dateLabel(row.date)}</p>
            </div>
            <span className="text-sm font-medium text-gray-700 tabular-nums whitespace-nowrap">
              {formatMoney(Number(row.amount), row.currency)}
            </span>
            <select
              defaultValue=""
              disabled={saving}
              onChange={(e) => e.target.value && onLink(row.id, e.target.value)}
              className="px-2 py-1.5 border rounded-lg text-xs bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 max-w-[190px] disabled:opacity-50"
            >
              <option value="">Not on the plan</option>
              {costs.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/* ----------------------------------------------------------------- widget */

export default function FundingPlanWidget({ initial }: { initial: FundingData }) {
  const [data, setData] = useState<FundingData>(initial);
  const [includeUnconfirmed, setIncludeUnconfirmed] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [addingTo, setAddingTo] = useState<PlanKind | null>(null);
  const [seed, setSeed] = useState<Partial<PlanItemInput>>({});
  const [settling, setSettling] = useState<string | null>(null);
  const [rate, setRate] = useState(String(initial.plan?.eur_rate ?? 100));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Recomputed in the browser, so the confirmed-only toggle is instant rather
  // than a round trip.
  const view = useMemo(
    () => computePlan(data, { includeUnconfirmed, today: todayIso() }),
    [data, includeUnconfirmed]
  );

  if (!data.configured || !data.plan) {
    return (
      <Card className="shadow-sm border-0 rounded-xl">
        <CardContent className="p-8 text-center text-gray-500">
          <p className="font-medium text-gray-700 mb-2">The funding plan is not connected yet</p>
          <p className="text-sm">
            Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and PLANNER_USER_ID in the
            dashboard environment to switch this on.
          </p>
        </CardContent>
      </Card>
    );
  }

  const plan = data.plan;
  const { totals } = view;
  const currency = totals.baseCurrency;

  const done = async () => {
    setData(await reloadFunding());
    setEditing(null);
    setAddingTo(null);
    setSettling(null);
    setSeed({});
  };

  const closeForms = () => {
    setEditing(null);
    setAddingTo(null);
    setSettling(null);
    setSeed({});
  };

  const run = (action: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error || 'Could not save');
        return;
      }
      await done();
    });
  };

  const save = (kind: PlanKind, id: string | null, values: PlanItemInput) =>
    run(() => (id
      ? updatePlanItem(id, values)
      : createPlanItem(plan.id, { ...values, kind })));

  const startAdd = (kind: PlanKind, values: Partial<PlanItemInput> = {}) => {
    setEditing(null);
    setSettling(null);
    setSeed(values);
    setAddingTo(kind);
  };

  const record = (
    item: PlanItem,
    values: { amount: number; currency: string; date: string }
  ) => run(() => settlePlanItem(item.id, {
    ...values,
    label: item.label,
    category: item.category,
  }));

  const commitRate = () => {
    const value = Number(rate);
    if (!(value > 0) || value === Number(plan.eur_rate)) {
      setRate(String(plan.eur_rate));
      return;
    }
    run(() => updatePlan(plan.id, { eur_rate: value }));
  };

  const paidPct = totals.costEstimate
    ? Math.round((totals.costPaid / totals.costEstimate) * 100)
    : 0;

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-gray-800 flex items-center">
          <Wallet className="mr-2 text-emerald-600" size={18} />
          Funding plan
          <span className="ml-2 text-sm font-normal text-gray-400">{plan.name}</span>
        </h3>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIncludeUnconfirmed((v) => !v)}
            title="Recalculate using only money marked confirmed"
            className={`flex items-center px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              includeUnconfirmed
                ? 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}
          >
            <CheckCircle2 size={13} className="mr-1.5" />
            Confirmed money only
          </button>

          <div
            className="flex items-center px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-500"
            title="The rate every euro line is converted at. Hand-set on purpose, so the totals can be reproduced later."
          >
            <span className="mr-1">₹</span>
            <input
              type="number"
              min="1"
              step="0.5"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              onBlur={commitRate}
              className="w-14 bg-transparent text-gray-700 font-medium focus:outline-none tabular-nums"
            />
            <span className="ml-0.5">per €</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center justify-between bg-rose-50 text-rose-700 text-sm px-4 py-3 rounded-lg">
          {error}
          <button onClick={() => setError(null)}><X size={14} /></button>
        </div>
      )}

      {totals.unconvertible.length > 0 && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-xs px-4 py-2.5 rounded-lg">
          <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
          <span>
            {totals.unconvertible.join(', ')} lines are counted at face value — there is no
            rate here for them, and guessing one would put a number on screen nobody
            could reproduce.
          </span>
        </div>
      )}

      {/* The four numbers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Stat
          label="Budgeted"
          value={formatMoney(totals.costEstimate, currency)}
          tone="cost"
          sub={
            totals.costOverspend > 0 ? (
              <span className="text-rose-600 font-semibold">
                {formatMoney(totals.costOverspend, currency)} over budget
                <span className="font-normal text-gray-500">
                  {' '}· {formatMoney(totals.costPaid, currency)} spent
                </span>
              </span>
            ) : totals.costPaid > 0 ? (
              <>{formatMoney(totals.costPaid, currency)} spent so far · {paidPct}%</>
            ) : (
              'No payments recorded yet'
            )
          }
        />
        <Stat
          label="Still to pay"
          value={formatMoney(totals.costOutstanding, currency)}
          sub={`${view.costs.length} cost${view.costs.length === 1 ? '' : 's'} on the plan`}
        />
        <Stat
          label="Money available"
          value={formatMoney(totals.fundOutstanding, currency)}
          tone="fund"
          sub={
            <>
              {formatMoney(view.openingBalance, currency)} in hand
              {totals.fundOutstanding > view.openingBalance && <> · rest still to arrive</>}
            </>
          }
        />
        <PositionCard view={view} />
      </div>

      {/* The runway. Nothing on the plan means nothing to chart, and an empty
          axis reads as a broken widget rather than an empty one. */}
      {(view.costs.length > 0 || view.funds.length > 0) && (
        <Card className="shadow-sm border-0 rounded-xl">
          <CardContent className="p-6">
            <Runway view={view} />
          </CardContent>
        </Card>
      )}

      {/* The two sides, literally side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        <Ledger
          kind="cost"
          items={view.costs}
          baseCurrency={currency}
          total={totals.costEstimate}
          editing={editing}
          adding={addingTo === 'cost'}
          seed={seed}
          settling={settling}
          saving={pending}
          onEdit={(id) => { setAddingTo(null); setSettling(null); setEditing(id); }}
          onAdd={(values) => startAdd('cost', values)}
          onSave={(id, values) => save('cost', id, values)}
          onDelete={(id) => run(() => deletePlanItem(id))}
          onCancel={closeForms}
          onSettle={(id) => { setEditing(null); setAddingTo(null); setSettling(id); }}
          onRecord={record}
        />
        <Ledger
          kind="fund"
          items={view.funds}
          baseCurrency={currency}
          total={totals.fundExpected}
          editing={editing}
          adding={addingTo === 'fund'}
          seed={seed}
          settling={settling}
          saving={pending}
          onEdit={(id) => { setAddingTo(null); setSettling(null); setEditing(id); }}
          onAdd={(values) => startAdd('fund', values)}
          onSave={(id, values) => save('fund', id, values)}
          onDelete={(id) => run(() => deletePlanItem(id))}
          onCancel={closeForms}
          onSettle={() => {}}
          onRecord={record}
        />
      </div>

      <LinkStrip
        rows={data.unlinked}
        costs={view.costs}
        saving={pending}
        onLink={(transactionId, planItemId) =>
          run(() => linkTransaction(transactionId, planItemId))}
      />
    </div>
  );
}
