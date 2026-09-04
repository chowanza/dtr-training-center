import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { createUser } from "@/lib/actions";

export default async function NewPersonPage() {
  const viewer = await getCurrentUser();
  if (!viewer.isAdmin) redirect("/people");
  const roles = getDb().roles;

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
        <div className="flex gap-5 pt-1">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isManager" /> Can evaluate &amp; certify
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isAdmin" /> Admin
          </label>
        </div>
        <p className="text-[12px] text-ink-3">
          Modules already required for this role will be assigned automatically. There&apos;s no login yet in this
          demo build — this just adds the person to the roster.
        </p>
        <button type="submit" className="btn-primary">
          Add Person
        </button>
      </form>
    </div>
  );
}
