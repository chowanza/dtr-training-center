import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { moduleCompleteness } from "@/lib/derive";
import { SOP_SECTIONS, SCRIPT_TYPES } from "@/lib/constants";
import {
  saveAllSections,
  addScript,
  deleteScript,
  addChecklistItem,
  deleteChecklistItem,
  addQuizQuestion,
  deleteQuizQuestion,
  updateScenario,
  publishModule,
} from "@/lib/actions";

export default async function ModuleEditorPage({ params }: { params: Promise<{ moduleId: string }> }) {
  const { moduleId } = await params;
  const db = getDb();
  const mod = db.modules.find((m) => m.id === moduleId);
  if (!mod) notFound();
  const mv = db.moduleVersions.find((v) => v.moduleId === moduleId)!;
  const sections = db.sopSections.filter((s) => s.moduleVersionId === mv.id);
  const scripts = db.scripts.filter((s) => s.moduleVersionId === mv.id);
  const checklist = db.checklistItems.filter((c) => c.moduleVersionId === mv.id).sort((a, b) => a.sortOrder - b.sortOrder);
  const quiz = db.quizzes.find((q) => q.moduleVersionId === mv.id);
  const questions = quiz ? db.quizQuestions.filter((q) => q.quizId === quiz.id) : [];
  const scenario = db.practicalScenarios.find((s) => s.moduleVersionId === mv.id);
  const completeness = moduleCompleteness(mv.id);

  const saveSectionsAction = saveAllSections.bind(null, moduleId);

  return (
    <div>
      <Link href="/builder" className="text-xs font-[var(--font-mono)] text-ink-3 hover:text-copper">
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
              {completeness.filled}/{completeness.total} sections · {completeness.pct}% complete
            </span>
          </div>
        </div>
        <PublishPanel moduleId={moduleId} publishable={completeness.publishable} wasPublished={mod.status === "published"} />
      </div>

      {!completeness.publishable && (
        <div className="border border-rule-2 bg-amber-soft rounded p-4 mb-8 text-sm text-ink">
          <span className="font-[var(--font-mono)] text-[10.5px] uppercase tracking-wider text-amber font-semibold block mb-1">
            Not publishable yet
          </span>
          This module needs all 13 SOP sections filled in, at least one checklist item, and at least one quiz
          question before it can be published.
        </div>
      )}

      {/* SOP Sections */}
      <Section title="SOP Sections" desc="Luis's thirteen-section template, as thirteen rows — not one text blob.">
        <form action={saveSectionsAction} className="space-y-5">
          {SOP_SECTIONS.map((sec) => {
            const row = sections.find((s) => s.sectionKey === sec.key);
            return (
              <div key={sec.key}>
                <label className="flex items-center gap-2 font-[var(--font-mono)] text-[11px] uppercase tracking-wider text-ink-3 mb-1.5">
                  {sec.label}
                  {row?.body.trim() ? (
                    <span className="text-patina normal-case tracking-normal">✓ filled</span>
                  ) : (
                    <span className="text-brick normal-case tracking-normal">empty</span>
                  )}
                </label>
                <textarea
                  name={`section:${row?.id}`}
                  defaultValue={row?.body ?? ""}
                  rows={sec.key === "steps" || sec.key === "decision_rules" || sec.key === "common_mistakes" ? 4 : 2}
                  className="w-full border border-rule-2 rounded bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:border-copper"
                />
              </div>
            );
          })}
          <button type="submit" className="btn-primary">
            Save Sections
          </button>
        </form>
      </Section>

      {/* Scripts */}
      <Section title="Scripts" desc="Separate from the SOP so a CSR can pull one up mid-call, on a phone.">
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

      {/* Quiz */}
      <Section title="Quiz" desc="Show the explanation on a wrong answer — the quiz teaches, it doesn't just gate.">
        <div className="space-y-4 mb-5">
          {questions.map((q, i) => (
            <div key={q.id} className="border border-rule rounded bg-surface p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="font-medium text-sm">
                  {i + 1}. {q.prompt}
                </div>
                <form action={deleteQuizQuestion}>
                  <input type="hidden" name="id" value={q.id} />
                  <button className="text-xs text-brick hover:underline shrink-0">Remove</button>
                </form>
              </div>
              <ul className="space-y-1">
                {q.options.map((o) => (
                  <li key={o.id} className={`text-xs px-2 py-1 rounded ${o.isCorrect ? "bg-patina-soft text-patina" : "text-ink-2"}`}>
                    {o.isCorrect ? "✓ " : "· "}
                    {o.text}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {questions.length === 0 && <p className="text-sm text-ink-3">No questions yet.</p>}
        </div>
        <form action={addQuizQuestion} className="border border-dashed border-rule-2 rounded p-4 space-y-3">
          <input type="hidden" name="moduleVersionId" value={mv.id} />
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
      </Section>

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
