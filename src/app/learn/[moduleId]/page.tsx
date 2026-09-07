import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { SCRIPT_TYPES } from "@/lib/constants";
import { topicsForModuleVersion, stepsForTopic, completedStepIds, quizzesForModuleVersion } from "@/lib/derive";
import { StatusPill } from "@/components/StatusPill";
import { StepEmbedView } from "@/components/StepEmbedView";
import { startTraining, completeStep, submitQuizAttempt } from "@/lib/actions";
import { ContentBlockRenderer } from "@/components/blocks/ContentBlockRenderer";
import { AiRoleplayWidget } from "@/components/roleplay/AiRoleplayWidget";
import { Sparkles, Edit3 } from "lucide-react";
import type { Step, StepEmbed, ContentBlock } from "@/lib/types";

export default async function ModuleViewerPage({ params }: { params: Promise<{ moduleId: string }> }) {
  const { moduleId } = await params;
  const db = getDb();
  const user = await getCurrentUser();
  const mod = db.modules.find((m) => m.id === moduleId);
  if (!mod) notFound();
  const mv = db.moduleVersions.find((v) => v.moduleId === moduleId)!;
  const topics = topicsForModuleVersion(mv.id);
  const scripts = db.scripts.filter((s) => s.moduleVersionId === mv.id);
  const checklist = db.checklistItems.filter((c) => c.moduleVersionId === mv.id).sort((a, b) => a.sortOrder - b.sortOrder);
  const cert = db.certifications.find((c) => c.userId === user.id && c.moduleId === moduleId);
  const status = cert?.status ?? "not_started";
  const done = completedStepIds(user.id);
  const allBlocks = db.contentBlocks || [];
  const aiScenarios = (db.aiRoleplayScenarios || []).filter((s) => s.moduleVersionId === mv.id);
  const isStaff = user.isAdmin || user.isManager;

  const isReferenceMode = status === "certified" || status === "tested_passed";
  const isActiveFlow = status === "training" || status === "ready_for_test" || status === "tested_failed" || status === "needs_retraining";

  // The first not-yet-completed step, in reading order across all topics — nothing after it unlocks.
  const allSteps = topics.flatMap((t) => stepsForTopic(t.id));
  const currentStep = allSteps.find((s) => !done.has(s.id));
  const allStepsDone = isActiveFlow && !currentStep;

  const quizzesWithQuestions = quizzesForModuleVersion(mv.id)
    .map((q) => ({ quiz: q, questions: db.quizQuestions.filter((qq) => qq.quizId === q.id) }))
    .filter((q) => q.questions.length > 0);

  if (mod.status !== "published") {
    return (
      <div>
        <Link href="/?view=training" className="text-xs font-[var(--font-mono)] text-ink-3 hover:text-navy">
          ← My training
        </Link>
        <p className="mt-6 text-ink-2">This module hasn&apos;t been published yet — check back soon.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto sm:mx-0">
      <Link href="/?view=training" className="text-xs font-[var(--font-mono)] text-ink-3 hover:text-navy">
        ← My training
      </Link>

      <div className="flex items-start justify-between gap-4 mt-3 mb-6">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-[var(--font-display)] font-bold text-2xl tracking-tight mb-2">{mod.title}</h1>
            {isStaff && (
              <Link
                href={`/builder/${moduleId}`}
                className="btn-secondary text-xs inline-flex items-center gap-1.5 mb-2 py-1 px-2.5"
              >
                <Edit3 size={12} />
                Edit in Studio
              </Link>
            )}
          </div>
          <div className="text-xs text-ink-3 font-[var(--font-mono)]">v{mod.currentVersion} · {mod.estimatedMinutes} min</div>
        </div>
        <StatusPill status={status} />
      </div>

      {status === "certified" && (
        <Banner tone="good">
          You&apos;re certified on this module. <Link href={`/cert/${cert!.id}`} className="underline">View your certification record</Link>.
          Everything below stays open as a reference.
        </Banner>
      )}
      {status === "needs_retraining" && (
        <Banner tone="amber">This module was updated since you were certified. Review anything new below, then retake the knowledge check.</Banner>
      )}
      {status === "tested_passed" && (
        <Banner tone="indigo">Every knowledge check passed. Your manager still needs to score your practical evaluation and certify you.</Banner>
      )}

      {status === "not_started" && (
        <form action={startTraining}>
          <input type="hidden" name="moduleId" value={moduleId} />
          <button className="btn-primary">Begin Training</button>
        </form>
      )}

      {(isActiveFlow || isReferenceMode) && (
        <div className="space-y-8 mt-2">
          {topics.map((topic) => {
            const steps = stepsForTopic(topic.id);
            return (
              <div key={topic.id}>
                <h2 className="font-[var(--font-display)] font-semibold text-[15px] mb-3 pb-2 border-b border-rule">{topic.title}</h2>
                <div className="space-y-5">
                  {steps.map((step) => (
                    <StepView
                      key={step.id}
                      step={step}
                      unlocked={isReferenceMode || done.has(step.id) || step.id === currentStep?.id}
                      isCurrent={!isReferenceMode && step.id === currentStep?.id}
                      moduleId={moduleId}
                      moduleVersionId={mv.id}
                      embeds={db.stepEmbeds.filter((e) => e.stepId === step.id)}
                      blocks={allBlocks.filter((b) => b.stepId === step.id)}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {scripts.length > 0 && (
            <div>
              <h2 className="font-[var(--font-display)] font-semibold text-[15px] mb-3 pb-2 border-b border-rule">Scripts</h2>
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
              <h2 className="font-[var(--font-display)] font-semibold text-[15px] mb-3 pb-2 border-b border-rule">Checklist</h2>
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

          {/* AI Roleplay Simulator Scenarios */}
          {aiScenarios.length > 0 && (
            <div className="pt-6 border-t border-rule">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="p-1 rounded-lg bg-copper-soft text-copper-deep">
                  <Sparkles size={16} />
                </div>
                <h2 className="font-[var(--font-display)] font-bold text-base text-ink">
                  Interactive AI Roleplay Simulation
                </h2>
              </div>
              <p className="text-xs text-ink-2 mb-4">
                Practice in real time with this simulated customer to test your handling of objections and DTR scripts.
              </p>
              <div className="space-y-6">
                {aiScenarios.map((scenario) => {
                  const session = (db.aiRoleplaySessions || []).find(
                    (sess) => sess.userId === user.id && sess.scenarioId === scenario.id
                  );
                  return (
                    <AiRoleplayWidget
                      key={scenario.id}
                      scenario={scenario}
                      existingSession={session}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {isActiveFlow && allStepsDone && quizzesWithQuestions.length > 0 && (
            <div>
              <h2 className="font-[var(--font-display)] font-semibold text-[15px] mb-3 pb-2 border-b border-rule">Knowledge Checks</h2>
              <div className="space-y-4">
                {quizzesWithQuestions.map(({ quiz, questions }) => {
                  const topic = topics.find((t) => t.id === quiz.topicId);
                  const attempts = db.quizAttempts.filter((a) => a.userId === user.id && a.quizId === quiz.id).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
                  const passed = attempts.some((a) => a.passed);
                  const lastAttempt = attempts[0];
                  return (
                    <QuizCard
                      key={quiz.id}
                      title={topic?.title ?? "Knowledge check"}
                      quiz={quiz}
                      moduleId={moduleId}
                      version={mv.version}
                      questions={questions}
                      passed={passed}
                      lastAttempt={lastAttempt}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StepView({
  step,
  unlocked,
  isCurrent,
  moduleId,
  moduleVersionId,
  embeds,
  blocks,
}: {
  step: Step;
  unlocked: boolean;
  isCurrent: boolean;
  moduleId: string;
  moduleVersionId: string;
  embeds: StepEmbed[];
  blocks: ContentBlock[];
}) {
  if (!unlocked) {
    return <div className="text-sm text-ink-3 pl-3 border-l-2 border-rule">{step.title} — locked</div>;
  }
  return (
    <div className="pl-3.5 border-l-2 border-patina py-1">
      <h3 className="font-[var(--font-mono)] text-[11.5px] uppercase font-bold tracking-wider text-ink-3 mb-2">{step.title}</h3>
      {step.body && <p className="text-[14.5px] whitespace-pre-wrap leading-relaxed mb-3">{step.body}</p>}
      
      {/* Rich Multimedia Content Blocks */}
      {blocks.length > 0 && (
        <div className="space-y-3 mb-4">
          {blocks.map((b) => (
            <ContentBlockRenderer key={b.id} block={b} />
          ))}
        </div>
      )}

      {embeds.length > 0 && (
        <div className="space-y-2 mb-3">
          {embeds.map((e) => (
            <StepEmbedView key={e.id} embed={e} />
          ))}
        </div>
      )}
      {isCurrent && (
        <form action={completeStep} className="mt-3">
          <input type="hidden" name="stepId" value={step.id} />
          <input type="hidden" name="moduleId" value={moduleId} />
          <input type="hidden" name="moduleVersionId" value={moduleVersionId} />
          <button className="btn-primary text-[13px]">Mark Complete &amp; Continue</button>
        </form>
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

function QuizCard({
  title,
  quiz,
  moduleId,
  version,
  questions,
  passed,
  lastAttempt,
}: {
  title: string;
  quiz: { id: string; passingScore: number };
  moduleId: string;
  version: number;
  questions: { id: string; prompt: string; options: { id: string; text: string; isCorrect: boolean; explanation: string }[] }[];
  passed: boolean;
  lastAttempt?: { score: number; passed: boolean; answers: Record<string, string> };
}) {
  if (passed) {
    return (
      <div className="border border-patina bg-patina-soft rounded-md p-4 flex items-center justify-between">
        <span className="font-medium text-sm text-patina">{title}</span>
        <span className="pill p-good">Passed</span>
      </div>
    );
  }
  const failed = !!lastAttempt && !lastAttempt.passed;
  return (
    <div className="border border-rule rounded-md bg-surface p-5">
      <h3 className="font-[var(--font-display)] font-semibold mb-1">{title}</h3>
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
          Submit
        </button>
      </form>
    </div>
  );
}
