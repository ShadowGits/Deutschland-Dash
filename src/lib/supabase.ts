import { createClient, SupabaseClient } from '@supabase/supabase-js';

/* Server-only Supabase client.
 *
 * The rest of the dashboard reads through the Planner OS API on Cloud Run,
 * which sleeps when idle and costs a few seconds of cold start on the first
 * request. The money screen skips that hop and queries Postgres directly, so
 * it paints in about the time one round trip takes.
 *
 * Only import this from server components and server actions — the service
 * role key bypasses row level security and must never reach the browser.
 */

const URL = process.env.SUPABASE_URL || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const USER_ID = process.env.PLANNER_USER_ID || '';

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!URL || !SERVICE_KEY) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for direct database reads'
    );
  }
  if (!client) {
    client = createClient(URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

export function isDirectReadConfigured(): boolean {
  return Boolean(URL && SERVICE_KEY && USER_ID);
}

/* The active workspace is looked up from the user id rather than configured
 * separately — one less value to find and keep in sync, and it follows the
 * user if they ever switch workspaces. Cached for the life of the process
 * since it does not change under us. */
let workspaceId: string | null = null;

export async function activeWorkspaceId(): Promise<string> {
  if (workspaceId) return workspaceId;

  const { data, error } = await supabase()
    .from('workspaces')
    .select('id')
    .eq('user_id', USER_ID)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Could not resolve workspace: ${error.message}`);
  if (!data) throw new Error('No active Planner OS workspace for this user');

  workspaceId = data.id as string;
  return workspaceId;
}

/** Scope a query to the one tenant, matching the row level security policies
 *  that the service role key would otherwise bypass. */
export function tenantFilter<T>(query: T, workspace: string): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (query as any).eq('user_id', USER_ID).eq('workspace_id', workspace);
}
