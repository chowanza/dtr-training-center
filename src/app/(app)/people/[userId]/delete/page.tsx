import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { requireCurrentUser } from "@/lib/session";
import { withTenantContext } from "@/lib/drizzle/client";
import * as schema from "@/lib/drizzle/schema";
import { deleteUser } from "@/lib/actions";

export default async function DeletePersonPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const viewer = await requireCurrentUser();
  if (viewer.accessRole !== "admin") redirect("/people");
  const orgId = viewer.organizationId;

  const { user, certCount, attemptCount } = await withTenantContext(orgId, async (tx) => {
    const [user] = await tx.select().from(schema.profiles).where(and(eq(schema.profiles.organizationId, orgId), eq(schema.profiles.id, userId))).limit(1);
    if (!user) return { user: undefined, certCount: 0, attemptCount: 0 };
    const certCount = (
      await tx.select({ id: schema.certifications.id }).from(schema.certifications).where(and(eq(schema.certifications.organizationId, orgId), eq(schema.certifications.userId, userId)))
    ).length;
    const attemptCount = (
      await tx.select({ id: schema.quizAttempts.id }).from(schema.quizAttempts).where(and(eq(schema.quizAttempts.organizationId, orgId), eq(schema.quizAttempts.userId, userId)))
    ).length;
    return { user, certCount, attemptCount };
  });
  if (!user) notFound();

  return (
    <div className="max-w-lg">
      <Link href={`/people/${userId}`} className="text-xs font-[var(--font-mono)] text-ink-3 hover:text-navy">
        ← {user.name}
      </Link>

      <div className="border-2 border-brick rounded-xl bg-surface p-6 mt-3">
        <h1 className="font-[var(--font-display)] font-bold text-xl tracking-tight mb-2 text-brick">Delete {user.name}?</h1>
        <p className="text-ink-2 text-sm mb-4">
          This permanently removes their account and every record tied to it — {certCount}{" "}
          certification{certCount === 1 ? "" : "s"}, {attemptCount} quiz attempt{attemptCount === 1 ? "" : "s"}, group
          memberships, and evaluation history. There is no undo. If you just want to remove their access without
          losing their certification history, use <strong>Deactivate</strong> instead.
        </p>
        <div className="flex gap-3">
          <form action={deleteUser}>
            <input type="hidden" name="id" value={userId} />
            <button type="submit" className="inline-block text-[13.5px] font-semibold px-4 py-2 rounded-md bg-brick text-white hover:bg-red-700">
              Yes, delete permanently
            </button>
          </form>
          <Link href={`/people/${userId}`} className="btn-secondary">
            Cancel
          </Link>
        </div>
      </div>
    </div>
  );
}
