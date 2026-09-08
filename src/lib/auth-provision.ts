import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "./drizzle/client";
import { profiles, organizations, roles } from "./drizzle/schema";

function slugify(name: string) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "org";
  return `${base}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Runs once, right after a person's email is confirmed (called from /auth/callback). Links this
 * auth user to a profile so requireCurrentUser() can find them:
 *  - already linked (e.g. the trigger beat us to it) -> no-op
 *  - an admin already provisioned this email (People -> Add Person) -> link to that profile,
 *    keeping whatever org/role/access level was already set for them
 *  - brand new email -> this is a fresh company signing up: create the organization, a default
 *    "Owner" role, and an admin profile for this person
 */
export async function ensureProfileForAuthUser(params: { authUserId: string; email: string; name: string; orgName?: string }) {
  const email = params.email.toLowerCase();

  const [already] = await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.authUserId, params.authUserId)).limit(1);
  if (already) return;

  const [unlinked] = await db.select().from(profiles).where(and(eq(profiles.email, email), isNull(profiles.authUserId))).limit(1);
  if (unlinked) {
    await db.update(profiles).set({ authUserId: params.authUserId }).where(eq(profiles.id, unlinked.id));
    return;
  }

  const orgName = params.orgName?.trim() || `${params.name}'s Organization`;
  const [org] = await db.insert(organizations).values({ name: orgName, slug: slugify(orgName) }).returning();
  const [ownerRole] = await db.insert(roles).values({ organizationId: org.id, name: "Owner", description: "", parentRoleId: null }).returning();
  await db.insert(profiles).values({
    authUserId: params.authUserId,
    organizationId: org.id,
    email,
    name: params.name || email,
    roleId: ownerRole.id,
    accessRole: "admin",
    employmentStatus: "active",
  });
}
