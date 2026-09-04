import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { deleteUser } from "@/lib/actions";

export default async function DeletePersonPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const viewer = await getCurrentUser();
  if (!viewer.isAdmin) redirect("/people");
  const db = getDb();
  const user = db.users.find((u) => u.id === userId);
  if (!user) notFound();

  const certCount = db.certifications.filter((c) => c.userId === userId).length;
  const attemptCount = db.quizAttempts.filter((a) => a.userId === userId).length;

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
