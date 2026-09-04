import Link from "next/link";
import { getDb } from "@/lib/db";
import { moduleCompleteness } from "@/lib/derive";
import { PageHead } from "@/components/PageHead";

export default async function BuilderIndexPage() {
  const db = getDb();

  return (
    <div>
      <PageHead
        eyebrow="Module Builder"
        title="Write the SOPs"
        desc="Thirteen fixed sections per module, a completeness meter, and an explicit publish step. If Luis hasn't typed real content in here, nothing downstream works."
      />

      <div className="border border-rule rounded-md bg-surface divide-y divide-rule">
        {db.modules.map((m) => {
          const mv = db.moduleVersions.find((v) => v.moduleId === m.id)!;
          const c = moduleCompleteness(mv.id);
          return (
            <Link key={m.id} href={`/builder/${m.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-surface-2 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-[var(--font-display)] font-semibold text-[15px] truncate">{m.title}</h3>
                  <span className={`pill ${m.status === "published" ? "p-good" : "p-neutral"}`}>
                    {m.status === "published" ? `Published v${m.currentVersion}` : "Draft"}
                  </span>
                </div>
                <div className="text-xs text-ink-3 font-[var(--font-mono)]">
                  {c.filled}/{c.total} sections · {c.hasChecklist ? "checklist ✓" : "no checklist"} ·{" "}
                  {c.hasQuiz ? "quiz ✓" : "no quiz"}
                </div>
              </div>
              <div className="w-32 shrink-0">
                <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${c.publishable ? "bg-patina" : "bg-copper"}`}
                    style={{ width: `${c.pct}%` }}
                  />
                </div>
                <div className="text-right text-[11px] text-ink-3 mt-1 font-[var(--font-mono)]">{c.pct}%</div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
