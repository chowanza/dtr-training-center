import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { RUBRIC_DIMENSIONS } from "@/lib/constants";
import { StatusPill } from "@/components/StatusPill";
import { submitPracticalEvaluation, certifyUser } from "@/lib/actions";

export default async function EvaluatePage({ params }: { params: Promise<{ userId: string; moduleId: string }> }) {
  const { userId, moduleId } = await params;
  const db = getDb();
  const user = db.users.find((u) => u.id === userId);
  const mod = db.modules.find((m) => m.id === moduleId);
  if (!user || !mod) notFound();
  const mv = db.moduleVersions.find((v) => v.moduleId === moduleId)!;
  const scenario = db.practicalScenarios.find((s) => s.moduleVersionId === mv.id);
  const cert = db.certifications.find((c) => c.userId === userId && c.moduleId === moduleId);
  const quiz = db.quizzes.find((q) => q.moduleVersionId === mv.id);
  const lastAttempt = quiz
    ? db.quizAttempts.filter((a) => a.userId === userId && a.quizId === quiz.id).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))[0]
    : undefined;
  const evaluations = scenario
    ? db.practicalEvaluations.filter((e) => e.userId === userId && e.scenarioId === scenario.id).sort((a, b) => b.evaluatedAt.localeCompare(a.evaluatedAt))
    : [];
  const latestEval = evaluations[0];
  const canCertify = latestEval?.result === "pass" && cert?.status !== "certified";

  return (
    <div className="max-w-2xl">
      <Link href="/certify" className="text-xs font-[var(--font-mono)] text-ink-3 hover:text-copper">
        ← Evaluation & Certification
      </Link>

      <div className="flex items-start justify-between gap-4 mt-3 mb-6">
        <div>
          <h1 className="font-[var(--font-display)] font-bold text-2xl tracking-tight mb-1">{user.name}</h1>
          <p className="text-ink-2 text-sm">{mod.title} · v{mod.currentVersion}</p>
        </div>
        {cert && <StatusPill status={cert.status} />}
      </div>

      {lastAttempt && (
        <div className="border border-rule rounded bg-surface p-4 mb-6 text-sm">
          <span className="font-[var(--font-mono)] text-[10.5px] uppercase tracking-wider text-ink-3 block mb-1">Latest quiz attempt</span>
          Scored <strong>{lastAttempt.score}%</strong> — {lastAttempt.passed ? "passed" : "did not pass"}.
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
                  <span className="text-xs text-ink-3">{new Date(e.evaluatedAt).toLocaleDateString()}</span>
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
