import Link from "next/link";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { completionForUser } from "@/lib/derive";

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export default async function PeoplePage() {
  const db = getDb();
  const viewer = await getCurrentUser();
  const users = db.users.filter((u) => u.employmentStatus === "active");

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-[var(--font-display)] font-bold text-[26px] tracking-tight mb-1">People</h1>
          <p className="text-ink-2 text-[14.5px]">Everyone in the company, and their certification progress.</p>
        </div>
        {viewer.isAdmin && (
          <Link href="/people/new" className="btn-primary">
            + Add Person
          </Link>
        )}
      </div>

      <div className="flex gap-2 mb-5">
        <span className="px-4 py-2 rounded-lg text-[13.5px] font-medium bg-navy-soft border border-navy text-navy">People</span>
        <Link href="/people/roles" className="px-4 py-2 rounded-lg text-[13.5px] font-medium border border-rule text-ink-2 hover:border-rule-2">
          Role Chart
        </Link>
      </div>

      <div className="border border-rule rounded-xl bg-surface overflow-hidden">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-rule bg-surface-2">
              <th className="text-left font-[var(--font-mono)] text-[10.5px] uppercase tracking-wider text-ink-3 font-semibold px-5 py-3">User</th>
              <th className="text-left font-[var(--font-mono)] text-[10.5px] uppercase tracking-wider text-ink-3 font-semibold px-3 py-3">
                Completion
              </th>
              <th className="text-left font-[var(--font-mono)] text-[10.5px] uppercase tracking-wider text-ink-3 font-semibold px-3 py-3">Role</th>
              <th className="text-left font-[var(--font-mono)] text-[10.5px] uppercase tracking-wider text-ink-3 font-semibold px-3 py-3">
                Certified
              </th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const role = db.roles.find((r) => r.id === u.roleId);
              const { done, total, pct } = completionForUser(u.id);
              return (
                <tr key={u.id} className="border-b border-rule last:border-b-0">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-navy-soft text-navy text-[11px] font-semibold flex items-center justify-center font-[var(--font-display)] shrink-0">
                        {initials(u.name)}
                      </span>
                      <div>
                        <div className="font-medium">{u.name}</div>
                        {(u.isAdmin || u.isManager) && (
                          <div className="text-[10.5px] text-ink-3 font-[var(--font-mono)] uppercase tracking-wide">
                            {u.isAdmin ? "Admin" : "Manager"}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3.5 w-48">
                    {total > 0 ? (
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 bg-surface-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${pct >= 90 ? "bg-patina" : pct >= 40 ? "bg-amber" : "bg-copper"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-ink-3 font-[var(--font-mono)] w-9 text-right">{pct}%</span>
                      </div>
                    ) : (
                      <span className="text-xs text-ink-3">No content assigned</span>
                    )}
                  </td>
                  <td className="px-3 py-3.5 text-ink-2">{role?.name ?? "—"}</td>
                  <td className="px-3 py-3.5 text-ink-2">
                    {done} / {total}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <Link href={`/people/${u.id}`} className="text-navy text-xs font-medium hover:underline">
                      View details
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
