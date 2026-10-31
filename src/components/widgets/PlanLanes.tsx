'use client';

import { useState } from 'react';
import {
  Plus, Trash2, TrendingDown, PiggyBank, Landmark, CheckCircle2, ListTree,
} from 'lucide-react';
import { formatMoney } from '@/lib/finance';
import { dateLabel, type PlanCategory, type PlanKind, type PlanLanes as Lanes } from '@/lib/funding';
import type { PlanCategoryInput } from '@/app/funding-actions';

/* The two lanes the plan is actually read off.
 *
 *   1. what is budgeted for each thing — operational, mom, tuition …
 *   2. how much money there will be by the horizon
 *
 * (2) - (1) is the loan, and it is the only number that answers "how much do I
 * have to borrow". Both lanes are typed a category at a time, so a category
 * exists without being itemised: most of them are one number. A category that
 * does need breaking down switches its detailed view on and gets the plan
 * lines and the mark-paid tracking underneath.
 */

const field =
  'w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none ' +
  'focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400';

function Bar({ pct, tone }: { pct: number; tone: 'cost' | 'fund' | 'over' }) {
  const fill = tone === 'over' ? 'bg-rose-600' : tone === 'fund' ? 'bg-emerald-500' : 'bg-gray-400';
  return (
    <div className="mt-2 w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${fill}`}
        style={{ width: `${Math.max(Math.min(pct, 100), 2)}%` }}
      />
    </div>
  );
}

/** Add or change one lane entry. Paid is only asked for when the category has
 *  no detail: once it is itemised, its lines are what say how much was paid,
 *  and a second figure typed beside them would only ever disagree. */
function CategoryForm({
  kind, initial, saving, onSave, onCancel, onDelete,
}: {
  kind: PlanKind;
  initial?: Partial<PlanCategory>;
  saving: boolean;
  onSave: (values: PlanCategoryInput) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [values, setValues] = useState<PlanCategoryInput>({
    kind,
    name: initial?.name || '',
    amount: Number(initial?.amount ?? 0),
    paid: Number(initial?.paid ?? 0),
    currency: (initial?.currency || 'INR').toUpperCase(),
    detailed: initial?.detailed ?? false,
    notes: initial?.notes ?? null,
  });
  const set = (patch: Partial<PlanCategoryInput>) => setValues((v) => ({ ...v, ...patch }));
  const cost = kind === 'cost';

  return (
    <div className="p-3 bg-gray-50 space-y-2.5">
      <input
        autoFocus
        value={values.name}
        onChange={(e) => set({ name: e.target.value })}
        placeholder={cost ? 'Operational, tuition, rent…' : 'Mom, savings, salary…'}
        className={field}
      />
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-gray-500">
          {cost ? 'Budget' : 'By the horizon'}
          <input
            type="number"
            min="0"
            step="1000"
            value={values.amount}
            onChange={(e) => set({ amount: Number(e.target.value) })}
            className={`${field} mt-1`}
          />
        </label>
        <label className="text-xs text-gray-500">
          Currency
          <select
            value={values.currency}
            onChange={(e) => set({ currency: e.target.value })}
            className={`${field} mt-1`}
          >
            <option value="INR">INR</option>
            <option value="EUR">EUR</option>
          </select>
        </label>
      </div>

      {!values.detailed && (
        <label className="block text-xs text-gray-500">
          {cost ? 'Paid so far' : 'Received so far'}
          <input
            type="number"
            min="0"
            step="1000"
            value={values.paid}
            onChange={(e) => set({ paid: Number(e.target.value) })}
            className={`${field} mt-1`}
          />
        </label>
      )}

      <button
        type="button"
        onClick={() => set({ detailed: !values.detailed })}
        className={`w-full flex items-start gap-2 px-2.5 py-2 text-left text-xs rounded-lg border transition-colors ${
          values.detailed
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
        }`}
      >
        <ListTree size={14} className="mt-0.5 flex-shrink-0" />
        <span>
          <span className="font-medium">Plan this one line by line</span>
          <span className="block text-[11px] opacity-80">
            {values.detailed
              ? `Its lines carry the dates and the ${cost ? 'paid' : 'received'} marks, so the figure above is read off them.`
              : 'Off: this stays one number you keep yourself.'}
          </span>
        </span>
      </button>

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
            onClick={() => onSave({ ...values, name: values.name.trim() })}
            disabled={saving || !values.name.trim()}
            className="px-3.5 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CategoryRow({
  category, baseCurrency, onEdit, onJumpToDetail,
}: {
  category: PlanCategory;
  baseCurrency: string;
  onEdit: () => void;
  onJumpToDetail: () => void;
}) {
  const cost = category.kind === 'cost';
  const native = category.currency.toUpperCase() !== baseCurrency.toUpperCase();
  const over = category.overBy > 0;

  return (
    <div className="flex items-stretch hover:bg-gray-50 transition-colors">
      <button onClick={onEdit} className="flex-1 min-w-0 text-left px-4 py-3">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-medium text-gray-800 truncate">{category.name}</p>
          <span className="text-sm font-semibold text-gray-800 tabular-nums whitespace-nowrap">
            {formatMoney(category.budget, baseCurrency)}
          </span>
        </div>

        <div className="flex items-baseline justify-between gap-3 mt-0.5">
          <p className="text-xs text-gray-400 truncate">
            {[
              native ? formatMoney(category.amount, category.currency) : null,
              category.detailed
                ? `${category.items.length} line${category.items.length === 1 ? '' : 's'}`
                : 'one number',
            ].filter(Boolean).join(' · ')}
          </p>
          {over ? (
            <span className="text-xs font-semibold text-rose-600 whitespace-nowrap tabular-nums">
              {formatMoney(category.overBy, baseCurrency)} over
            </span>
          ) : category.settled > 0 && category.outstanding === 0 ? (
            <span className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border bg-emerald-50 text-emerald-700 border-emerald-200 whitespace-nowrap">
              <CheckCircle2 size={11} />
              {cost ? 'Paid' : 'In hand'}
            </span>
          ) : category.settled > 0 ? (
            <span className="text-xs text-gray-400 whitespace-nowrap tabular-nums">
              {formatMoney(category.settled, baseCurrency)} {cost ? 'paid' : 'in'}
            </span>
          ) : null}
        </div>

        {(category.settled > 0 || over) && (
          <Bar pct={category.progressPct} tone={over ? 'over' : cost ? 'cost' : 'fund'} />
        )}

        {category.detailed && category.plannedOver > 0 && (
          <p className="text-xs text-amber-600 mt-1.5">
            Its lines come to {formatMoney(category.plannedOver, baseCurrency)} more than the
            {cost ? ' budget' : ' amount'} above.
          </p>
        )}
        {category.detailed && category.unplanned > 0 && category.items.length > 0 && (
          <p className="text-xs text-gray-400 mt-1.5">
            {formatMoney(category.unplanned, baseCurrency)} of it is not on a line yet.
          </p>
        )}
      </button>

      {category.detailed && (
        <button
          onClick={onJumpToDetail}
          title="Open its lines"
          className="flex items-center gap-1 self-center flex-shrink-0 px-2.5 py-1.5 my-2 mr-3 text-xs font-medium rounded-lg border border-gray-300 bg-white text-gray-600 hover:border-emerald-400 hover:text-emerald-700 hover:bg-emerald-50 transition-colors whitespace-nowrap"
        >
          <ListTree size={13} />
          Lines
        </button>
      )}
    </div>
  );
}

function Lane({
  kind, categories, baseCurrency, total, horizon, editing, adding, saving,
  onEdit, onAdd, onSave, onDelete, onCancel, onJumpToDetail,
}: {
  kind: PlanKind;
  categories: PlanCategory[];
  baseCurrency: string;
  total: number;
  horizon: string;
  editing: string | null;
  adding: boolean;
  saving: boolean;
  onEdit: (id: string | null) => void;
  onAdd: () => void;
  onSave: (id: string | null, values: PlanCategoryInput) => void;
  onDelete: (id: string) => void;
  onCancel: () => void;
  onJumpToDetail: (id: string) => void;
}) {
  const cost = kind === 'cost';

  return (
    <div className="flex flex-col rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div
        className={`px-4 py-3 border-b flex items-center justify-between ${
          cost ? 'bg-rose-50/60 border-rose-100' : 'bg-emerald-50/60 border-emerald-100'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {cost
            ? <TrendingDown size={16} className="text-rose-500 flex-shrink-0" />
            : <PiggyBank size={16} className="text-emerald-600 flex-shrink-0" />}
          <h4 className="text-sm font-semibold text-gray-700 truncate">
            {cost ? 'Budget' : `Money by ${dateLabel(horizon)}`}
          </h4>
        </div>
        <span className="text-sm font-bold text-gray-800 tabular-nums">
          {formatMoney(total, baseCurrency)}
        </span>
      </div>

      <div className="divide-y divide-gray-100 flex-1">
        {categories.length === 0 && !adding && (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-gray-500 mb-1">
              {cost ? 'Nothing budgeted yet' : 'No money listed yet'}
            </p>
            <p className="text-xs text-gray-400">
              {cost
                ? 'One category per thing you are setting money aside for.'
                : 'What you will have by then, wherever it comes from.'}
            </p>
          </div>
        )}

        {categories.map((category) =>
          editing === category.id ? (
            <CategoryForm
              key={category.id}
              kind={kind}
              initial={category}
              saving={saving}
              onSave={(values) => onSave(category.id, values)}
              onCancel={onCancel}
              onDelete={() => onDelete(category.id)}
            />
          ) : (
            <CategoryRow
              key={category.id}
              category={category}
              baseCurrency={baseCurrency}
              onEdit={() => onEdit(category.id)}
              onJumpToDetail={() => onJumpToDetail(category.id)}
            />
          )
        )}

        {adding && (
          <CategoryForm
            kind={kind}
            saving={saving}
            onSave={(values) => onSave(null, values)}
            onCancel={onCancel}
          />
        )}
      </div>

      {!adding && (
        <button
          onClick={onAdd}
          className="px-4 py-2.5 border-t border-gray-100 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 flex items-center justify-center transition-colors"
        >
          <Plus size={13} className="mr-1.5" />
          Add a category
        </button>
      )}
    </div>
  );
}

/** The one number the lanes exist to produce. */
function LoanCard({ lanes, baseCurrency }: { lanes: Lanes; baseCurrency: string }) {
  const short = lanes.loan > 0;
  const tone = short
    ? { ring: 'border-rose-200', bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-500' }
    : { ring: 'border-emerald-200', bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' };

  return (
    <div className={`rounded-xl border-2 ${tone.ring} ${tone.bg} px-5 py-4`}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <span className={`h-2.5 w-2.5 rounded-full ${tone.dot}`} />
          <div>
            <p className={`text-xs font-semibold uppercase tracking-wider ${tone.text}`}>
              {short ? 'Loan needed' : 'No loan needed'}
            </p>
            <p className="text-xs text-gray-600 mt-0.5">
              {formatMoney(lanes.available, baseCurrency)} by {dateLabel(lanes.horizon)} against{' '}
              {formatMoney(lanes.budget, baseCurrency)} budgeted
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Landmark size={18} className={tone.text} />
          <p className={`text-2xl font-bold tabular-nums ${tone.text}`}>
            {formatMoney(Math.abs(lanes.difference), baseCurrency)}
          </p>
          {!short && <span className="text-xs text-gray-600">spare</span>}
        </div>
      </div>

      {lanes.budgetPaid > 0 && (
        <p className="text-xs text-gray-600 mt-3 pt-3 border-t border-white/70">
          {formatMoney(lanes.budgetPaid, baseCurrency)} of the budget is already paid ·{' '}
          {formatMoney(lanes.budgetOutstanding, baseCurrency)} still to pay
        </p>
      )}
    </div>
  );
}

export default function PlanLanes({
  budgetCategories, fundCategories, lanes, baseCurrency, saving,
  editing, addingTo, onEdit, onAdd, onSave, onDelete, onCancel, onJumpToDetail,
}: {
  budgetCategories: PlanCategory[];
  fundCategories: PlanCategory[];
  lanes: Lanes;
  baseCurrency: string;
  saving: boolean;
  editing: string | null;
  addingTo: PlanKind | null;
  onEdit: (id: string | null) => void;
  onAdd: (kind: PlanKind) => void;
  onSave: (kind: PlanKind, id: string | null, values: PlanCategoryInput) => void;
  onDelete: (id: string) => void;
  onCancel: () => void;
  onJumpToDetail: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        <Lane
          kind="cost"
          categories={budgetCategories}
          baseCurrency={baseCurrency}
          total={lanes.budget}
          horizon={lanes.horizon}
          editing={editing}
          adding={addingTo === 'cost'}
          saving={saving}
          onEdit={onEdit}
          onAdd={() => onAdd('cost')}
          onSave={(id, values) => onSave('cost', id, values)}
          onDelete={onDelete}
          onCancel={onCancel}
          onJumpToDetail={onJumpToDetail}
        />
        <Lane
          kind="fund"
          categories={fundCategories}
          baseCurrency={baseCurrency}
          total={lanes.available}
          horizon={lanes.horizon}
          editing={editing}
          adding={addingTo === 'fund'}
          saving={saving}
          onEdit={onEdit}
          onAdd={() => onAdd('fund')}
          onSave={(id, values) => onSave('fund', id, values)}
          onDelete={onDelete}
          onCancel={onCancel}
          onJumpToDetail={onJumpToDetail}
        />
      </div>

      <LoanCard lanes={lanes} baseCurrency={baseCurrency} />
    </div>
  );
}
