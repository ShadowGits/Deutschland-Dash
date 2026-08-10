'use server';

import { revalidatePath } from 'next/cache';
import { makeRequest, fetchProjectFiles } from '@/lib/api';
import { createProjectQna as apiCreateQna, updateProjectQna as apiUpdateQna, deleteProjectQna as apiDeleteQna, fetchProjectTable } from '@/lib/api';

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

export async function connectGoogleCalendar(workspaceId: string) {
  const res = await makeRequest<{ authorization_url: string }>(`/api/workspaces/${workspaceId}/google-calendar/connect`, {
    method: 'POST',
  });
  return res;
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


export async function addTaskToProject(projectId: string, title: string, scheduledDate?: string, milestoneId?: string) {
  const payload: any = { title, scheduled_date: scheduledDate };
  if (milestoneId) payload.milestone_id = milestoneId;
  const res = await makeRequest(`/v2/projects/${projectId}/tasks`, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' }
  });

  revalidatePath('/');
  return res !== null;
}

export async function getProjectTasks(projectId: string) {
  const res = await makeRequest<{ tasks: any[] }>(`/v2/projects/${projectId}/tasks`);
  return res?.tasks || [];
}

export async function updateTask(taskId: string, updates: { title?: string; scheduled_date?: string; start_time?: string; estimated_minutes?: number; milestone_id?: string | null }) {
  const res = await makeRequest(`/v2/day/tasks/${taskId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
    headers: { 'Content-Type': 'application/json' }
  });
  revalidatePath('/');
  return res !== null;
}

export async function getProjectMilestones(projectId: string) {
  const res = await makeRequest<{ milestones: any[] }>(`/v2/projects/${projectId}/milestones`);
  return res?.milestones || [];
}

export async function createProjectMilestone(projectId: string, name: string, targetDate?: string) {
  const payload: any = { name };
  if (targetDate) payload.target_date = targetDate;
  const res = await makeRequest<{ milestone: any }>(`/v2/projects/${projectId}/milestones`, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' }
  });
  revalidatePath('/');
  return res;
}

export async function linkTaskToMilestone(taskId: string, milestoneId: string | null) {
  const res = await makeRequest(`/v2/day/tasks/${taskId}`, {
    method: 'PATCH',
    body: JSON.stringify({ milestone_id: milestoneId }),
    headers: { 'Content-Type': 'application/json' }
  });
  revalidatePath('/');
  return res !== null;
}

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

export async function fetchWidgetsAction(projectId: string) {
  const { makeRequest } = await import('@/lib/api');
  const res = await makeRequest<{ widgets: any[] }>(`/v2/projects/${projectId}/widgets`, { cache: 'no-store' });
  return res?.widgets || [];
}

export async function createWidgetAction(projectId: string, data: { widget_type: string, title?: string, file_id?: string, config?: any }) {
  const { makeRequest } = await import('@/lib/api');
  await makeRequest(`/v2/projects/${projectId}/widgets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  revalidatePath('/');
}

export async function deleteWidgetAction(widgetId: string) {
  const { makeRequest } = await import('@/lib/api');
  await makeRequest(`/v2/widgets/${widgetId}`, { method: 'DELETE' });
  revalidatePath('/');
}

export async function updateWidgetAction(widgetId: string, data: { title?: string, file_id?: string, config?: any, order_index?: number }) {
  const { makeRequest } = await import('@/lib/api');
  await makeRequest(`/v2/widgets/${widgetId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  revalidatePath('/');
}
