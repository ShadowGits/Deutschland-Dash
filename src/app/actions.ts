"use server";

import { revalidatePath } from 'next/cache';
import { createProjectQna as apiCreateQna, updateProjectQna as apiUpdateQna, deleteProjectQna as apiDeleteQna } from '@/lib/api';

export async function createQnaAction(projectId: string, data: { question: string, answer?: string, status?: string, notes?: string }) {
  await apiCreateQna(projectId, data);
  revalidatePath('/');
}

export async function updateQnaAction(qnaId: string, data: { question?: string, answer?: string, status?: string, notes?: string }) {
  await apiUpdateQna(qnaId, data);
  revalidatePath('/');
}

export async function deleteQnaAction(qnaId: string) {
  await apiDeleteQna(qnaId);
  revalidatePath('/');
}

export async function fetchTableAction(projectId: string, tableName: string) {
  const { fetchProjectTable } = await import('@/lib/api');
  return fetchProjectTable(projectId, tableName);
}
