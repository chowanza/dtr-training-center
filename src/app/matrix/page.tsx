import Link from "next/link";
import { getDb } from "@/lib/db";
import { CERT_STATUS_LABEL, CERT_STATUS_PILL, type CertStatus } from "@/lib/constants";
import { PageHead } from "@/components/PageHead";

export default async function MatrixPage() {
  const db = getDb();
  const csrRole = db.roles.find((r) => r.name === "CSR")!;
  const csrUsers = db.users.filter((u) => u.roleId === csrRole.id);
  const modules = db.modules;

  return (
    <div>
      <PageHead
        eyebrow="Training Matrix"
        title="Everyone, against everything"
        desc="People down the side, modules across the top. This is the screen that turns this from Luis's project into the company's system."
      />

      <div className="border border-rule rounded-md bg-surface overflow-x-auto">
        <table className="w-full text-sm border-collapse min-w-[720px]">
          <thead>
            <tr>
              <th className="text-left font-[var(--font-mono)] text-[10.5px] uppercase tracking-wider text-ink-3 font-semibold px-4 py-3 border-b border-rule-2 sticky left-0 bg-surface">
                Trainee
              </th>
              {modules.map((m) => (
                <th key={m.id} className="text-left font-[var(--font-mono)] text-[10.5px] uppercase tracking-wider text-ink-3 font-semibold px-3 py-3 border-b border-rule-2 whitespace-nowrap">
                  {m.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {csrUsers.map((user) => (
              <tr key={user.id} className="border-b border-rule last:border-b-0">
                <td className="px-4 py-3 font-medium sticky left-0 bg-surface whitespace-nowrap">{user.name}</td>
                {modules.map((m) => {
                  const cert = db.certifications.find((c) => c.userId === user.id && c.moduleId === m.id);
                  const status = (cert?.status ?? "not_started") as CertStatus;
                  const cell = (
                    <span className={`pill ${CERT_STATUS_PILL[status]}`}>{CERT_STATUS_LABEL[status]}</span>
                  );
                  return (
                    <td key={m.id} className="px-3 py-3">
                      {cert && cert.status === "certified" ? (
                        <Link href={`/cert/${cert.id}`} className="hover:opacity-80">
                          {cell}
                        </Link>
                      ) : (
                        cell
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-3 mt-6">
        {(Object.keys(CERT_STATUS_LABEL) as CertStatus[]).map((s) => (
          <span key={s} className={`pill ${CERT_STATUS_PILL[s]}`}>
            {CERT_STATUS_LABEL[s]}
          </span>
        ))}
      </div>
    </div>
  );
}
