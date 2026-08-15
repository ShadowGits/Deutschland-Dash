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
export const WORKSPACE_ID = process.env.PLANNER_WORKSPACE_ID || '';

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
  return Boolean(URL && SERVICE_KEY && USER_ID && WORKSPACE_ID);
}

/** Every query is scoped to the one workspace, matching the RLS policies the
 *  service role key would otherwise bypass. */
export function tenantFilter<T>(query: T): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (query as any).eq('user_id', USER_ID).eq('workspace_id', WORKSPACE_ID);
}
