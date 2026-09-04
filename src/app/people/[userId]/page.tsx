import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { completionForUser } from "@/lib/derive";
import { StatusPill } from "@/components/StatusPill";
import { updateUser, setUserActive } from "@/lib/actions";

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export default async function PersonDetailPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const db = getDb();
  const user = db.users.find((u) => u.id === userId);
  if (!user) notFound();
  const viewer = await getCurrentUser();
  const modules = db.modules;
  const { done, total, pct } = completionForUser(userId);
  const memberGroups = db.groupMembers.filter((gm) => gm.userId === userId).map((gm) => db.groups.find((g) => g.id === gm.groupId)).filter(Boolean);

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
            <Link key={g!.id} href={`/groups/${g!.id}`} className="pill p-neutral hover:border-navy hover:text-navy">
              {g!.name}
            </Link>
          ))}
        </div>
      )}

      {viewer.isAdmin && (
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
                {db.roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex gap-5">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="isManager" defaultChecked={user.isManager} /> Can evaluate &amp; certify
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="isAdmin" defaultChecked={user.isAdmin} /> Admin
              </label>
            </div>
            <button type="submit" className="btn-primary">
              Save Changes
            </button>
          </form>
          <form action={setUserActive} className="mt-3">
            <input type="hidden" name="id" value={user.id} />
            <input type="hidden" name="active" value={user.employmentStatus === "active" ? "false" : "true"} />
            <button type="submit" className="btn-secondary">
              {user.employmentStatus === "active" ? "Deactivate person" : "Reactivate person"}
            </button>
          </form>
        </div>
      )}

      <div className="border border-rule rounded-xl bg-surface divide-y divide-rule">
        {modules.map((m) => {
          const cert = db.certifications.find((c) => c.userId === userId && c.moduleId === m.id);
          const status = cert?.status ?? "not_started";
          return (
            <div key={m.id} className="flex items-center justify-between gap-4 px-5 py-4">
              <span className="text-[14.5px] font-medium">{m.title}</span>
              <div className="flex items-center gap-3">
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
          );
        })}
      </div>
    </div>
  );
}
