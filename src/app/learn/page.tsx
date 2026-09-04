import Link from "next/link";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { StatusPill } from "@/components/StatusPill";
import { PageHead } from "@/components/PageHead";

export default async function MyTrainingPage() {
  const db = getDb();
  const user = await getCurrentUser();
  const assignments = db.assignments.filter((a) => a.userId === user.id);

  return (
    <div>
      <PageHead
        eyebrow="My Training"
        title={`${user.name}'s desk`}
        desc="Read the SOP, watch the videos, pull up a script fast, work the checklist, take the quiz. Nothing else on the page."
      />

      {assignments.length === 0 && (
        <p className="text-ink-2 text-sm">No modules assigned yet. Switch to Armando or Maria to see a trainee&apos;s desk.</p>
      )}

      <div className="border border-rule rounded-md bg-surface divide-y divide-rule">
        {assignments.map((a) => {
          const mod = db.modules.find((m) => m.id === a.moduleId)!;
          const cert = db.certifications.find((c) => c.userId === user.id && c.moduleId === a.moduleId);
          const status = cert?.status ?? "not_started";
          return (
            <Link key={a.id} href={`/learn/${mod.id}`} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-surface-2 transition-colors">
              <div>
                <h3 className="font-[var(--font-display)] font-semibold text-[15px]">{mod.title}</h3>
                <div className="text-xs text-ink-3 font-[var(--font-mono)] mt-0.5">
                  {mod.status === "published" ? `v${mod.currentVersion} · ${mod.estimatedMinutes} min` : "Not published yet"}
                </div>
              </div>
              <StatusPill status={status} />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
