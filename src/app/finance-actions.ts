'use server';

import { revalidatePath } from 'next/cache';
import { supabase, tenantFilter, USER_ID, WORKSPACE_ID } from '@/lib/supabase';
import { fetchMoneyMonth, type MoneyMonth } from '@/lib/finance';

/** Month navigation without a full page round trip. */
export async function loadMoneyMonth(month: string): Promise<MoneyMonth> {
  return fetchMoneyMonth(month);
}

/* Writes go straight to Postgres like the reads do. The validation that lives
 * in planner_core (currency handling, category snapping) applies to what Claude
 * logs conversationally; these are corrections made against rows already on
 * screen, so they stay deliberately thin. */

export interface TransactionInput {
  date: string;
  description: string;
  amount: number;
  currency: string;
  type: 'expense' | 'income';
  category: string | null;
  merchant?: string | null;
  payment_method?: string | null;
  notes?: string | null;
}

function validate(input: Partial<TransactionInput>): string | null {
  if (input.description !== undefined && !String(input.description).trim()) {
    return 'Description is required';
  }
  if (input.amount !== undefined && !(Number(input.amount) > 0)) {
    return 'Amount must be greater than zero';
  }
  if (input.type !== undefined && !['expense', 'income'].includes(input.type)) {
    return 'Type must be expense or income';
  }
  return null;
}

export async function createTransaction(input: TransactionInput) {
  const problem = validate(input);
  if (problem) return { ok: false, error: problem };

  const { error } = await supabase().from('finance_logs').insert({
    ...input,
    description: input.description.trim(),
    amount: Number(input.amount),
    currency: (input.currency || 'INR').toUpperCase(),
    user_id: USER_ID,
    workspace_id: WORKSPACE_ID,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath('/');
  return { ok: true };
}

export async function updateTransaction(id: string, updates: Partial<TransactionInput>) {
  const problem = validate(updates);
  if (problem) return { ok: false, error: problem };

  const payload: Record<string, unknown> = { ...updates, updated_at: new Date().toISOString() };
  if (payload.amount !== undefined) payload.amount = Number(payload.amount);
  if (payload.currency) payload.currency = String(payload.currency).toUpperCase();
  if (typeof payload.description === 'string') payload.description = payload.description.trim();

  const { error } = await tenantFilter(
    supabase().from('finance_logs').update(payload)
  ).eq('id', id);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/');
  return { ok: true };
}

export async function deleteTransaction(id: string) {
  const { error } = await tenantFilter(
    supabase().from('finance_logs').delete()
  ).eq('id', id);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/');
  return { ok: true };
}
