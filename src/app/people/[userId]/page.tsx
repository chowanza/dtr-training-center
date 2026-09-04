import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { StatusPill } from "@/components/StatusPill";

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export default async function PersonDetailPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const db = getDb();
  const user = db.users.find((u) => u.id === userId);
  if (!user) notFound();
  const modules = db.modules;
  const done = db.certifications.filter((c) => c.userId === userId && c.status === "certified").length;
  const pct = modules.length ? Math.round((done / modules.length) * 100) : 0;

  return (
    <div className="max-w-2xl">
      <Link href="/people" className="text-xs font-[var(--font-mono)] text-ink-3 hover:text-navy">
        ← People
      </Link>

      <div className="flex items-center gap-4 mt-3 mb-8">
        <span className="w-12 h-12 rounded-full bg-navy-soft text-navy text-base font-semibold flex items-center justify-center font-[var(--font-display)] shrink-0">
          {initials(user.name)}
        </span>
        <div>
          <h1 className="font-[var(--font-display)] font-bold text-2xl tracking-tight">{user.name}</h1>
          <p className="text-ink-2 text-sm">
            {done} of {modules.length} modules certified · {pct}%
          </p>
        </div>
      </div>

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
