import { notFound } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { requireCurrentUser } from "@/lib/session";
import { withTenantContext } from "@/lib/drizzle/client";
import * as schema from "@/lib/drizzle/schema";
import { StatusPill } from "@/components/StatusPill";
import { CERT_STATUS_LABEL, type CertStatus } from "@/lib/constants";
import { quizzesForModuleVersion, topicsForModuleVersion } from "@/lib/derive";

export default async function CertRecordPage({ params }: { params: Promise<{ certId: string }> }) {
  const { certId } = await params;
  const viewer = await requireCurrentUser();
  const orgId = viewer.organizationId;

  const [cert] = await withTenantContext(orgId, (tx) =>
    tx.select().from(schema.certifications).where(and(eq(schema.certifications.organizationId, orgId), eq(schema.certifications.id, certId))).limit(1)
  );
  if (!cert) notFound();

  const { user, mod, certifier } = await withTenantContext(orgId, async (tx) => {
    const [user] = await tx.select().from(schema.profiles).where(and(eq(schema.profiles.organizationId, orgId), eq(schema.profiles.id, cert.userId))).limit(1);
    const [mod] = await tx.select().from(schema.modules).where(and(eq(schema.modules.organizationId, orgId), eq(schema.modules.id, cert.moduleId))).limit(1);
    const certifier = cert.certifiedBy
      ? (await tx.select().from(schema.profiles).where(and(eq(schema.profiles.organizationId, orgId), eq(schema.profiles.id, cert.certifiedBy))).limit(1))[0]
      : undefined;
    return { user, mod, certifier };
  });

  const [mv] = await withTenantContext(orgId, (tx) =>
    tx.select().from(schema.moduleVersions).where(and(eq(schema.moduleVersions.organizationId, orgId), eq(schema.moduleVersions.moduleId, cert.moduleId))).limit(1)
  );

  const topics = await topicsForModuleVersion(orgId, mv.id);
  const quizzes = await quizzesForModuleVersion(orgId, mv.id);
  const quizIds = quizzes.map((q) => q.id);

  const { quizResults, scenario, evaluations, events } = await withTenantContext(orgId, async (tx) => {
    const questions = quizIds.length
      ? await tx.select().from(schema.quizQuestions).where(and(eq(schema.quizQuestions.organizationId, orgId), inArray(schema.quizQuestions.quizId, quizIds))).orderBy(schema.quizQuestions.sortOrder)
      : [];
    const questionIds = questions.map((q) => q.id);
    const options = questionIds.length
      ? await tx.select().from(schema.quizOptions).where(and(eq(schema.quizOptions.organizationId, orgId), inArray(schema.quizOptions.questionId, questionIds)))
      : [];
    const attempts = quizIds.length
      ? await tx.select().from(schema.quizAttempts).where(and(eq(schema.quizAttempts.organizationId, orgId), eq(schema.quizAttempts.userId, cert.userId), inArray(schema.quizAttempts.quizId, quizIds)))
      : [];

    const quizResults = quizzes
      .map((quiz) => {
        const quizQuestionsForThis = questions.filter((q) => q.quizId === quiz.id);
        const quizAttempts = attempts.filter((a) => a.quizId === quiz.id);
        const bestAttempt = [...quizAttempts].sort((a, b) => b.score - a.score)[0];
        return {
          quiz,
          questions: quizQuestionsForThis.map((q) => ({ ...q, options: options.filter((o) => o.questionId === q.id) })),
          bestAttempt,
          topicTitle: topics.find((t) => t.id === quiz.topicId)?.title ?? "Knowledge check",
        };
      })
      .filter((r) => r.questions.length > 0);

    const [scenario] = await tx
      .select()
      .from(schema.practicalScenarios)
      .where(and(eq(schema.practicalScenarios.organizationId, orgId), eq(schema.practicalScenarios.moduleVersionId, mv.id)))
      .limit(1);
    const evaluations = scenario
      ? await tx.select().from(schema.practicalEvaluations).where(and(eq(schema.practicalEvaluations.organizationId, orgId), eq(schema.practicalEvaluations.userId, cert.userId), eq(schema.practicalEvaluations.scenarioId, scenario.id)))
      : [];

    const events = await tx
      .select()
      .from(schema.certificationEvents)
      .where(and(eq(schema.certificationEvents.organizationId, orgId), eq(schema.certificationEvents.certificationId, certId)))
      .then((rows) => rows.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime()));

    return { quizResults, scenario, evaluations, events };
  });

  const bestEval = evaluations.find((e) => e.result === "pass") ?? evaluations[0];

  const evaluatorNamesById = new Map(
    (
      await withTenantContext(orgId, (tx) => tx.select().from(schema.profiles).where(eq(schema.profiles.organizationId, orgId)))
    ).map((u) => [u.id, u.name])
  );

  return (
    <div className="max-w-2xl">
      <div className="border-2 border-ink rounded-md bg-surface p-7 mb-8">
        <p className="font-[var(--font-mono)] text-[10.5px] uppercase tracking-wider text-copper mb-2">Certification Record</p>
        <h1 className="font-[var(--font-display)] font-bold text-2xl mb-1">{user.name}</h1>
        <p className="text-ink-2 mb-4">{mod.title}</p>
        <StatusPill status={cert.status} />

        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 mt-6 pt-6 border-t border-rule text-sm">
          <Field label="Module version" value={cert.moduleVersion ? `v${cert.moduleVersion}` : "—"} />
          <Field label="Certified by" value={certifier?.name ?? "—"} />
          <Field label="Certified on" value={cert.certifiedAt ? cert.certifiedAt.toLocaleDateString() : "—"} />
          <Field label="Expires" value={cert.expiresAt ? cert.expiresAt.toLocaleDateString() : "—"} />
        </dl>

        {cert.signatureData && (
          <div className="mt-6 pt-6 border-t border-rule">
            <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-wider text-ink-3 mb-2">Completion signature</p>
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cert.signatureData} alt={`${user.name}'s signature`} className="h-12 border border-rule-2 rounded bg-white" />
              <span className="text-ink-2 text-xs">Signed {cert.signedAt?.toLocaleDateString()}</span>
            </div>
          </div>
        )}
      </div>

      {quizResults.length > 0 && (
        <Block title="Knowledge checks">
          <div className="space-y-4">
            {quizResults.map(({ quiz, questions, bestAttempt, topicTitle }) => (
              <div key={quiz.id}>
                <p className="text-sm mb-1.5">
                  <strong>{topicTitle}</strong> —{" "}
                  {bestAttempt ? (
                    <>
                      <strong>{bestAttempt.score}%</strong> on {bestAttempt.submittedAt.toLocaleDateString()}
                    </>
                  ) : (
                    <span className="text-ink-3">not attempted</span>
                  )}
                </p>
                {bestAttempt && (
                  <ul className="space-y-1 text-sm">
                    {questions.map((q) => {
                      const chosenId = bestAttempt.answers[q.id];
                      const chosen = q.options.find((o) => o.id === chosenId);
                      return (
                        <li key={q.id} className={chosen?.isCorrect ? "text-ink-2" : "text-brick"}>
                          {chosen?.isCorrect ? "✓" : "✗"} {q.prompt}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </Block>
      )}

      {bestEval && (
        <Block title="Practical evaluation">
          <p className="text-sm mb-2">
            Evaluated by {evaluatorNamesById.get(bestEval.evaluatorId)} — result:{" "}
            <strong className={bestEval.result === "pass" ? "text-patina" : "text-brick"}>{bestEval.result}</strong>
          </p>
          <div className="grid grid-cols-3 gap-2 mb-2">
            {Object.entries(bestEval.rubricScores).map(([k, v]) => (
              <div key={k} className="text-xs">
                <span className="text-ink-3 capitalize">{k}</span>: <strong>{v}/5</strong>
              </div>
            ))}
          </div>
          {bestEval.notes && <p className="text-[13.5px] text-ink-2">{bestEval.notes}</p>}
        </Block>
      )}

      <Block title="Status history">
        <ol className="space-y-2">
          {events.map((e) => (
            <li key={e.id} className="text-sm flex items-baseline gap-3">
              <span className="font-[var(--font-mono)] text-[11px] text-ink-3 w-24 shrink-0">
                {e.occurredAt.toLocaleDateString()}
              </span>
              <span>
                → <strong>{CERT_STATUS_LABEL[e.toStatus as CertStatus]}</strong>
                <span className="text-ink-2"> — {e.reason}</span>
              </span>
            </li>
          ))}
        </ol>
      </Block>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-[var(--font-mono)] text-[10px] uppercase tracking-wider text-ink-3 mb-0.5">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-rule rounded-md bg-surface p-5 mb-5">
      <h2 className="font-[var(--font-display)] font-semibold text-sm mb-3">{title}</h2>
      {children}
    </div>
  );
}
