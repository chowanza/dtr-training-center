import "server-only";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { createSupabaseServerClient } from "./supabase/server";
import { db } from "./drizzle/client";
import { profiles } from "./drizzle/schema";

export type CurrentUser = typeof profiles.$inferSelect;

/**
 * Looked up by auth_user_id, not by organization — at this point we don't know the caller's org
 * yet (that's what this lookup is for). Safe unscoped: the app's DB role is BYPASSRLS (verified),
 * and this is the one place in the codebase allowed to query profiles without an org filter.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return null;

  const rows = await db.select().from(profiles).where(eq(profiles.authUserId, authUser.id)).limit(1);
  return rows[0] ?? null;
}

/** For Server Components/Actions that require a signed-in profile — sends anyone else to /login. */
export async function requireCurrentUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
