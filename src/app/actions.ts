'use server';

import { revalidatePath } from 'next/cache';
import { makeRequest } from '@/lib/api';

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

export async function deleteProjectFile(projectId: string, fileId: string) {
  const res = await makeRequest(`/v2/projects/${projectId}/files/${fileId}`, {
    method: 'DELETE'
  });
  
  revalidatePath('/');
  return res !== null;
}
