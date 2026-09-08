import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { requireCurrentUser } from "@/lib/session";
import { withTenantContext } from "@/lib/drizzle/client";
import * as schema from "@/lib/drizzle/schema";
import { SCRIPT_TYPES, EMBED_KINDS } from "@/lib/constants";
import {
  createTopic,
  updateTopicTitle,
  deleteTopic,
  createStep,
  updateStep,
  deleteStep,
  addStepEmbed,
  deleteStepEmbed,
  addScript,
  deleteScript,
  addChecklistItem,
  deleteChecklistItem,
  addQuizQuestion,
  deleteQuizQuestion,
  updateScenario,
  publishModule,
} from "@/lib/actions";
import { BlockEditor } from "@/components/builder/BlockEditor";
import { AiScenarioEditor } from "@/components/builder/AiScenarioEditor";
import { Eye } from "lucide-react";

export default async function ModuleEditorPage({ params }: { params: Promise<{ moduleId: string }> }) {
  const { moduleId } = await params;
  const viewer = await requireCurrentUser();
  if (!(viewer.accessRole === "admin" || viewer.accessRole === "editor")) redirect("/builder");
  const orgId = viewer.organizationId;

  // Everything below runs in ONE transaction/connection, with independent queries fired
  // concurrently via Promise.all — each `await tx...` is otherwise a full network round trip to
  // the remote Supabase pooler, and this page needs a dozen-plus of them; sequentially awaiting
  // each one (as earlier versions of this page did) made it take 8-14s to load.
  const { mod, mv, topics, steps, embeds, blocks, quizzes, questions, options, scripts, checklist, scenario, aiScenarios } =
    await withTenantContext(orgId, async (tx) => {
      const [mod] = await tx.select().from(schema.modules).where(and(eq(schema.modules.organizationId, orgId), eq(schema.modules.id, moduleId))).limit(1);
      if (!mod) notFound();

      const [mv] = await tx.select().from(schema.moduleVersions).where(and(eq(schema.moduleVersions.organizationId, orgId), eq(schema.moduleVersions.moduleId, moduleId))).limit(1);

      const topics = await tx.select().from(schema.topics).where(and(eq(schema.topics.organizationId, orgId), eq(schema.topics.moduleVersionId, mv.id))).orderBy(schema.topics.sortOrder);
      const topicIds = topics.map((t) => t.id);

      const [scripts, checklist, scenarioRows, aiScenarios, steps] = await Promise.all([
        tx.select().from(schema.scripts).where(and(eq(schema.scripts.organizationId, orgId), eq(schema.scripts.moduleVersionId, mv.id))),
        tx
          .select()
          .from(schema.checklistItems)
          .where(and(eq(schema.checklistItems.organizationId, orgId), eq(schema.checklistItems.moduleVersionId, mv.id)))
          .orderBy(schema.checklistItems.sortOrder),
        tx.select().from(schema.practicalScenarios).where(and(eq(schema.practicalScenarios.organizationId, orgId), eq(schema.practicalScenarios.moduleVersionId, mv.id))).limit(1),
        tx.select().from(schema.aiRoleplayScenarios).where(and(eq(schema.aiRoleplayScenarios.organizationId, orgId), eq(schema.aiRoleplayScenarios.moduleVersionId, mv.id))),
        topicIds.length
          ? tx.select().from(schema.steps).where(and(eq(schema.steps.organizationId, orgId), inArray(schema.steps.topicId, topicIds))).orderBy(schema.steps.sortOrder)
          : Promise.resolve([]),
      ]);
      const stepIds = steps.map((s) => s.id);

      const [embeds, blocks, quizzes] = await Promise.all([
        stepIds.length ? tx.select().from(schema.stepEmbeds).where(and(eq(schema.stepEmbeds.organizationId, orgId), inArray(schema.stepEmbeds.stepId, stepIds))) : Promise.resolve([]),
        stepIds.length
          ? tx.select().from(schema.contentBlocks).where(and(eq(schema.contentBlocks.organizationId, orgId), inArray(schema.contentBlocks.stepId, stepIds))).orderBy(schema.contentBlocks.sortOrder)
          : Promise.resolve([]),
        topicIds.length ? tx.select().from(schema.quizzes).where(and(eq(schema.quizzes.organizationId, orgId), inArray(schema.quizzes.topicId, topicIds))) : Promise.resolve([]),
      ]);
      const quizIds = quizzes.map((q) => q.id);

      const questions = quizIds.length
        ? await tx.select().from(schema.quizQuestions).where(and(eq(schema.quizQuestions.organizationId, orgId), inArray(schema.quizQuestions.quizId, quizIds))).orderBy(schema.quizQuestions.sortOrder)
        : [];
      const questionIds = questions.map((q) => q.id);
      const options = questionIds.length
        ? await tx.select().from(schema.quizOptions).where(and(eq(schema.quizOptions.organizationId, orgId), inArray(schema.quizOptions.questionId, questionIds)))
        : [];

      return { mod, mv, topics, steps, embeds, blocks, quizzes, questions, options, scripts, checklist, scenario: scenarioRows[0], aiScenarios };
    });

  // Computed from data already fetched above, rather than re-querying everything again via
  // moduleCompleteness() in a second transaction.
  const blockStepIds = new Set(blocks.map((b) => b.stepId));
  const filledSteps = steps.filter((s) => s.body.trim().length > 0 || blockStepIds.has(s.id)).length;
  const stepsComplete = steps.length > 0 && filledSteps === steps.length;
  const completeness = {
    filled: filledSteps,
    total: steps.length,
    pct: steps.length ? Math.round((filledSteps / steps.length) * 100) : 0,
    hasQuiz: questions.length > 0,
    hasChecklist: checklist.length > 0,
    publishable: stepsComplete && questions.length > 0 && checklist.length > 0,
  };

  // BlockEditor/ContentBlockRenderer still type against the hand-written ContentBlock interface
  // (optional fields, not nullable) — map Postgres's `null` to `undefined` at this boundary.
  const blocksForUi = blocks.map((b) => ({
    ...b,
    title: b.title ?? undefined,
    body: b.body ?? undefined,
    calloutType: b.calloutType ?? undefined,
    mediaUrl: b.mediaUrl ?? undefined,
    fileSize: b.fileSize ?? undefined,
    fileFormat: b.fileFormat ?? undefined,
    checklistItems: b.checklistItems ?? undefined,
  }));

  const aiScenariosForUi = aiScenarios.map((s) => ({ ...s, topicId: s.topicId ?? undefined }));

  return (
    <div>
      <Link href="/builder" className="text-xs font-[var(--font-mono)] text-ink-3 hover:text-navy">
        ← All modules
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4 mt-3 mb-8 pb-6 border-b border-rule">
        <div>
          <h1 className="font-[var(--font-display)] font-bold text-3xl tracking-tight mb-2">{mod.title}</h1>
          <div className="flex items-center gap-2 text-xs font-[var(--font-mono)] text-ink-3">
            <span className={`pill ${mod.status === "published" ? "p-good" : "p-neutral"}`}>
              {mod.status === "published" ? `Published v${mod.currentVersion}` : "Draft — never published"}
            </span>
            <span>
              {completeness.filled}/{completeness.total} steps written · {completeness.pct}% complete
            </span>
          </div>
          <div className="mt-3">
            <Link
              href={`/learn/${moduleId}`}
              className="btn-secondary text-xs inline-flex items-center gap-1.5"
            >
              <Eye size={13} />
              Preview as Learner
            </Link>
          </div>
        </div>
        <PublishPanel moduleId={moduleId} publishable={completeness.publishable} wasPublished={mod.status === "published"} />
      </div>

      {!completeness.publishable && (
        <div className="border border-rule-2 bg-amber-soft rounded p-4 mb-8 text-sm text-ink">
          <span className="font-[var(--font-mono)] text-[10.5px] uppercase tracking-wider text-amber font-semibold block mb-1">
            Not publishable yet
          </span>
          Every step needs a body, and this module needs at least one checklist item and one quiz question somewhere
          before it can be published.
        </div>
      )}

      {/* Topics & Steps */}
      <Section title="Topics" desc="Chapters of this subject. Add as many topics as the process needs, each with its own steps and, optionally, a knowledge check.">
        <div className="space-y-5 mb-5">
          {topics.map((topic) => {
            const topicSteps = steps.filter((s) => s.topicId === topic.id);
            const quiz = quizzes.find((q) => q.topicId === topic.id);
            const topicQuestions = quiz ? questions.filter((q) => q.quizId === quiz.id) : [];
            return (
              <div key={topic.id} className="border border-rule rounded-xl bg-surface p-4">
                <div className="flex items-center gap-2 mb-4">
                  <form action={updateTopicTitle} className="flex-1 flex gap-2">
                    <input type="hidden" name="id" value={topic.id} />
                    <input type="hidden" name="moduleId" value={moduleId} />
                    <input
                      name="title"
                      defaultValue={topic.title}
                      className="flex-1 font-[var(--font-display)] font-semibold text-[15px] border border-transparent hover:border-rule-2 focus:border-navy rounded px-2 py-1 -mx-2 bg-transparent"
                    />
                    <button type="submit" className="btn-secondary text-xs shrink-0">
                      Save
                    </button>
                  </form>
                  <form action={deleteTopic}>
                    <input type="hidden" name="id" value={topic.id} />
                    <input type="hidden" name="moduleId" value={moduleId} />
                    <button className="text-xs text-brick hover:underline shrink-0">Delete topic</button>
                  </form>
                </div>

                <div className="space-y-3 mb-4">
                  {topicSteps.map((step) => {
                    const stepEmbeds = embeds.filter((e) => e.stepId === step.id);
                    const stepBlocks = blocksForUi.filter((b) => b.stepId === step.id);
                    return (
                      <div key={step.id} className="border border-rule rounded-lg bg-surface-2 p-3">
                        <form action={updateStep} className="space-y-2 mb-3">
                          <input type="hidden" name="id" value={step.id} />
                          <input type="hidden" name="moduleId" value={moduleId} />
                          <input
                            name="title"
                            defaultValue={step.title}
                            className="w-full font-medium text-sm border border-rule-2 rounded bg-surface px-2 py-1.5"
                          />
                          <textarea
                            name="body"
                            defaultValue={step.body}
                            placeholder="What does the trainee need to know or do here?"
                            rows={3}
                            className="w-full border border-rule-2 rounded bg-surface px-3 py-2 text-sm placeholder:text-ink-3 focus:outline-none focus:border-copper"
                          />
                          <div className="flex items-center gap-2">
                            <button type="submit" className="btn-secondary text-xs">
                              Save Step
                            </button>
                            {step.body.trim() ? (
                              <span className="text-[11px] text-patina">✓ written</span>
                            ) : (
                              <span className="text-[11px] text-brick">empty</span>
                            )}
                          </div>
                        </form>

                        {stepEmbeds.length > 0 && (
                          <div className="space-y-2 mb-2">
                            {stepEmbeds.map((e) => (
                              <div key={e.id} className="flex items-center gap-2">
                                <div className="text-xs text-ink-2 truncate flex-1">
                                  {EMBED_KINDS.find((k) => k.key === e.kind)?.label}: {e.label}
                                </div>
                                <form action={deleteStepEmbed}>
                                  <input type="hidden" name="id" value={e.id} />
                                  <input type="hidden" name="moduleId" value={moduleId} />
                                  <button className="text-xs text-brick hover:underline shrink-0">Remove</button>
                                </form>
                              </div>
                            ))}
                          </div>
                        )}
                        <form action={addStepEmbed} className="flex flex-wrap items-center gap-2">
                          <input type="hidden" name="stepId" value={step.id} />
                          <input type="hidden" name="moduleId" value={moduleId} />
                          <select name="kind" className="border border-rule-2 bg-surface rounded px-2 py-1 text-xs">
                            {EMBED_KINDS.map((k) => (
                              <option key={k.key} value={k.key}>
                                {k.label}
                              </option>
                            ))}
                          </select>
                          <input name="url" placeholder="https://…" className="flex-1 min-w-[140px] border border-rule-2 rounded bg-surface px-2 py-1 text-xs" />
                          <input name="label" placeholder="Label (optional)" className="w-32 border border-rule-2 rounded bg-surface px-2 py-1 text-xs" />
                          <button type="submit" className="btn-secondary text-xs shrink-0">
                            + Embed
                          </button>
                        </form>

                        {/* Rich Multimedia Blocks Editor */}
                        <BlockEditor stepId={step.id} moduleId={moduleId} blocks={stepBlocks} />

                        <form action={deleteStep} className="mt-3 pt-2 border-t border-rule/60 flex justify-end">
                          <input type="hidden" name="id" value={step.id} />
                          <input type="hidden" name="moduleId" value={moduleId} />
                          <button className="text-[11px] text-brick hover:underline">Delete step</button>
                        </form>
                      </div>
                    );
                  })}
                  {topicSteps.length === 0 && <p className="text-sm text-ink-3">No steps in this topic yet.</p>}
                </div>

                <form action={createStep} className="flex gap-2 mb-5">
                  <input type="hidden" name="topicId" value={topic.id} />
                  <input type="hidden" name="moduleId" value={moduleId} />
                  <input name="title" placeholder="New step title…" required className="flex-1 border border-rule-2 rounded bg-surface px-2.5 py-1.5 text-sm" />
                  <button type="submit" className="btn-secondary text-xs shrink-0">
                    + Add Step
                  </button>
                </form>

                <div className="border-t border-rule pt-3">
                  <h4 className="font-[var(--font-mono)] text-[10.5px] uppercase tracking-wider text-ink-3 mb-2">
                    Knowledge check for this topic
                  </h4>
                  <div className="space-y-2 mb-3">
                    {topicQuestions.map((q, i) => {
                      const qOptions = options.filter((o) => o.questionId === q.id);
                      return (
                        <div key={q.id} className="border border-rule rounded bg-surface p-3">
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="font-medium text-sm">
                              {i + 1}. {q.prompt}
                            </div>
                            <form action={deleteQuizQuestion}>
                              <input type="hidden" name="id" value={q.id} />
                              <input type="hidden" name="moduleId" value={moduleId} />
                              <button className="text-xs text-brick hover:underline shrink-0">Remove</button>
                            </form>
                          </div>
                          <ul className="space-y-1">
                            {qOptions.map((o) => (
                              <li key={o.id} className={`text-xs px-2 py-1 rounded ${o.isCorrect ? "bg-patina-soft text-patina" : "text-ink-2"}`}>
                                {o.isCorrect ? "✓ " : "· "}
                                {o.text}
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                    {topicQuestions.length === 0 && <p className="text-sm text-ink-3">No questions yet.</p>}
                  </div>
                  <details className="text-sm">
                    <summary className="cursor-pointer text-navy font-medium">+ Add a question</summary>
                    <form action={addQuizQuestion} className="border border-dashed border-rule-2 rounded p-4 space-y-3 mt-3">
                      <input type="hidden" name="topicId" value={topic.id} />
                      <input type="hidden" name="moduleId" value={moduleId} />
                      <input name="prompt" placeholder="Question prompt…" required className="w-full border border-rule-2 rounded bg-surface px-3 py-1.5 text-sm" />
                      {[0, 1, 2, 3].map((i) => (
                        <div key={i} className="flex items-start gap-2">
                          <input type="radio" name="correctIndex" value={i} defaultChecked={i === 0} required className="mt-2.5" />
                          <div className="flex-1 space-y-1">
                            <input name={`option${i}`} placeholder={`Option ${i + 1}`} className="w-full border border-rule-2 rounded bg-surface px-2 py-1 text-sm" />
                            <input name={`explanation${i}`} placeholder="Explanation if chosen…" className="w-full border border-rule-2 rounded bg-surface px-2 py-1 text-xs text-ink-2" />
                          </div>
                        </div>
                      ))}
                      <button type="submit" className="btn-secondary">
                        Add Question
                      </button>
                    </form>
                  </details>
                </div>
              </div>
            );
          })}
          {topics.length === 0 && <p className="text-sm text-ink-3">No topics yet — add the first one below.</p>}
        </div>

        <form action={createTopic} className="border border-dashed border-rule-2 rounded p-4 flex gap-2">
          <input type="hidden" name="moduleVersionId" value={mv.id} />
          <input type="hidden" name="moduleId" value={moduleId} />
          <input name="title" placeholder="New topic title…" required className="flex-1 border border-rule-2 rounded bg-surface px-2.5 py-1.5 text-sm" />
          <button type="submit" className="btn-primary shrink-0">
            + Add Topic
          </button>
        </form>
      </Section>

      {/* Scripts */}
      <Section title="Scripts" desc="Separate from the topics so a CSR can pull one up mid-call, on a phone.">
        <div className="space-y-3 mb-5">
          {scripts.map((s) => (
            <div key={s.id} className="border border-rule rounded bg-surface p-3 flex items-start justify-between gap-3">
              <div>
                <div className="font-[var(--font-mono)] text-[10.5px] uppercase tracking-wider text-copper mb-1">
                  {SCRIPT_TYPES.find((t) => t.key === s.type)?.label}
                </div>
                <div className="text-sm text-ink whitespace-pre-wrap">{s.body}</div>
              </div>
              <form action={deleteScript}>
                <input type="hidden" name="id" value={s.id} />
                <button className="text-xs text-brick hover:underline shrink-0">Remove</button>
              </form>
            </div>
          ))}
          {scripts.length === 0 && <p className="text-sm text-ink-3">No scripts yet.</p>}
        </div>
        <form action={addScript} className="border border-dashed border-rule-2 rounded p-4 space-y-2">
          <input type="hidden" name="moduleVersionId" value={mv.id} />
          <div className="flex gap-2">
            <select name="type" className="border border-rule-2 bg-surface rounded px-2 py-1.5 text-sm">
              {SCRIPT_TYPES.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
            <button type="submit" className="btn-secondary">
              Add Script
            </button>
          </div>
          <textarea name="body" placeholder="Script text…" rows={2} className="w-full border border-rule-2 rounded bg-surface px-3 py-2 text-sm" />
        </form>
      </Section>

      {/* Checklist */}
      <Section title="Checklist Items" desc="Used by training now, and by live job execution once Phase 3 ships — same rows.">
        <div className="space-y-2 mb-5">
          {checklist.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 border border-rule rounded bg-surface px-3 py-2">
              <span className="text-sm">
                {c.text} {!c.isRequired && <span className="text-ink-3 text-xs">(optional)</span>}
              </span>
              <form action={deleteChecklistItem}>
                <input type="hidden" name="id" value={c.id} />
                <button className="text-xs text-brick hover:underline shrink-0">Remove</button>
              </form>
            </div>
          ))}
          {checklist.length === 0 && <p className="text-sm text-ink-3">No checklist items yet.</p>}
        </div>
        <form action={addChecklistItem} className="border border-dashed border-rule-2 rounded p-4 flex flex-wrap items-center gap-3">
          <input type="hidden" name="moduleVersionId" value={mv.id} />
          <input name="text" placeholder="Checklist step…" required className="flex-1 min-w-[220px] border border-rule-2 rounded bg-surface px-3 py-1.5 text-sm" />
          <label className="flex items-center gap-1.5 text-xs text-ink-2">
            <input type="checkbox" name="isRequired" defaultChecked /> required
          </label>
          <button type="submit" className="btn-secondary">
            Add Item
          </button>
        </form>
      </Section>

      {/* AI Roleplay Simulator Scenarios */}
      <AiScenarioEditor moduleVersionId={mv.id} moduleId={moduleId} topics={topics} scenarios={aiScenariosForUi} />

      {/* Practical scenario */}
      <Section title="Practical Scenario" desc="Level 2/3 of the testing model — the rubric evaluator uses this prompt.">
        <form action={updateScenario} className="space-y-3">
          <input type="hidden" name="moduleVersionId" value={mv.id} />
          <textarea
            name="prompt"
            defaultValue={scenario?.prompt ?? ""}
            rows={3}
            placeholder="Describe the scenario the trainee will be evaluated against…"
            className="w-full border border-rule-2 rounded bg-surface px-3 py-2 text-sm"
          />
          <button type="submit" className="btn-secondary">
            Save Scenario
          </button>
        </form>
      </Section>
    </div>
  );
}

function Section({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <section className="mb-12">
      <h2 className="font-[var(--font-display)] font-semibold text-lg mb-1">{title}</h2>
      <p className="text-ink-2 text-[13.5px] mb-4">{desc}</p>
      {children}
    </section>
  );
}

function PublishPanel({ moduleId, publishable, wasPublished }: { moduleId: string; publishable: boolean; wasPublished: boolean }) {
  return (
    <form action={publishModule} className="border border-rule rounded-md bg-surface p-4 w-full sm:w-80 shrink-0">
      <input type="hidden" name="moduleId" value={moduleId} />
      {wasPublished && (
        <label className="block text-xs mb-2">
          <span className="text-ink-3 font-[var(--font-mono)] uppercase tracking-wider block mb-1">Change type</span>
          <select name="changeType" className="w-full border border-rule-2 bg-paper rounded px-2 py-1.5 text-sm">
            <option value="cosmetic">Cosmetic — wording, no process change</option>
            <option value="material">Material — process actually changed</option>
          </select>
        </label>
      )}
      {!wasPublished && <input type="hidden" name="changeType" value="material" />}
      <label className="block text-xs mb-3">
        <span className="text-ink-3 font-[var(--font-mono)] uppercase tracking-wider block mb-1">Changelog</span>
        <input
          name="changelog"
          placeholder={wasPublished ? "What changed and why…" : "Initial published version"}
          className="w-full border border-rule-2 bg-paper rounded px-2 py-1.5 text-sm"
        />
      </label>
      <button type="submit" disabled={!publishable} className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed">
        {wasPublished ? "Publish New Version" : "Publish v1"}
      </button>
      {wasPublished && (
        <p className="text-[11px] text-ink-3 mt-2">
          A material change flips everyone currently certified to <strong>Needs Retraining</strong>, automatically.
        </p>
      )}
    </form>
  );
}
