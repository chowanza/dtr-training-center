import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { requireCurrentUser } from "@/lib/session";
import { withTenantContext } from "@/lib/drizzle/client";
import * as schema from "@/lib/drizzle/schema";
import { completionForUser, learnerModuleProgress } from "@/lib/derive";
import { StatusPill } from "@/components/StatusPill";
import { updateUser, setUserActive, adminSetUserPassword } from "@/lib/actions";

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export default async function PersonDetailPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const viewer = await requireCurrentUser();
  const orgId = viewer.organizationId;

  const { user, roles, modules, certifications, assignments, requirements, memberGroups } = await withTenantContext(orgId, async (tx) => {
    const [user] = await tx.select().from(schema.profiles).where(and(eq(schema.profiles.organizationId, orgId), eq(schema.profiles.id, userId))).limit(1);
    if (!user) return { user: undefined, roles: [], modules: [], certifications: [], assignments: [], requirements: [], memberGroups: [] };
    const roles = await tx.select().from(schema.roles).where(eq(schema.roles.organizationId, orgId));
    const modules = await tx.select().from(schema.modules).where(eq(schema.modules.organizationId, orgId));
    const certifications = await tx
      .select()
      .from(schema.certifications)
      .where(and(eq(schema.certifications.organizationId, orgId), eq(schema.certifications.userId, userId)));
    const assignments = await tx.select().from(schema.assignments).where(and(eq(schema.assignments.organizationId, orgId), eq(schema.assignments.userId, userId)));
    const requirements = await tx
      .select()
      .from(schema.roleModuleRequirements)
      .where(and(eq(schema.roleModuleRequirements.organizationId, orgId), eq(schema.roleModuleRequirements.roleId, user.roleId), eq(schema.roleModuleRequirements.isRequired, true)))
      .orderBy(schema.roleModuleRequirements.sequence);
    const memberRows = await tx.select().from(schema.groupMembers).where(and(eq(schema.groupMembers.organizationId, orgId), eq(schema.groupMembers.userId, userId)));
    const groupIds = memberRows.map((m) => m.groupId);
    const allGroups = groupIds.length ? await tx.select().from(schema.groups).where(eq(schema.groups.organizationId, orgId)) : [];
    const memberGroups = groupIds.map((gid) => allGroups.find((g) => g.id === gid)).filter((g): g is NonNullable<typeof g> => Boolean(g));
    return { user, roles, modules, certifications, assignments, requirements, memberGroups };
  });
  if (!user) notFound();

  // "Training path": this role's required modules in sequence order first (their actual
  // onboarding order), then anything else they have a certification for but isn't currently
  // required (e.g. a past role's module) tacked on at the end so history never just disappears.
  const moduleById = new Map(modules.map((m) => [m.id, m]));
  const requiredIds = new Set(requirements.map((r) => r.moduleId));
  const pathModules = [
    ...requirements.map((r) => moduleById.get(r.moduleId)).filter((m): m is NonNullable<typeof m> => Boolean(m)),
    ...modules.filter((m) => !requiredIds.has(m.id) && certifications.some((c) => c.moduleId === m.id)).sort((a, b) => a.title.localeCompare(b.title)),
  ];

  // No due-date UI yet (assignments.dueAt is always null today) — until then, "overdue" means
  // assigned two weeks ago or more and still not certified. Simple, no new infra, matches the
  // spirit of Trainual's "who still needs a nudge" flag closely enough to be useful now.
  const OVERDUE_AFTER_MS = 14 * 24 * 60 * 60 * 1000;
  const assignedAtByModule = new Map(assignments.map((a) => [a.moduleId, a.assignedAt]));
  const isStaffViewer = viewer.accessRole === "admin" || viewer.accessRole === "editor";

  const { done, total, pct } = await completionForUser(orgId, userId);
  const progressByModule = await learnerModuleProgress(orgId, userId, pathModules.map((m) => m.id));

  return (
    <div className="max-w-2xl">
      <Link href="/people" className="text-xs font-[var(--font-mono)] text-ink-3 hover:text-navy">
        ← People
      </Link>

      <div className="flex items-center gap-4 mt-3 mb-6">
        <span className="w-12 h-12 rounded-full bg-navy-soft text-navy text-base font-semibold flex items-center justify-center font-[var(--font-display)] shrink-0">
          {initials(user.name)}
        </span>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="font-[var(--font-display)] font-bold text-2xl tracking-tight">{user.name}</h1>
            {user.employmentStatus === "inactive" && <span className="pill p-neutral">Inactive</span>}
          </div>
          <p className="text-ink-2 text-sm">
            {total > 0 ? `${done} of ${total} required modules certified · ${pct}%` : "No content required for this role yet"}
          </p>
        </div>
      </div>

      {memberGroups.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {memberGroups.map((g) => (
            <Link key={g.id} href={`/groups/${g.id}`} className="pill p-neutral hover:border-navy hover:text-navy">
              {g.name}
            </Link>
          ))}
        </div>
      )}

      {viewer.accessRole === "admin" && (
        <div className="border border-rule rounded-xl bg-surface p-5 mb-8">
          <h2 className="font-[var(--font-display)] font-semibold text-[15px] mb-4">Edit person</h2>
          <form action={updateUser} className="space-y-3">
            <input type="hidden" name="id" value={user.id} />
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="block text-ink-2 mb-1">Full name</span>
                <input name="name" defaultValue={user.name} required className="w-full border border-rule-2 rounded-lg bg-paper px-3 py-2" />
              </label>
              <label className="block text-sm">
                <span className="block text-ink-2 mb-1">Email</span>
                <input name="email" type="email" defaultValue={user.email} required className="w-full border border-rule-2 rounded-lg bg-paper px-3 py-2" />
              </label>
            </div>
            <label className="block text-sm">
              <span className="block text-ink-2 mb-1">Role</span>
              <select name="roleId" defaultValue={user.roleId} className="w-full border border-rule-2 rounded-lg bg-paper px-3 py-2">
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="block text-ink-2 mb-1">Access level</span>
              <select name="accessRole" defaultValue={user.accessRole} className="w-full border border-rule-2 rounded-lg bg-paper px-3 py-2">
                <option value="learner">Learner — takes assigned training only</option>
                <option value="editor">Editor — can author &amp; publish content</option>
                <option value="admin">Admin — full access, incl. people &amp; certifying</option>
              </select>
            </label>
            <button type="submit" className="btn-primary">
              Save Changes
            </button>
          </form>
          <div className="border-t border-rule mt-5 pt-5">
            <h3 className="font-[var(--font-mono)] text-[10.5px] uppercase tracking-wider text-ink-3 mb-2">Password</h3>
            {user.authUserId ? (
              <form action={adminSetUserPassword} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="id" value={user.id} />
                <label className="block text-sm">
                  <span className="block text-ink-2 mb-1">New password</span>
                  <input
                    name="password"
                    type="password"
                    required
                    minLength={8}
                    placeholder="At least 8 characters"
                    className="border border-rule-2 rounded-lg bg-paper px-3 py-2 text-sm"
                  />
                </label>
                <button type="submit" className="btn-secondary">
                  Set Password
                </button>
              </form>
            ) : (
              <p className="text-sm text-ink-3">
                {user.name} hasn&apos;t registered an account yet — they need to sign up at{" "}
                <span className="font-[var(--font-mono)]">/register</span> with this email before a password can be set.
              </p>
            )}
          </div>

          <div className="flex items-center gap-3 border-t border-rule mt-5 pt-5">
            <form action={setUserActive}>
              <input type="hidden" name="id" value={user.id} />
              <input type="hidden" name="active" value={user.employmentStatus === "active" ? "false" : "true"} />
              <button type="submit" className="btn-secondary">
                {user.employmentStatus === "active" ? "Deactivate person" : "Reactivate person"}
              </button>
            </form>
            <Link href={`/people/${user.id}/delete`} className="text-xs text-brick hover:underline">
              Delete person permanently
            </Link>
          </div>
        </div>
      )}

      <h2 className="font-[var(--font-display)] font-semibold text-[15px] mb-4">Training path</h2>
      {pathModules.length === 0 ? (
        <p className="text-sm text-ink-3">No content required for this role yet.</p>
      ) : (
        <div className="relative">
          <div className="absolute left-4 top-2 bottom-2 w-px bg-rule" />
          <div>
            {pathModules.map((m, i) => {
              const cert = certifications.find((c) => c.moduleId === m.id);
              const status = cert?.status ?? "not_started";
              const stepPct = progressByModule.get(m.id) ?? 0;
              const assignedAt = assignedAtByModule.get(m.id);
              const isOverdue = Boolean(assignedAt) && status !== "certified" && Date.now() - assignedAt!.getTime() >= OVERDUE_AFTER_MS;
              const isCertified = status === "certified";
              return (
                <div key={m.id} className="relative flex gap-4 pb-6 last:pb-0">
                  <span
                    className={`relative z-10 shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center text-[11px] font-semibold font-[var(--font-mono)] ${
                      isCertified
                        ? "bg-patina border-patina text-white"
                        : status === "not_started"
                          ? "bg-surface border-rule-2 text-ink-3"
                          : "bg-amber-soft border-amber text-amber"
                    }`}
                  >
                    {isCertified ? "✓" : i + 1}
                  </span>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[14.5px] font-medium">{m.title}</span>
                          {isOverdue && <span className="pill p-bad text-[10.5px]">⚠ Overdue</span>}
                          {isOverdue && isStaffViewer && (
                            <a
                              href={`mailto:${user.email}?subject=${encodeURIComponent(`Reminder: ${m.title}`)}&body=${encodeURIComponent(
                                `Hi ${user.name.split(" ")[0]}, following up — you still have "${m.title}" to finish in the Training Center. Let me know if you're stuck on anything.`
                              )}`}
                              className="text-[11px] text-navy hover:underline font-medium"
                            >
                              Nudge
                            </a>
                          )}
                        </div>
                        <span className="text-[11px] text-ink-3 font-[var(--font-mono)]">~{m.estimatedMinutes} min read</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <StatusPill status={status} />
                        {status === "certified" && cert && (
                          <Link href={`/cert/${cert.id}`} className="text-xs text-navy hover:underline font-medium">
                            Record
                          </Link>
                        )}
                        {(status === "tested_passed" || status === "tested_failed") && (
                          <Link href={`/certify/${userId}/${m.id}`} className="text-xs text-navy hover:underline font-medium">
                            Evaluate
                          </Link>
                        )}
                      </div>
                    </div>
                    {status !== "not_started" && (
                      <div className="flex items-center gap-2 mt-1.5 max-w-[220px]">
                        <div className="h-1.5 flex-1 bg-surface-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${stepPct >= 100 ? "bg-patina" : stepPct >= 40 ? "bg-amber" : "bg-copper"}`}
                            style={{ width: `${stepPct}%` }}
                          />
                        </div>
                        <span className="text-[10.5px] text-ink-3 font-[var(--font-mono)]">{stepPct}%</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
