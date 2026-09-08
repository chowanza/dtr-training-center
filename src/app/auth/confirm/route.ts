import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureProfileForAuthUser } from "@/lib/auth-provision";

/**
 * Handles Supabase's email links (signup confirmation, password recovery, email change) using
 * the token_hash + verifyOtp pattern — Supabase's own recommended approach for Next.js SSR apps.
 * The default `{{ .ConfirmationURL }}` template variable points straight at Supabase's /verify
 * endpoint, which redirects back with the session in a URL *fragment* (#access_token=...) — a
 * fragment never reaches the server, so a route handler can't read it. This route instead expects
 * the email template to link here with `?token_hash={{ .TokenHash }}&type=...`, which verifyOtp
 * exchanges for a real server-side session (cookies set via createSupabaseServerClient).
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";

  if (token_hash && type) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error && data.user) {
      const meta = data.user.user_metadata as { name?: string; orgName?: string };
      await ensureProfileForAuthUser({ authUserId: data.user.id, email: data.user.email!, name: meta.name ?? data.user.email!, orgName: meta.orgName });
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
