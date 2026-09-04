import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { SOP_SECTIONS, SCRIPT_TYPES } from "@/lib/constants";
import { StatusPill } from "@/components/StatusPill";
import { startTraining, markReadyForTest, submitQuizAttempt } from "@/lib/actions";

export default async function ModuleViewerPage({ params }: { params: Promise<{ moduleId: string }> }) {
  const { moduleId } = await params;
  const db = getDb();
  const user = await getCurrentUser();
  const mod = db.modules.find((m) => m.id === moduleId);
  if (!mod) notFound();
  const mv = db.moduleVersions.find((v) => v.moduleId === moduleId)!;
  const sections = db.sopSections.filter((s) => s.moduleVersionId === mv.id && s.body.trim());
  const scripts = db.scripts.filter((s) => s.moduleVersionId === mv.id);
  const checklist = db.checklistItems.filter((c) => c.moduleVersionId === mv.id).sort((a, b) => a.sortOrder - b.sortOrder);
  const quiz = db.quizzes.find((q) => q.moduleVersionId === mv.id);
  const questions = quiz ? db.quizQuestions.filter((q) => q.quizId === quiz.id) : [];
  const cert = db.certifications.find((c) => c.userId === user.id && c.moduleId === moduleId);
  const status = cert?.status ?? "not_started";
  const lastAttempt = quiz
    ? db.quizAttempts.filter((a) => a.userId === user.id && a.quizId === quiz.id).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))[0]
    : undefined;

  if (mod.status !== "published") {
    return (
      <div>
        <Link href="/learn" className="text-xs font-[var(--font-mono)] text-ink-3 hover:text-copper">
          ← My training
        </Link>
        <p className="mt-6 text-ink-2">This module hasn&apos;t been published yet — check back soon.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto sm:mx-0">
      <Link href="/learn" className="text-xs font-[var(--font-mono)] text-ink-3 hover:text-copper">
        ← My training
      </Link>

      <div className="flex items-start justify-between gap-4 mt-3 mb-6">
        <div>
          <h1 className="font-[var(--font-display)] font-bold text-2xl tracking-tight mb-2">{mod.title}</h1>
          <div className="text-xs text-ink-3 font-[var(--font-mono)]">v{mod.currentVersion} · {mod.estimatedMinutes} min</div>
        </div>
        <StatusPill status={status} />
      </div>

      {status === "certified" && (
        <Banner tone="good">
          You&apos;re certified on this module. <Link href={`/cert/${cert!.id}`} className="underline">View your certification record</Link>.
        </Banner>
      )}
      {status === "needs_retraining" && (
        <Banner tone="amber">This module was updated since you were certified. Please retrain and retest.</Banner>
      )}
      {status === "tested_passed" && (
        <Banner tone="indigo">Quiz passed. Your manager still needs to score your practical evaluation and certify you.</Banner>
      )}

      {status === "not_started" && (
        <form action={startTraining}>
          <input type="hidden" name="moduleId" value={moduleId} />
          <button className="btn-primary">Begin Training</button>
        </form>
      )}

      {status !== "not_started" && (
        <div className="space-y-6 mt-2">
          {sections.map((s) => (
            <div key={s.id}>
              <h3 className="font-[var(--font-mono)] text-[11px] uppercase tracking-wider text-ink-3 mb-1.5">
                {SOP_SECTIONS.find((x) => x.key === s.sectionKey)?.label}
              </h3>
              <p className="text-[14.5px] whitespace-pre-wrap leading-relaxed">{s.body}</p>
            </div>
          ))}

          {scripts.length > 0 && (
            <div>
              <h3 className="font-[var(--font-mono)] text-[11px] uppercase tracking-wider text-ink-3 mb-2">Scripts</h3>
              <div className="space-y-2">
                {scripts.map((s) => (
                  <div key={s.id} className="border border-rule rounded bg-surface p-3">
                    <div className="text-[10px] font-[var(--font-mono)] uppercase tracking-wider text-copper mb-1">
                      {SCRIPT_TYPES.find((t) => t.key === s.type)?.label}
                    </div>
                    <div className="text-sm">{s.body}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {checklist.length > 0 && (
            <div>
              <h3 className="font-[var(--font-mono)] text-[11px] uppercase tracking-wider text-ink-3 mb-2">Checklist</h3>
              <ul className="space-y-1.5">
                {checklist.map((c) => (
                  <li key={c.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" disabled className="accent-[var(--patina)]" />
                    {c.text}
                    {!c.isRequired && <span className="text-ink-3 text-xs">(optional)</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {status === "training" && (
            <form action={markReadyForTest} className="pt-2">
              <input type="hidden" name="moduleId" value={moduleId} />
              <button className="btn-primary">I&apos;ve reviewed this — Take the Quiz</button>
            </form>
          )}

          {(status === "ready_for_test" || status === "tested_failed") && quiz && questions.length > 0 && (
            <QuizForm quiz={quiz} moduleId={moduleId} version={mv.version} questions={questions} lastAttempt={lastAttempt} failed={status === "tested_failed"} />
          )}
        </div>
      )}
    </div>
  );
}

function Banner({ tone, children }: { tone: "good" | "amber" | "indigo"; children: React.ReactNode }) {
  const cls = {
    good: "border-patina bg-patina-soft text-patina",
    amber: "border-amber bg-amber-soft text-amber",
    indigo: "border-indigo bg-indigo-soft text-indigo",
  }[tone];
  return <div className={`border rounded p-3 text-sm mb-5 ${cls}`}>{children}</div>;
}

function QuizForm({
  quiz,
  moduleId,
  version,
  questions,
  lastAttempt,
  failed,
}: {
  quiz: { id: string; passingScore: number };
  moduleId: string;
  version: number;
  questions: { id: string; prompt: string; options: { id: string; text: string; isCorrect: boolean; explanation: string }[] }[];
  lastAttempt?: { score: number; passed: boolean; answers: Record<string, string> };
  failed: boolean;
}) {
  return (
    <div className="border border-rule rounded-md bg-surface p-5">
      <h3 className="font-[var(--font-display)] font-semibold mb-1">Quiz</h3>
      <p className="text-xs text-ink-3 mb-4">Passing score: {quiz.passingScore}%</p>
      {failed && lastAttempt && (
        <Banner tone="amber">
          Last attempt scored {lastAttempt.score}% — below the {quiz.passingScore}% needed. Review the explanations below and try again.
        </Banner>
      )}
      <form action={submitQuizAttempt} className="space-y-5">
        <input type="hidden" name="quizId" value={quiz.id} />
        <input type="hidden" name="moduleId" value={moduleId} />
        <input type="hidden" name="moduleVersion" value={version} />
        {questions.map((q, i) => {
          const prevAnswer = lastAttempt?.answers[q.id];
          return (
            <div key={q.id}>
              <p className="text-sm font-medium mb-2">
                {i + 1}. {q.prompt}
              </p>
              <div className="space-y-1.5">
                {q.options.map((o) => (
                  <label key={o.id} className="flex flex-col gap-0.5">
                    <span className="flex items-center gap-2 text-sm">
                      <input type="radio" name={`answer_${q.id}`} value={o.id} required defaultChecked={prevAnswer === o.id} />
                      {o.text}
                    </span>
                    {failed && prevAnswer === o.id && (
                      <span className={`text-xs ml-6 ${o.isCorrect ? "text-patina" : "text-brick"}`}>{o.explanation}</span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          );
        })}
        <button type="submit" className="btn-primary">
          Submit Quiz
        </button>
      </form>
    </div>
  );
}
