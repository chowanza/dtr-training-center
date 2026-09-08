import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureProfileForAuthUser } from "@/lib/auth-provision";

/** Where the confirmation email points. Exchanges the PKCE `code` for a real session, then makes
 * sure a `profiles` row exists for this person (linking to one an admin already made, or
 * bootstrapping a brand-new organization for them — see ensureProfileForAuthUser). */
export async function GET(request: Request) {
  // Not new URL(request.url).origin — see the comment in src/app/auth/confirm/route.ts.
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      const meta = data.user.user_metadata as { name?: string; orgName?: string };
      await ensureProfileForAuthUser({
        authUserId: data.user.id,
        email: data.user.email!,
        name: meta.name ?? data.user.email!,
        orgName: meta.orgName,
      });
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
