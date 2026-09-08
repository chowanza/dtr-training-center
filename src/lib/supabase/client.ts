import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client. Not used by the login flow (that's a server action calling
 * createSupabaseServerClient) — kept here for any future client component that needs realtime
 * or direct client-side auth state (e.g. reacting to sign-out across tabs).
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
