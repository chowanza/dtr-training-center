import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { requireCurrentUser } from "@/lib/session";
import { withTenantContext } from "@/lib/drizzle/client";
import * as schema from "@/lib/drizzle/schema";
import { addGroupMember, removeGroupMember } from "@/lib/actions";

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export default async function GroupDetailPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const viewer = await requireCurrentUser();
  const orgId = viewer.organizationId;

  const { group, memberRows, allUsers } = await withTenantContext(orgId, async (tx) => {
    const [group] = await tx.select().from(schema.groups).where(and(eq(schema.groups.organizationId, orgId), eq(schema.groups.id, groupId))).limit(1);
    if (!group) return { group: undefined, memberRows: [], allUsers: [] };
    const memberRows = await tx.select().from(schema.groupMembers).where(and(eq(schema.groupMembers.organizationId, orgId), eq(schema.groupMembers.groupId, groupId)));
    const allUsers = await tx.select().from(schema.profiles).where(eq(schema.profiles.organizationId, orgId));
    return { group, memberRows, allUsers };
  });
  if (!group) notFound();

  const members = memberRows.map((m) => ({ membershipId: m.id, user: allUsers.find((u) => u.id === m.userId) })).filter((m) => m.user);
  const memberIds = new Set(memberRows.map((m) => m.userId));
  const nonMembers = allUsers.filter((u) => u.employmentStatus === "active" && !memberIds.has(u.id));

  return (
    <div className="max-w-2xl">
      <Link href="/groups" className="text-xs font-[var(--font-mono)] text-ink-3 hover:text-navy">
        ← Groups
      </Link>
      <h1 className="font-[var(--font-display)] font-bold text-2xl tracking-tight mt-3 mb-1">{group.name}</h1>
      <p className="text-ink-2 text-sm mb-6">{group.description}</p>

      <div className="border border-rule rounded-xl bg-surface divide-y divide-rule mb-6">
        {members.map(({ membershipId, user }) => (
          <div key={membershipId} className="flex items-center justify-between gap-4 px-5 py-3.5">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-navy-soft text-navy text-[11px] font-semibold flex items-center justify-center font-[var(--font-display)] shrink-0">
                {initials(user!.name)}
              </span>
              <Link href={`/people/${user!.id}`} className="font-medium text-sm hover:text-navy">
                {user!.name}
              </Link>
            </div>
            {viewer.accessRole === "admin" && (
              <form action={removeGroupMember}>
                <input type="hidden" name="id" value={membershipId} />
                <button className="text-xs text-brick hover:underline">Remove</button>
              </form>
            )}
          </div>
        ))}
        {members.length === 0 && <p className="px-5 py-6 text-sm text-ink-2">No members yet.</p>}
      </div>

      {viewer.accessRole === "admin" && nonMembers.length > 0 && (
        <form action={addGroupMember} className="flex gap-2">
          <input type="hidden" name="groupId" value={groupId} />
          <select name="userId" className="flex-1 border border-rule-2 rounded-lg bg-paper px-3 py-2 text-sm">
            {nonMembers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          <button type="submit" className="btn-primary shrink-0">
            Add to group
          </button>
        </form>
      )}
    </div>
  );
}
