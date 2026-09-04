import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { createModule } from "@/lib/actions";
import { TEMPLATES } from "@/lib/constants";

export default async function NewModulePage({ searchParams }: { searchParams: Promise<{ template?: string }> }) {
  const { template } = await searchParams;
  const viewer = await getCurrentUser();
  if (!(viewer.isAdmin || viewer.isManager)) redirect("/builder");
  const templateDef = template ? TEMPLATES.find((t) => t.key === template) : undefined;

  return (
    <div className="max-w-lg">
      <Link href="/builder" className="text-xs font-[var(--font-mono)] text-ink-3 hover:text-navy">
        ← Content
      </Link>
      <h1 className="font-[var(--font-display)] font-bold text-2xl tracking-tight mt-3 mb-6">New module</h1>

      <form action={createModule} className="border border-rule rounded-xl bg-surface p-6 space-y-4">
        {template && <input type="hidden" name="templateKey" value={template} />}
        <label className="block text-sm">
          <span className="block text-ink-2 mb-1 font-medium">Title</span>
          <input
            name="title"
            required
            autoFocus
            defaultValue={templateDef?.title ?? ""}
            className="w-full border border-rule-2 rounded-lg bg-paper px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="block text-ink-2 mb-1 font-medium">Phase</span>
          <select name="phase" defaultValue={1} className="w-full border border-rule-2 rounded-lg bg-paper px-3 py-2">
            {[1, 2, 3, 4].map((p) => (
              <option key={p} value={p}>
                Phase {p}
              </option>
            ))}
          </select>
        </label>
        <p className="text-[12px] text-ink-3">
          Creates a draft with a starter outline of topics — edit, reorder, or delete any of them. Nothing is
          published until every step has real content.
        </p>
        <button type="submit" className="btn-primary">
          Create Module
        </button>
      </form>
    </div>
  );
}
