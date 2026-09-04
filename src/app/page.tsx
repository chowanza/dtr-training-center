import Link from "next/link";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

export default async function HomePage() {
  const db = getDb();
  const user = await getCurrentUser();

  const csrRole = db.roles.find((r) => r.name === "CSR")!;
  const csrUsers = db.users.filter((u) => u.roleId === csrRole.id);
  const modules = db.modules;
  const certified = db.certifications.filter((c) => c.status === "certified").length;
  const inProgress = db.certifications.filter((c) => c.status === "training" || c.status === "ready_for_test").length;
  const notStarted = db.certifications.filter((c) => c.status === "not_started").length;

  return (
    <div>
      <div className="border-b-2 border-ink pb-8 mb-10">
        <p className="font-[var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-copper mb-3">
          Dream Team Roofing · Internal build · v0 demo
        </p>
        <h1 className="font-[var(--font-display)] font-bold text-4xl md:text-5xl leading-none tracking-tight mb-4 max-w-xl">
          Training Center
        </h1>
        <p className="text-ink-2 text-[17px] max-w-2xl">
          Signed in as <strong className="text-ink">{user.name}</strong>. This is the working build from the
          Training Center spec — the smallest thing that proves the quiz → practical → manager-approval chain, tied
          to a real SOP version, end to end.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
        <Stat label="Modules" value={modules.length} sub={`${modules.filter((m) => m.status === "published").length} published`} />
        <Stat label="Certified" value={certified} sub={`of ${csrUsers.length * modules.length} possible`} />
        <Stat label="In progress" value={inProgress} sub="training or ready for test" />
        <Stat label="Not started" value={notStarted} sub="empty schema = stop-work signal" />
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <ScreenCard
          href="/builder"
          eyebrow="Sprint 1 · Luis"
          title="Module Builder"
          desc="Write the 13-section SOP, scripts, checklist, and quiz. Publish a version when it's complete."
        />
        <ScreenCard
          href="/learn"
          eyebrow="Sprint 2 · Armando"
          title="My Training"
          desc="Mobile-first module viewer — read the SOP, pull up scripts, work the checklist, take the quiz."
        />
        <ScreenCard
          href="/certify"
          eyebrow="Sprint 3 · Luis"
          title="Evaluation & Certification"
          desc="Score the practical scenario against the rubric, then make the explicit call to certify."
        />
        <ScreenCard
          href="/matrix"
          eyebrow="Sprint 4 · Owen & Luis"
          title="Training Matrix"
          desc="Everyone's certification status against every module, in one screen."
        />
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <div className="border border-rule rounded bg-surface p-4">
      <div className="font-[var(--font-mono)] text-[10px] uppercase tracking-wider text-ink-3 mb-1">{label}</div>
      <div className="font-[var(--font-display)] text-3xl font-bold leading-none mb-1">{value}</div>
      <div className="text-xs text-ink-2">{sub}</div>
    </div>
  );
}

function ScreenCard({ href, eyebrow, title, desc }: { href: string; eyebrow: string; title: string; desc: string }) {
  return (
    <Link href={href} className="block border border-rule rounded-md bg-surface p-6 hover:border-copper transition-colors group">
      <div className="font-[var(--font-mono)] text-[10.5px] uppercase tracking-wider text-copper mb-2">{eyebrow}</div>
      <h3 className="font-[var(--font-display)] font-semibold text-xl mb-2 group-hover:text-copper transition-colors">{title}</h3>
      <p className="text-ink-2 text-[14.5px]">{desc}</p>
    </Link>
  );
}
