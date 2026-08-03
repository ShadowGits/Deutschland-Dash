

const BASE_URL = process.env.NEXT_PUBLIC_PLANNER_API_URL || "https://planner-os-api-645411441153.us-central1.run.app";
const APP_KEY = process.env.PLANNER_APP_KEY;

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export async function makeRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T | null> {
  const url = `${BASE_URL.replace(/\/$/, '')}${path}`;
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  
  if (APP_KEY) {
    headers.set('X-App-Key', APP_KEY);
  }

  try {
    const isMutation = options.method && options.method !== 'GET';
    const res = await fetch(url, {
      ...options,
      headers,
      ...(isMutation ? { cache: 'no-store' as const } : { next: { revalidate: 30 } }),
    });

    if (!res.ok) {
      console.error(`API Error HTTP ${res.status} on ${path}`);
      return null;
    }

    const payload: ApiResponse<T> = await res.json();
    if (!payload.success) {
      console.error(`API reported failure: ${payload.message}`);
      return null;
    }

    return payload.data;
  } catch (error) {
    console.error(`Fetch failed for ${path}:`, error);
    return null;
  }
}

// Fetch Functions (Server-side)
export async function fetchMetrics() {
  const data = await makeRequest<{ snapshot: any, flat: any }>('/v2/dashboard/metrics');
  return data?.snapshot || null;
}

export async function fetchWeekView(dateStr?: string) {
  const path = dateStr ? `/v2/week?date=${dateStr}` : '/v2/week';
  return await makeRequest<any>(path);
}

export async function updateTaskStatus(taskId: string, done: boolean) {
  return await makeRequest<any>(`/v2/day/tasks/${taskId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ done })
  });
}

export async function fetchStudyTopics() {
  const res = await makeRequest<{ topics: any[] }>('/v2/study/topics');
  return res?.topics || [];
}

export async function fetchBooks() {
  const res = await makeRequest<{ books: any[] }>('/v2/books');
  return res?.books || [];
}

export async function fetchGermanyDocuments() {
  const res = await makeRequest<{ documents: any[] }>('/v2/germany/documents');
  return res?.documents || [];
}

export async function fetchFinanceGoals() {
  const res = await makeRequest<{ goals: any[] }>('/v2/finance/goals');
  return res?.goals || [];
}

export async function fetchProjectFiles(projectId: string) {
  const res = await makeRequest<{ files: any[] }>(`/v2/projects/${projectId}/files`);
  return res?.files || [];
}

export async function deleteTask(taskId: string) {
  return makeRequest(`/v2/day/tasks/${taskId}`, { method: 'DELETE' });
}

export async function fetchProjectTable(projectId: string, tableName: string) {
  const res = await makeRequest<{ [key: string]: any[] }>(`/v2/projects/${projectId}/${tableName}`);
  return res?.[tableName] || [];
}

export async function createProjectQna(projectId: string, data: { question: string, answer?: string, status?: string, notes?: string }) {
  return makeRequest(`/v2/projects/${projectId}/project_qna`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
}

export async function updateProjectQna(qnaId: string, data: { question?: string, answer?: string, status?: string, notes?: string }) {
  return makeRequest(`/v2/project_qna/${qnaId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
}

export async function deleteProjectQna(qnaId: string) {
  return makeRequest(`/v2/project_qna/${qnaId}`, { method: 'DELETE' });
}
