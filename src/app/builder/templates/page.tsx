import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { TEMPLATES } from "@/lib/constants";

export default async function TemplatesPage() {
  const viewer = await getCurrentUser();
  if (!(viewer.isAdmin || viewer.isManager)) redirect("/builder");

  return (
    <div>
      <Link href="/builder" className="text-xs font-[var(--font-mono)] text-ink-3 hover:text-navy">
        ← Content
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-4 mt-3 mb-6">
        <div>
          <h1 className="font-[var(--font-display)] font-bold text-[26px] tracking-tight mb-1">Templates</h1>
          <p className="text-ink-2 text-[14.5px]">A starting title and structure — you still write the real content.</p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {TEMPLATES.map((t) => (
          <div key={t.key} className="border border-rule rounded-xl bg-surface p-5 flex flex-col">
            <h3 className="font-[var(--font-display)] font-semibold text-[15px] mb-2">{t.title}</h3>
            <p className="text-ink-2 text-[13.5px] flex-1 mb-4">{t.description}</p>
            <Link href={`/builder/new?template=${t.key}`} className="btn-primary text-center">
              Use Template
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
