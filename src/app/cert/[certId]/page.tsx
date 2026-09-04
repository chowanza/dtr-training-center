import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { StatusPill } from "@/components/StatusPill";
import { CERT_STATUS_LABEL, type CertStatus } from "@/lib/constants";

export default async function CertRecordPage({ params }: { params: Promise<{ certId: string }> }) {
  const { certId } = await params;
  const db = getDb();
  const cert = db.certifications.find((c) => c.id === certId);
  if (!cert) notFound();
  const user = db.users.find((u) => u.id === cert.userId)!;
  const mod = db.modules.find((m) => m.id === cert.moduleId)!;
  const certifier = cert.certifiedBy ? db.users.find((u) => u.id === cert.certifiedBy) : undefined;
  const mv = db.moduleVersions.find((v) => v.moduleId === cert.moduleId)!;
  const quiz = db.quizzes.find((q) => q.moduleVersionId === mv.id);
  const attempts = quiz ? db.quizAttempts.filter((a) => a.userId === cert.userId && a.quizId === quiz.id) : [];
  const bestAttempt = attempts.sort((a, b) => b.score - a.score)[0];
  const scenario = db.practicalScenarios.find((s) => s.moduleVersionId === mv.id);
  const evaluations = scenario ? db.practicalEvaluations.filter((e) => e.userId === cert.userId && e.scenarioId === scenario.id) : [];
  const bestEval = evaluations.find((e) => e.result === "pass") ?? evaluations[0];
  const events = db.certificationEvents.filter((e) => e.certificationId === certId).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));

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
          <Field label="Certified on" value={cert.certifiedAt ? new Date(cert.certifiedAt).toLocaleDateString() : "—"} />
          <Field label="Expires" value={cert.expiresAt ? new Date(cert.expiresAt).toLocaleDateString() : "—"} />
        </dl>
      </div>

      {bestAttempt && (
        <Block title="Quiz score">
          <p className="text-sm mb-2">
            <strong>{bestAttempt.score}%</strong> on {new Date(bestAttempt.submittedAt).toLocaleDateString()}
          </p>
          <ul className="space-y-1 text-sm">
            {(quiz ? db.quizQuestions.filter((q) => q.quizId === quiz.id) : []).map((q) => {
              const chosenId = bestAttempt.answers[q.id];
              const chosen = q.options.find((o) => o.id === chosenId);
              return (
                <li key={q.id} className={chosen?.isCorrect ? "text-ink-2" : "text-brick"}>
                  {chosen?.isCorrect ? "✓" : "✗"} {q.prompt}
                </li>
              );
            })}
          </ul>
        </Block>
      )}

      {bestEval && (
        <Block title="Practical evaluation">
          <p className="text-sm mb-2">
            Evaluated by {db.users.find((u) => u.id === bestEval.evaluatorId)?.name} — result:{" "}
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
                {new Date(e.occurredAt).toLocaleDateString()}
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
