'use server';

import { revalidatePath } from 'next/cache';
import { supabase, tenantFilter, USER_ID, activeWorkspaceId } from '@/lib/supabase';
import {
  fetchFunding, type FundingData, type PlanKind, type Certainty,
} from '@/lib/funding';

/* Writes go straight to Postgres like the reads do, mirroring the validation
 * in FinanceService.add_plan_item so a row typed here and a row Claude adds
 * through MCP are the same shape. The check constraints in migration 0032 are
 * the backstop for both. */

const KINDS: PlanKind[] = ['cost', 'fund'];
const CERTAINTIES: Certainty[] = ['confirmed', 'likely', 'maybe'];
const MAX_INSTALMENTS = 600;

export interface PlanItemInput {
  kind: PlanKind;
  label: string;
  amount: number;
  currency: string;
  category: string | null;
  due_date: string | null;
  instalments: number;
  certainty: Certainty;
  notes?: string | null;
}

export async function reloadFunding(): Promise<FundingData> {
  return fetchFunding();
}

function validate(input: Partial<PlanItemInput>): string | null {
  if (input.kind !== undefined && !KINDS.includes(input.kind)) {
    return 'A line is either a cost or a source of money';
  }
  if (input.label !== undefined && !String(input.label).trim()) {
    return 'Give the line a name';
  }
  if (input.amount !== undefined && !(Number(input.amount) > 0)) {
    return 'Amount must be greater than zero';
  }
  if (input.certainty !== undefined && !CERTAINTIES.includes(input.certainty)) {
    return 'Certainty must be confirmed, likely or maybe';
  }
  if (input.instalments !== undefined) {
    const count = Number(input.instalments);
    if (!Number.isInteger(count) || count < 1 || count > MAX_INSTALMENTS) {
      return `Instalments must be a whole number between 1 and ${MAX_INSTALMENTS}`;
    }
  }
  return null;
}

/** The only columns a write may touch. Editing a row hands this the computed
 *  view of it — estimate, settled, outstanding — and those are not columns, so
 *  spreading the input straight into the update would make Postgres reject the
 *  whole statement. */
const WRITABLE = [
  'kind', 'label', 'amount', 'currency', 'category',
  'due_date', 'instalments', 'certainty', 'notes',
] as const;

/** Shared shape for the write paths: normalise once, in one place. */
function normalise(input: Partial<PlanItemInput>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const key of WRITABLE) {
    if (input[key] !== undefined) payload[key] = input[key];
  }
  if (typeof payload.label === 'string') payload.label = payload.label.trim();
  if (payload.amount !== undefined) payload.amount = Number(payload.amount);
  if (payload.instalments !== undefined) payload.instalments = Number(payload.instalments);
  if (payload.currency) payload.currency = String(payload.currency).toUpperCase();
  if (payload.due_date === '') payload.due_date = null;
  if (payload.category === '') payload.category = null;
  return payload;
}

export async function createPlanItem(planId: string, input: PlanItemInput) {
  const problem = validate(input);
  if (problem) return { ok: false, error: problem };

  try {
    const workspace = await activeWorkspaceId();
    // New lines go to the end of their own side of the plan.
    const { data: siblings } = await tenantFilter(
      supabase().from('finance_plan_items').select('sort_order'),
      workspace
    ).eq('plan_id', planId).eq('kind', input.kind)
      .order('sort_order', { ascending: false }).limit(1);

    const { error } = await supabase().from('finance_plan_items').insert({
      ...normalise(input),
      plan_id: planId,
      sort_order: siblings?.length ? Number(siblings[0].sort_order || 0) + 1 : 0,
      user_id: USER_ID,
      workspace_id: workspace,
    });
    if (error) throw new Error(error.message);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Could not save' };
  }

  revalidatePath('/');
  return { ok: true };
}

export async function updatePlanItem(id: string, updates: Partial<PlanItemInput>) {
  const problem = validate(updates);
  if (problem) return { ok: false, error: problem };

  try {
    const workspace = await activeWorkspaceId();
    const { error } = await tenantFilter(
      supabase().from('finance_plan_items').update({
        ...normalise(updates),
        updated_at: new Date().toISOString(),
      }),
      workspace
    ).eq('id', id);
    if (error) throw new Error(error.message);

    // A paid line's amount IS what it cost, so correcting the line has to
    // correct the spending it recorded. Leaving them apart would show the
    // edit as an overspend or a balance still owing on something settled.
    const { data: logs } = await tenantFilter(
      supabase().from('finance_logs').select('id'),
      workspace
    ).eq('plan_item_id', id);

    if (logs?.length === 1) {
      const { data: item } = await tenantFilter(
        supabase().from('finance_plan_items').select('label,category,amount,currency,instalments'),
        workspace
      ).eq('id', id).single();

      if (item) {
        await tenantFilter(
          supabase().from('finance_logs').update({
            description: String(item.label || 'Plan payment').trim(),
            amount: Number(item.amount || 0) * Math.max(1, Number(item.instalments || 1)),
            currency: String(item.currency || 'INR').toUpperCase(),
            category: item.category || null,
            updated_at: new Date().toISOString(),
          }),
          workspace
        ).eq('id', logs[0].id);
      }
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Could not save' };
  }

  revalidatePath('/');
  return { ok: true };
}

export async function deletePlanItem(id: string) {
  try {
    const workspace = await activeWorkspaceId();
    // The foreign key clears plan_item_id on anything logged against this
    // line, so the spending stays in the passbook and only stops being
    // attributed to the plan.
    const { error } = await tenantFilter(
      supabase().from('finance_plan_items').delete(),
      workspace
    ).eq('id', id);
    if (error) throw new Error(error.message);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Could not delete' };
  }

  revalidatePath('/');
  return { ok: true };
}

export async function updatePlan(
  id: string,
  updates: { name?: string; eur_rate?: number; notes?: string | null }
) {
  if (updates.name !== undefined && !String(updates.name).trim()) {
    return { ok: false, error: 'Give the plan a name' };
  }
  if (updates.eur_rate !== undefined && !(Number(updates.eur_rate) > 0)) {
    return { ok: false, error: 'The euro rate must be greater than zero' };
  }

  try {
    const workspace = await activeWorkspaceId();
    const payload: Record<string, unknown> = { ...updates, updated_at: new Date().toISOString() };
    if (typeof payload.name === 'string') payload.name = payload.name.trim();
    if (payload.eur_rate !== undefined) payload.eur_rate = Number(payload.eur_rate);

    const { error } = await tenantFilter(
      supabase().from('finance_plans').update(payload),
      workspace
    ).eq('id', id);
    if (error) throw new Error(error.message);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Could not save' };
  }

  revalidatePath('/');
  return { ok: true };
}

/** Mark a cost paid. One click, no form.
 *
 *  The line's own amount is what gets written, because the line's amount is
 *  the real cost — a separate "what did it actually come to" step would be
 *  asking the same number twice. Correcting it means editing the line, and
 *  the transaction follows. */
export async function markPaid(planItemId: string) {
  try {
    const workspace = await activeWorkspaceId();
    const { data: item, error: readError } = await tenantFilter(
      supabase().from('finance_plan_items').select('label,category,amount,currency,instalments'),
      workspace
    ).eq('id', planItemId).single();

    if (readError) throw new Error(readError.message);
    if (!item) throw new Error('That line no longer exists');

    // Marking paid twice would stack a second charge onto the same line.
    const { data: existing, error: existingError } = await tenantFilter(
      supabase().from('finance_logs').select('id'),
      workspace
    ).eq('plan_item_id', planItemId).limit(1);
    if (existingError) throw new Error(existingError.message);
    if (existing?.length) return { ok: true };

    const { error } = await supabase().from('finance_logs').insert({
      date: new Date().toISOString().slice(0, 10),
      description: String(item.label || 'Plan payment').trim(),
      amount: Number(item.amount || 0) * Math.max(1, Number(item.instalments || 1)),
      currency: String(item.currency || 'INR').toUpperCase(),
      type: 'expense',
      category: item.category || null,
      plan_item_id: planItemId,
      user_id: USER_ID,
      workspace_id: workspace,
    });
    if (error) throw new Error(error.message);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Could not mark it paid' };
  }

  revalidatePath('/');
  return { ok: true };
}

/** Undo it. Removes the spending this line recorded, so a mis-click is not
 *  permanent and does not have to be hunted down on another screen. */
export async function markUnpaid(planItemId: string) {
  try {
    const workspace = await activeWorkspaceId();
    const { error } = await tenantFilter(
      supabase().from('finance_logs').delete(),
      workspace
    ).eq('plan_item_id', planItemId);
    if (error) throw new Error(error.message);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Could not undo it' };
  }

  revalidatePath('/');
  return { ok: true };
}

/** Attribute a logged expense to a plan line, or pass null to detach it. */
export async function linkTransaction(transactionId: string, planItemId: string | null) {
  try {
    const workspace = await activeWorkspaceId();
    const { error } = await tenantFilter(
      supabase().from('finance_logs').update({
        plan_item_id: planItemId,
        updated_at: new Date().toISOString(),
      }),
      workspace
    ).eq('id', transactionId);
    if (error) throw new Error(error.message);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Could not link' };
  }

  revalidatePath('/');
  return { ok: true };
}
