import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { requireCurrentUser } from "@/lib/session";
import { withTenantContext } from "@/lib/drizzle/client";
import * as schema from "@/lib/drizzle/schema";
import { roleChildren, usersInRole } from "@/lib/derive";
import { addResponsibility, deleteResponsibility } from "@/lib/actions";
import type { Role } from "@/lib/types";

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

async function RoleNode({ orgId, role, selectedId }: { orgId: string; role: Role; selectedId?: string }) {
  const children = await roleChildren(orgId, role.id);
  const people = await usersInRole(orgId, role.id);
  const active = role.id === selectedId;

  return (
    <div className="flex flex-col items-center">
      <Link
        href={`/people/roles?role=${role.id}`}
        className={`border rounded-lg px-4 py-3 min-w-[160px] text-center bg-surface transition-colors ${
          active ? "border-navy ring-2 ring-navy-soft" : "border-rule hover:border-rule-2"
        }`}
      >
        <div className="text-[13.5px] font-semibold text-ink mb-1.5">{role.name}</div>
        <div className="flex justify-center -space-x-1.5">
          {people.slice(0, 4).map((p) => (
            <span
              key={p.id}
              title={p.name}
              className="w-6 h-6 rounded-full bg-navy-soft text-navy text-[9.5px] font-semibold flex items-center justify-center font-[var(--font-display)] border-2 border-surface"
            >
              {initials(p.name)}
            </span>
          ))}
          {people.length === 0 && <span className="text-[11px] text-ink-3">No one yet</span>}
        </div>
      </Link>
      {children.length > 0 && (
        <div className="flex gap-8 pt-6">
          {children.map((c) => (
            <div key={c.id} className="flex flex-col items-center">
              <RoleNode orgId={orgId} role={c} selectedId={selectedId} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default async function RoleChartPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const { role: selectedId } = await searchParams;
  const viewer = await requireCurrentUser();
  const orgId = viewer.organizationId;

  const roots = await roleChildren(orgId, null);

  const { selected, responsibilities } = await withTenantContext(orgId, async (tx) => {
    if (!selectedId) return { selected: undefined, responsibilities: [] };
    const [selected] = await tx
      .select()
      .from(schema.roles)
      .where(and(eq(schema.roles.organizationId, orgId), eq(schema.roles.id, selectedId)))
      .limit(1);
    if (!selected) return { selected: undefined, responsibilities: [] };
    const responsibilities = await tx
      .select()
      .from(schema.responsibilities)
      .where(and(eq(schema.responsibilities.organizationId, orgId), eq(schema.responsibilities.roleId, selected.id)))
      .orderBy(schema.responsibilities.sortOrder);
    return { selected, responsibilities };
  });
  const people = selected ? await usersInRole(orgId, selected.id) : [];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-[var(--font-display)] font-bold text-[26px] tracking-tight mb-1">People</h1>
          <p className="text-ink-2 text-[14.5px]">Where everyone fits in the org.</p>
        </div>
        {viewer.accessRole === "admin" && (
          <Link href="/people/roles/new" className="btn-primary">
            + Add Role
          </Link>
        )}
      </div>

      <div className="flex gap-2 mb-6">
        <Link href="/people" className="px-4 py-2 rounded-lg text-[13.5px] font-medium border border-rule text-ink-2 hover:border-rule-2">
          People
        </Link>
        <span className="px-4 py-2 rounded-lg text-[13.5px] font-medium bg-navy-soft border border-navy text-navy">Role Chart</span>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        <div className="border border-rule rounded-xl bg-surface p-8 overflow-x-auto">
          <div className="flex gap-16 justify-center min-w-max">
            {roots.map((r) => (
              <RoleNode key={r.id} orgId={orgId} role={r} selectedId={selectedId} />
            ))}
          </div>
        </div>

        <div className="border border-rule rounded-xl bg-surface p-5 h-fit">
          {!selected ? (
            <p className="text-sm text-ink-2">Click a role to see its description, responsibilities, and people.</p>
          ) : (
            <>
              <h2 className="font-[var(--font-display)] font-bold text-lg mb-2">{selected.name}</h2>
              <p className="text-[13.5px] text-ink-2 mb-5">{selected.description || "No description yet."}</p>

              <h3 className="font-[var(--font-mono)] text-[10.5px] uppercase tracking-wider text-ink-3 mb-2">
                People ({people.length})
              </h3>
              <ul className="space-y-1 mb-5">
                {people.map((p) => (
                  <li key={p.id}>
                    <Link href={`/people/${p.id}`} className="text-navy text-sm hover:underline">
                      {p.name}
                    </Link>
                  </li>
                ))}
                {people.length === 0 && <li className="text-sm text-ink-3">Nobody in this role yet.</li>}
              </ul>

              <h3 className="font-[var(--font-mono)] text-[10.5px] uppercase tracking-wider text-ink-3 mb-2">Responsibilities</h3>
              <ul className="space-y-1.5 mb-3">
                {responsibilities.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                    <span>{r.title}</span>
                    {viewer.accessRole === "admin" && (
                      <form action={deleteResponsibility}>
                        <input type="hidden" name="id" value={r.id} />
                        <button className="text-xs text-brick hover:underline shrink-0">Remove</button>
                      </form>
                    )}
                  </li>
                ))}
                {responsibilities.length === 0 && <li className="text-sm text-ink-3">None listed yet.</li>}
              </ul>
              {viewer.accessRole === "admin" && (
                <form action={addResponsibility} className="flex gap-2">
                  <input type="hidden" name="roleId" value={selected.id} />
                  <input name="title" placeholder="Add a responsibility…" required className="flex-1 border border-rule-2 rounded-lg bg-paper px-2.5 py-1.5 text-sm" />
                  <button type="submit" className="btn-secondary shrink-0">
                    Add
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
