import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireCurrentUser } from "@/lib/session";
import { withTenantContext } from "@/lib/drizzle/client";
import * as schema from "@/lib/drizzle/schema";
import { createUser } from "@/lib/actions";

export default async function NewPersonPage() {
  const viewer = await requireCurrentUser();
  if (viewer.accessRole !== "admin") redirect("/people");
  const roles = await withTenantContext(viewer.organizationId, (tx) =>
    tx.select().from(schema.roles).where(eq(schema.roles.organizationId, viewer.organizationId))
  );

  return (
    <div className="max-w-lg">
      <Link href="/people" className="text-xs font-[var(--font-mono)] text-ink-3 hover:text-navy">
        ← People
      </Link>
      <h1 className="font-[var(--font-display)] font-bold text-2xl tracking-tight mt-3 mb-6">Add a person</h1>

      <form action={createUser} className="border border-rule rounded-xl bg-surface p-6 space-y-4">
        <label className="block text-sm">
          <span className="block text-ink-2 mb-1 font-medium">Full name</span>
          <input name="name" required className="w-full border border-rule-2 rounded-lg bg-paper px-3 py-2" />
        </label>
        <label className="block text-sm">
          <span className="block text-ink-2 mb-1 font-medium">Email</span>
          <input name="email" type="email" required className="w-full border border-rule-2 rounded-lg bg-paper px-3 py-2" />
        </label>
        <label className="block text-sm">
          <span className="block text-ink-2 mb-1 font-medium">Role</span>
          <select name="roleId" required className="w-full border border-rule-2 rounded-lg bg-paper px-3 py-2">
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="block text-ink-2 mb-1 font-medium">Access level</span>
          <select name="accessRole" defaultValue="learner" className="w-full border border-rule-2 rounded-lg bg-paper px-3 py-2">
            <option value="learner">Learner — takes assigned training only</option>
            <option value="editor">Editor — can author &amp; publish content</option>
            <option value="admin">Admin — full access, incl. people &amp; certifying</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="block text-ink-2 mb-1 font-medium">Password (optional)</span>
          <input
            name="password"
            type="password"
            minLength={8}
            placeholder="Leave blank to have them register themselves"
            className="w-full border border-rule-2 rounded-lg bg-paper px-3 py-2"
          />
        </label>
        <p className="text-[12px] text-ink-3">
          Modules already required for this role will be assigned automatically. Set a password now to give them a
          ready-to-use login immediately — otherwise they can sign in once they register themselves at{" "}
          <span className="font-[var(--font-mono)]">/register</span> with this same email.
        </p>
        <button type="submit" className="btn-primary">
          Add Person
        </button>
      </form>
    </div>
  );
}
