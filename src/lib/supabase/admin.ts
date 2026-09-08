import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client — bypasses RLS and Auth restrictions entirely. Only for
 * operations an end user's own session genuinely can't do (e.g. an admin setting someone else's
 * password). Never import this into anything that runs in the browser.
 */
export function createSupabaseAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
