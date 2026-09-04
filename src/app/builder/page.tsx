import Link from "next/link";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { moduleCompleteness } from "@/lib/derive";

const TABS = [
  { key: "all", label: "All content" },
  { key: "published", label: "Published" },
  { key: "draft", label: "Drafts" },
] as const;

export default async function BuilderIndexPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string }> }) {
  const { tab = "all", q = "" } = await searchParams;
  const db = getDb();
  const viewer = await getCurrentUser();
  const canAuthor = viewer.isAdmin || viewer.isManager;

  let modules = db.modules;
  if (tab === "published") modules = modules.filter((m) => m.status === "published");
  if (tab === "draft") modules = modules.filter((m) => m.status !== "published");
  if (q) modules = modules.filter((m) => m.title.toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-[var(--font-display)] font-bold text-[26px] tracking-tight mb-1">Content</h1>
          <p className="text-ink-2 text-[14.5px]">
            Topics, steps, and per-topic knowledge checks — a completeness meter, and an explicit publish step.
          </p>
        </div>
        {canAuthor && (
          <div className="flex gap-2">
            <Link href="/builder/templates" className="btn-secondary">
              View Templates
            </Link>
            <Link href="/builder/new" className="btn-primary">
              + New Module
            </Link>
          </div>
        )}
      </div>

      <div className="flex gap-2 mb-5">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "all" ? "/builder" : `/builder?tab=${t.key}`}
            className={`px-4 py-2 rounded-lg text-[13.5px] font-medium border ${
              tab === t.key ? "bg-navy-soft border-navy text-navy" : "bg-surface border-rule text-ink-2 hover:border-rule-2"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {q && (
        <p className="text-xs text-ink-3 mb-3">
          Showing results for <strong className="text-ink">&quot;{q}&quot;</strong> —{" "}
          <Link href={tab === "all" ? "/builder" : `/builder?tab=${tab}`} className="text-navy hover:underline">
            clear
          </Link>
        </p>
      )}

      <div className="border border-rule rounded-xl bg-surface divide-y divide-rule overflow-hidden">
        {modules.length === 0 && <p className="px-5 py-6 text-sm text-ink-2">No modules match.</p>}
        {modules.map((m) => {
          const mv = db.moduleVersions.find((v) => v.moduleId === m.id)!;
          const c = moduleCompleteness(mv.id);
          return (
            <Link key={m.id} href={`/builder/${m.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-surface-2 transition-colors">
              <span className={`w-2 h-2 rounded-full shrink-0 ${m.status === "published" ? "bg-patina" : "bg-rule-2"}`} />
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
              <div className="w-32 shrink-0 hidden sm:block">
                <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                  <div className={`h-full ${c.publishable ? "bg-patina" : "bg-copper"}`} style={{ width: `${c.pct}%` }} />
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
