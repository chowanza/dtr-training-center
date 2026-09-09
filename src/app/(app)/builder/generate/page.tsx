import Link from "next/link";
import { redirect } from "next/navigation";
import { requireCurrentUser } from "@/lib/session";
import { generateModuleFromPrompt } from "@/lib/actions";

export default async function GenerateModulePage() {
  const viewer = await requireCurrentUser();
  if (!(viewer.accessRole === "admin" || viewer.accessRole === "editor")) redirect("/builder");

  return (
    <div className="max-w-lg">
      <Link href="/builder" className="text-xs font-[var(--font-mono)] text-ink-3 hover:text-navy">
        ← Content
      </Link>
      <h1 className="font-[var(--font-display)] font-bold text-2xl tracking-tight mt-3 mb-2">Generate with AI</h1>
      <p className="text-[13.5px] text-ink-2 mb-6">
        Describe the process in plain language. The AI drafts topics, steps, a checklist, and a quiz — you review and edit before
        publishing, same as any other draft.
      </p>

      <form action={generateModuleFromPrompt} className="border border-rule rounded-xl bg-surface p-6 space-y-4">
        <label className="block text-sm">
          <span className="block text-ink-2 mb-1 font-medium">What should this module cover?</span>
          <textarea
            name="prompt"
            required
            minLength={10}
            autoFocus
            rows={5}
            placeholder="e.g. How to handle a customer who wants a discount on their estimate — when we can flex, when to say no, and how to say it without losing the sale."
            className="w-full border border-rule-2 rounded-lg bg-paper px-3 py-2 text-sm"
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
          Usually takes well under a minute. Lands as a draft — nothing is published until you review it and hit Publish
          yourself.
        </p>
        <button type="submit" className="btn-primary">
          Generate Module
        </button>
      </form>
    </div>
  );
}
