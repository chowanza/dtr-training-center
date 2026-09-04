import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { createRole } from "@/lib/actions";

export default async function NewRolePage() {
  const viewer = await getCurrentUser();
  if (!viewer.isAdmin) redirect("/people/roles");
  const roles = getDb().roles;

  return (
    <div className="max-w-lg">
      <Link href="/people/roles" className="text-xs font-[var(--font-mono)] text-ink-3 hover:text-navy">
        ← Role Chart
      </Link>
      <h1 className="font-[var(--font-display)] font-bold text-2xl tracking-tight mt-3 mb-6">Add a role</h1>

      <form action={createRole} className="border border-rule rounded-xl bg-surface p-6 space-y-4">
        <label className="block text-sm">
          <span className="block text-ink-2 mb-1 font-medium">Role name</span>
          <input name="name" required placeholder="e.g. Technician" className="w-full border border-rule-2 rounded-lg bg-paper px-3 py-2" />
        </label>
        <label className="block text-sm">
          <span className="block text-ink-2 mb-1 font-medium">Description</span>
          <textarea name="description" rows={3} className="w-full border border-rule-2 rounded-lg bg-paper px-3 py-2" />
        </label>
        <label className="block text-sm">
          <span className="block text-ink-2 mb-1 font-medium">Reports to</span>
          <select name="parentRoleId" className="w-full border border-rule-2 rounded-lg bg-paper px-3 py-2">
            <option value="">Top of the chart (no one)</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn-primary">
          Add Role
        </button>
      </form>
    </div>
  );
}
