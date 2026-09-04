import Link from "next/link";
import { getDb } from "@/lib/db";
import { StatusPill } from "@/components/StatusPill";
import { PageHead } from "@/components/PageHead";

export default async function CertifyIndexPage() {
  const db = getDb();
  const csrRole = db.roles.find((r) => r.name === "CSR")!;
  const csrUsers = db.users.filter((u) => u.roleId === csrRole.id);

  const rows = csrUsers.flatMap((user) =>
    db.certifications
      .filter((c) => c.userId === user.id && c.status !== "not_started")
      .map((c) => ({ user, cert: c, mod: db.modules.find((m) => m.id === c.moduleId)! }))
  );

  const actionable = rows.filter((r) => r.cert.status === "tested_passed" || r.cert.status === "tested_failed");
  const rest = rows.filter((r) => r.cert.status !== "tested_passed" && r.cert.status !== "tested_failed");

  return (
    <div>
      <PageHead
        title="Score the practical, then certify"
        desc="Passing the quiz is a score. Certifying is a human judgment — the two are deliberately kept separate."
      />

      <h2 className="font-[var(--font-display)] font-semibold text-sm uppercase tracking-wide text-ink-3 mb-3">
        Awaiting evaluation
      </h2>
      <div className="border border-rule rounded-md bg-surface divide-y divide-rule mb-10">
        {actionable.length === 0 && <p className="px-5 py-4 text-sm text-ink-2">Nobody is waiting on a practical evaluation right now.</p>}
        {actionable.map(({ user, cert, mod }) => (
          <div key={cert.id} className="flex items-center justify-between gap-4 px-5 py-4">
            <div>
              <div className="font-medium text-sm">
                {user.name} <span className="text-ink-3">·</span> {mod.title}
              </div>
              <StatusPill status={cert.status} />
            </div>
            <Link href={`/certify/${user.id}/${mod.id}`} className="btn-secondary text-xs">
              Evaluate
            </Link>
          </div>
        ))}
      </div>

      <h2 className="font-[var(--font-display)] font-semibold text-sm uppercase tracking-wide text-ink-3 mb-3">
        Everyone else
      </h2>
      <div className="border border-rule rounded-md bg-surface divide-y divide-rule">
        {rest.map(({ user, cert, mod }) => (
          <div key={cert.id} className="flex items-center justify-between gap-4 px-5 py-4">
            <div className="font-medium text-sm">
              {user.name} <span className="text-ink-3">·</span> {mod.title}
            </div>
            <div className="flex items-center gap-3">
              <StatusPill status={cert.status} />
              {cert.status === "certified" && (
                <Link href={`/cert/${cert.id}`} className="text-xs text-copper hover:underline">
                  View record
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
