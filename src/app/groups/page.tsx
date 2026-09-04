import Link from "next/link";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { createGroup } from "@/lib/actions";

export default async function GroupsPage() {
  const db = getDb();
  const viewer = await getCurrentUser();

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-[var(--font-display)] font-bold text-[26px] tracking-tight mb-1">Groups</h1>
          <p className="text-ink-2 text-[14.5px]">Teams and crews — a lighter way to organize people than the org chart.</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="border border-rule rounded-xl bg-surface divide-y divide-rule">
          {db.groups.map((g) => {
            const count = db.groupMembers.filter((m) => m.groupId === g.id).length;
            return (
              <Link key={g.id} href={`/groups/${g.id}`} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-surface-2 transition-colors">
                <div>
                  <h3 className="font-[var(--font-display)] font-semibold text-[15px]">{g.name}</h3>
                  <p className="text-ink-2 text-xs mt-0.5">{g.description}</p>
                </div>
                <span className="pill p-neutral shrink-0">
                  {count} {count === 1 ? "person" : "people"}
                </span>
              </Link>
            );
          })}
          {db.groups.length === 0 && <p className="px-5 py-6 text-sm text-ink-2">No groups yet.</p>}
        </div>

        {viewer.isAdmin && (
          <form action={createGroup} className="border border-dashed border-rule-2 rounded-xl bg-surface p-5 space-y-3 h-fit">
            <h2 className="font-[var(--font-display)] font-semibold text-[15px]">New group</h2>
            <label className="block text-sm">
              <span className="block text-ink-2 mb-1">Name</span>
              <input name="name" required className="w-full border border-rule-2 rounded-lg bg-paper px-3 py-2" />
            </label>
            <label className="block text-sm">
              <span className="block text-ink-2 mb-1">Description</span>
              <input name="description" className="w-full border border-rule-2 rounded-lg bg-paper px-3 py-2" />
            </label>
            <button type="submit" className="btn-primary">
              Create Group
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
