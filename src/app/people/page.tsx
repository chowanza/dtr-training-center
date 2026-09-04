import Link from "next/link";
import { getDb } from "@/lib/db";

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export default async function PeoplePage() {
  const db = getDb();
  const csrRole = db.roles.find((r) => r.name === "CSR")!;
  const csrUsers = db.users.filter((u) => u.roleId === csrRole.id);
  const modules = db.modules;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-[var(--font-display)] font-bold text-[26px] tracking-tight mb-1">People</h1>
          <p className="text-ink-2 text-[14.5px]">Everyone&apos;s certification progress, at a glance.</p>
        </div>
        <Link href="/matrix" className="btn-secondary">
          View as grid
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
            {csrUsers.map((u) => {
              const certs = db.certifications.filter((c) => c.userId === u.id);
              const done = certs.filter((c) => c.status === "certified").length;
              const pct = modules.length ? Math.round((done / modules.length) * 100) : 0;
              return (
                <tr key={u.id} className="border-b border-rule last:border-b-0">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-navy-soft text-navy text-[11px] font-semibold flex items-center justify-center font-[var(--font-display)] shrink-0">
                        {initials(u.name)}
                      </span>
                      <span className="font-medium">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3.5 w-48">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 bg-surface-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${pct >= 90 ? "bg-patina" : pct >= 40 ? "bg-amber" : "bg-copper"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-ink-3 font-[var(--font-mono)] w-9 text-right">{pct}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-3.5 text-ink-2">CSR</td>
                  <td className="px-3 py-3.5 text-ink-2">
                    {done} / {modules.length}
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
