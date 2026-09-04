import Link from "next/link";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { StatusPill } from "@/components/StatusPill";
import { completionForUser } from "@/lib/derive";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  const user = await getCurrentUser();
  const isStaff = user.isAdmin || user.isManager;
  const activeView = view ?? (isStaff ? "dashboard" : "training");

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-7">
        <div>
          <h1 className="font-[var(--font-display)] font-bold text-[26px] tracking-tight">Home</h1>
          <p className="text-ink-2 text-[14.5px] mt-0.5">Welcome back, {user.name}.</p>
        </div>
        <div className="inline-flex bg-surface-2 rounded-full p-1 border border-rule">
          <Link
            href="/?view=dashboard"
            className={`px-4 py-1.5 rounded-full text-[13px] font-medium transition-colors ${
              activeView === "dashboard" ? "bg-surface shadow-sm text-ink" : "text-ink-2"
            }`}
          >
            Dashboard
          </Link>
          <Link
            href="/?view=training"
            className={`px-4 py-1.5 rounded-full text-[13px] font-medium transition-colors ${
              activeView === "training" ? "bg-surface shadow-sm text-ink" : "text-ink-2"
            }`}
          >
            Training
          </Link>
        </div>
      </div>

      {activeView === "dashboard" ? <DashboardView /> : <TrainingView userId={user.id} />}
    </div>
  );
}

async function DashboardView() {
  const db = getDb();
  const users = db.users.filter((u) => u.employmentStatus === "active");
  const modules = db.modules;
  const certified = db.certifications.filter((c) => c.status === "certified").length;
  const inProgress = db.certifications.filter((c) => c.status === "training" || c.status === "ready_for_test").length;
  const awaitingEval = db.certifications.filter((c) => c.status === "tested_passed").length;
  const totalCerts = db.certifications.length;

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Stat label="Modules published" value={modules.filter((m) => m.status === "published").length} total={modules.length} />
        <Stat label="Certified" value={certified} total={totalCerts} />
        <Stat label="In progress" value={inProgress} total={totalCerts} />
        <Stat label="Awaiting evaluation" value={awaitingEval} total={totalCerts} accent="copper" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="border border-rule rounded-xl bg-surface p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-[var(--font-display)] font-semibold text-[15px]">Completions</h2>
            <Link href="/people" className="text-xs text-navy hover:underline font-medium">
              View all
            </Link>
          </div>
          <div className="space-y-3">
            {users.map((u) => {
              const { pct } = completionForUser(u.id);
              return (
                <div key={u.id} className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-navy-soft text-navy text-[11px] font-semibold flex items-center justify-center font-[var(--font-display)] shrink-0">
                    {u.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between text-[13px] mb-1">
                      <span className="font-medium truncate">{u.name}</span>
                      <span className="text-ink-3 font-[var(--font-mono)]">{pct}%</span>
                    </div>
                    <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${pct >= 90 ? "bg-patina" : pct >= 40 ? "bg-amber" : "bg-copper"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="border border-rule rounded-xl bg-surface p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-[var(--font-display)] font-semibold text-[15px]">Content</h2>
            <Link href="/builder" className="text-xs text-navy hover:underline font-medium">
              View all
            </Link>
          </div>
          <div className="space-y-1">
            {modules.slice(0, 6).map((m) => (
              <Link key={m.id} href={`/builder/${m.id}`} className="flex items-center justify-between gap-3 py-2 px-2 -mx-2 rounded-lg hover:bg-surface-2">
                <span className="text-[13.5px] font-medium truncate">{m.title}</span>
                <span className={`pill shrink-0 ${m.status === "published" ? "p-good" : "p-neutral"}`}>
                  {m.status === "published" ? `v${m.currentVersion}` : "Draft"}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

async function TrainingView({ userId }: { userId: string }) {
  const db = getDb();
  const assignments = db.assignments.filter((a) => a.userId === userId);

  if (assignments.length === 0) {
    return <p className="text-ink-2 text-sm">No modules assigned yet.</p>;
  }

  return (
    <div className="border border-rule rounded-xl bg-surface divide-y divide-rule">
      {assignments.map((a) => {
        const mod = db.modules.find((m) => m.id === a.moduleId)!;
        const cert = db.certifications.find((c) => c.userId === userId && c.moduleId === a.moduleId);
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
  );
}

function Stat({ label, value, total, accent }: { label: string; value: number; total: number; accent?: "copper" }) {
  return (
    <div className="border border-rule rounded-xl bg-surface p-4">
      <div className="font-[var(--font-mono)] text-[10px] uppercase tracking-wider text-ink-3 mb-1.5">{label}</div>
      <div className={`font-[var(--font-display)] text-[28px] font-bold leading-none ${accent === "copper" ? "text-copper" : "text-ink"}`}>
        {value}
      </div>
      <div className="text-[11.5px] text-ink-3 mt-1">of {total}</div>
    </div>
  );
}
