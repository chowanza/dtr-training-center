import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { requireCurrentUser } from "@/lib/session";
import { withTenantContext } from "@/lib/drizzle/client";
import * as schema from "@/lib/drizzle/schema";
import { RUBRIC_DIMENSIONS } from "@/lib/constants";
import { quizzesForModuleVersion, topicsForModuleVersion } from "@/lib/derive";
import { StatusPill } from "@/components/StatusPill";
import { submitPracticalEvaluation, certifyUser } from "@/lib/actions";

export default async function EvaluatePage({ params }: { params: Promise<{ userId: string; moduleId: string }> }) {
  const { userId, moduleId } = await params;
  const viewer = await requireCurrentUser();
  if (!(viewer.accessRole === "admin" || viewer.accessRole === "editor")) redirect("/");
  const orgId = viewer.organizationId;

  const { user, mod } = await withTenantContext(orgId, async (tx) => {
    const [user] = await tx.select().from(schema.profiles).where(and(eq(schema.profiles.organizationId, orgId), eq(schema.profiles.id, userId))).limit(1);
    const [mod] = await tx.select().from(schema.modules).where(and(eq(schema.modules.organizationId, orgId), eq(schema.modules.id, moduleId))).limit(1);
    return { user, mod };
  });
  if (!user || !mod) notFound();

  const [mv] = await withTenantContext(orgId, (tx) =>
    tx.select().from(schema.moduleVersions).where(and(eq(schema.moduleVersions.organizationId, orgId), eq(schema.moduleVersions.moduleId, moduleId))).limit(1)
  );

  const topics = await topicsForModuleVersion(orgId, mv.id);
  const quizzes = await quizzesForModuleVersion(orgId, mv.id);
  const quizIds = quizzes.map((q) => q.id);

  const { scenario, cert, quizAttemptSummaries, evaluations } = await withTenantContext(orgId, async (tx) => {
    const [scenario] = await tx
      .select()
      .from(schema.practicalScenarios)
      .where(and(eq(schema.practicalScenarios.organizationId, orgId), eq(schema.practicalScenarios.moduleVersionId, mv.id)))
      .limit(1);
    const [cert] = await tx
      .select()
      .from(schema.certifications)
      .where(and(eq(schema.certifications.organizationId, orgId), eq(schema.certifications.userId, userId), eq(schema.certifications.moduleId, moduleId)))
      .limit(1);

    const quizzesWithQuestions: string[] = [];
    for (const q of quizzes) {
      const has = await tx.select({ id: schema.quizQuestions.id }).from(schema.quizQuestions).where(and(eq(schema.quizQuestions.organizationId, orgId), eq(schema.quizQuestions.quizId, q.id))).limit(1);
      if (has.length > 0) quizzesWithQuestions.push(q.id);
    }
    const allAttempts = quizIds.length
      ? await tx.select().from(schema.quizAttempts).where(and(eq(schema.quizAttempts.organizationId, orgId), eq(schema.quizAttempts.userId, userId), inArray(schema.quizAttempts.quizId, quizIds)))
      : [];
    const quizAttemptSummaries = quizzes
      .filter((q) => quizzesWithQuestions.includes(q.id))
      .map((q) => {
        const lastAttempt = allAttempts
          .filter((a) => a.quizId === q.id)
          .sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime())[0];
        return { topicTitle: topics.find((t) => t.id === q.topicId)?.title ?? "Knowledge check", lastAttempt };
      });

    const evaluations = scenario
      ? await tx
          .select()
          .from(schema.practicalEvaluations)
          .where(and(eq(schema.practicalEvaluations.organizationId, orgId), eq(schema.practicalEvaluations.userId, userId), eq(schema.practicalEvaluations.scenarioId, scenario.id)))
          .then((rows) => rows.sort((a, b) => b.evaluatedAt.getTime() - a.evaluatedAt.getTime()))
      : [];

    return { scenario, cert, quizAttemptSummaries, evaluations };
  });

  const latestEval = evaluations[0];
  const canCertify = latestEval?.result === "pass" && cert?.status !== "certified";

  return (
    <div className="max-w-2xl">
      <Link href="/certify" className="text-xs font-[var(--font-mono)] text-ink-3 hover:text-navy">
        ← Evaluation & Certification
      </Link>

      <div className="flex items-start justify-between gap-4 mt-3 mb-6">
        <div>
          <h1 className="font-[var(--font-display)] font-bold text-2xl tracking-tight mb-1">{user.name}</h1>
          <p className="text-ink-2 text-sm">{mod.title} · v{mod.currentVersion}</p>
        </div>
        {cert && <StatusPill status={cert.status} />}
      </div>

      {quizAttemptSummaries.length > 0 && (
        <div className="border border-rule rounded bg-surface p-4 mb-6 text-sm space-y-1.5">
          <span className="font-[var(--font-mono)] text-[10.5px] uppercase tracking-wider text-ink-3 block mb-1">Knowledge checks</span>
          {quizAttemptSummaries.map(({ topicTitle, lastAttempt }, i) => (
            <p key={i}>
              <strong>{topicTitle}</strong>:{" "}
              {lastAttempt ? (
                <>
                  scored <strong>{lastAttempt.score}%</strong> — {lastAttempt.passed ? "passed" : "did not pass"}
                </>
              ) : (
                <span className="text-ink-3">not attempted</span>
              )}
            </p>
          ))}
        </div>
      )}

      {scenario && (
        <div className="border border-rule rounded bg-surface p-4 mb-6 text-sm">
          <span className="font-[var(--font-mono)] text-[10.5px] uppercase tracking-wider text-ink-3 block mb-1">Practical scenario</span>
          {scenario.prompt}
        </div>
      )}

      {scenario && (
        <form action={submitPracticalEvaluation} className="border border-rule rounded-md bg-surface p-5 mb-6 space-y-4">
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="moduleId" value={moduleId} />
          <input type="hidden" name="scenarioId" value={scenario.id} />
          <h2 className="font-[var(--font-display)] font-semibold">Rubric</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {RUBRIC_DIMENSIONS.map((d) => (
              <label key={d.key} className="text-sm">
                <span className="block text-ink-2 mb-1">{d.label}</span>
                <select name={`rubric_${d.key}`} defaultValue={3} className="w-full border border-rule-2 bg-paper rounded px-2 py-1.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n} {n === 1 ? "— needs work" : n === 5 ? "— excellent" : ""}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <label className="block text-sm">
            <span className="block text-ink-2 mb-1">Notes</span>
            <textarea name="notes" rows={3} className="w-full border border-rule-2 bg-paper rounded px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="block text-ink-2 mb-1">Result</span>
            <select name="result" className="border border-rule-2 bg-paper rounded px-2 py-1.5">
              <option value="pass">Pass</option>
              <option value="fail">Fail — needs retest</option>
            </select>
          </label>
          <button type="submit" className="btn-secondary">
            Save Evaluation
          </button>
        </form>
      )}

      {evaluations.length > 0 && (
        <div className="mb-8">
          <h2 className="font-[var(--font-mono)] text-[11px] uppercase tracking-wider text-ink-3 mb-2">Evaluation history</h2>
          <div className="space-y-2">
            {evaluations.map((e) => (
              <div key={e.id} className="border border-rule rounded bg-surface p-3 text-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className={e.result === "pass" ? "text-patina font-medium" : "text-brick font-medium"}>
                    {e.result === "pass" ? "Pass" : "Fail"}
                  </span>
                  <span className="text-xs text-ink-3">{e.evaluatedAt.toLocaleDateString()}</span>
                </div>
                {e.notes && <p className="text-ink-2 text-[13.5px]">{e.notes}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      <form action={certifyUser} className="border-2 border-ink rounded-md bg-surface p-5">
        <input type="hidden" name="userId" value={userId} />
        <input type="hidden" name="moduleId" value={moduleId} />
        <h2 className="font-[var(--font-display)] font-semibold mb-2">Certify</h2>
        <p className="text-ink-2 text-[13.5px] mb-3">
          This is the explicit, human call — not a computed pass. It writes a permanent certification record stamped
          to module v{mod.currentVersion}.
        </p>
        <textarea name="notes" placeholder="Certification notes (optional)…" rows={2} className="w-full border border-rule-2 bg-paper rounded px-3 py-2 text-sm mb-3" />
        <button type="submit" disabled={!canCertify} className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed">
          {cert?.status === "certified" ? "Already Certified" : "Certify " + user.name}
        </button>
        {!canCertify && cert?.status !== "certified" && (
          <p className="text-[11px] text-ink-3 mt-2">Requires a passing practical evaluation first.</p>
        )}
      </form>
    </div>
  );
}
