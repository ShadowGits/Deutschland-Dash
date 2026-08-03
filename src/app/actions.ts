'use server';

import { revalidatePath } from 'next/cache';
import { makeRequest, fetchProjectFiles } from '@/lib/api';

export async function addMonthlyGoal(projectId: string, month: string, description: string) {
  const payload = { project_id: projectId, month, description };
  const res = await makeRequest('/v2/goals/monthly', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' }
  });
  
  revalidatePath('/');
  return res !== null;
}

export async function updateMonthlyGoal(goalId: string, description: string) {
  const payload = { description };
  const res = await makeRequest(`/v2/goals/monthly/${goalId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' }
  });
  
  revalidatePath('/');
  return res !== null;
}

export async function deleteMonthlyGoal(goalId: string) {
  const res = await makeRequest(`/v2/goals/monthly/${goalId}`, {
    method: 'DELETE'
  });
  
  revalidatePath('/');
  return res !== null;
}

export async function updateTaskStatus(taskId: string, done: boolean) {
  const payload = { done };
  const res = await makeRequest(`/v2/day/tasks/${taskId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' }
  });
  
  revalidatePath('/'); // or path to week view
  return res !== null;
}

export async function createProjectDocument(projectId: string, name: string, fileType: 'text' | 'excel') {
  const payload = { name, file_type: fileType };
  const res = await makeRequest<{ file: any }>(`/v2/projects/${projectId}/files/create-document`, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' }
  });
  
  revalidatePath('/');
  return res?.file || null;
}

export async function getProjectFiles(projectId: string) {
  return await fetchProjectFiles(projectId);
}

export async function uploadProjectFile(projectId: string, formData: FormData): Promise<{ file: any | null; error: string | null }> {
  const baseUrl = process.env.NEXT_PUBLIC_PLANNER_API_URL || 'https://planner-os-api-645411441153.us-central1.run.app';
  const apiKey = process.env.PLANNER_APP_KEY || '';

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/v2/projects/${projectId}/files/upload`, {
      method: 'POST',
      headers: {
        'X-App-Key': apiKey,
      },
      body: formData,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return { file: null, error: `Upload failed (${response.status}): ${text || response.statusText}` };
    }

    const data = await response.json();
    if (!data?.success) {
      return { file: null, error: data?.message || 'Upload failed' };
    }

    revalidatePath('/');
    return { file: data?.data?.file || null, error: null };
  } catch (err) {
    console.error('Upload project file error:', err);
    return { file: null, error: err instanceof Error ? err.message : 'Upload failed unexpectedly' };
  }
}

export async function deleteProjectFile(projectId: string, fileId: string) {
  const res = await makeRequest(`/v2/projects/${projectId}/files/${fileId}`, {
    method: 'DELETE'
  });
  
  revalidatePath('/');
  return res !== null;
}


export async function downloadProjectFile(projectId: string, fileId: string) {
  const baseUrl = process.env.NEXT_PUBLIC_PLANNER_API_URL || 'https://planner-os-api-645411441153.us-central1.run.app';
  const apiKey = process.env.PLANNER_APP_KEY || '';
  
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/v2/projects/${projectId}/files/${fileId}/download`, {
      headers: { 'X-App-Key': apiKey }
    });
    if (!res.ok) return null;
    return await res.text();
  } catch (e) {
    console.error(e);
    return null;
  }
}

export async function getProjectTasks(projectId: string) {
  const res = await makeRequest<{ tasks: any[] }>(`/v2/projects/${projectId}/tasks`);
  return res?.tasks || [];
}

import { createProjectQna as apiCreateQna, updateProjectQna as apiUpdateQna, deleteProjectQna as apiDeleteQna, fetchProjectTable } from '@/lib/api';

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
  return fetchProjectTable(projectId, tableName);
}
