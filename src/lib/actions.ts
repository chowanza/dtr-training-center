"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { db, withTenantContext } from "./drizzle/client";
import * as schema from "./drizzle/schema";
import { requireCurrentUser } from "./session";
import { createSupabaseAdminClient } from "./supabase/admin";
import type { CertStatus, RubricKey } from "./constants";
import { STARTER_OUTLINE } from "./constants";
import { moduleCompleteness, allModuleQuizzesPassed, orderedSteps } from "./derive";
import { reindexModule } from "./knowledge-index";
import { createNotificationTx } from "./notifications";
import { processRoleplayTurn } from "./ai-roleplay";
import { answerFromKnowledgeBase } from "./ai-chat";
import { callModelForJson } from "./ai-client";
import type { AiRoleplayMessage } from "./types";

type Tx = typeof db;

async function requireStaff() {
  const user = await requireCurrentUser();
  if (!(user.accessRole === "admin" || user.accessRole === "editor")) throw new Error("Not authorized to edit content");
  return user;
}

async function requireAdmin() {
  const user = await requireCurrentUser();
  if (user.accessRole !== "admin") throw new Error("Admin access required");
  return user;
}

async function logCertEvent(
  tx: Tx,
  orgId: string,
  certificationId: string,
  fromStatus: CertStatus | null,
  toStatus: CertStatus,
  actorId: string,
  reason: string
) {
  await tx.insert(schema.certificationEvents).values({ organizationId: orgId, certificationId, fromStatus, toStatus, actorId, reason });
}

async function getOrCreateCert(tx: Tx, orgId: string, userId: string, moduleId: string) {
  const existing = await tx
    .select()
    .from(schema.certifications)
    .where(and(eq(schema.certifications.organizationId, orgId), eq(schema.certifications.userId, userId), eq(schema.certifications.moduleId, moduleId)))
    .limit(1);
  if (existing[0]) return existing[0];
  const [cert] = await tx.insert(schema.certifications).values({ organizationId: orgId, userId, moduleId, status: "not_started" }).returning();
  await logCertEvent(tx, orgId, cert.id, null, "not_started", userId, "Assigned.");
  return cert;
}

async function getOrCreateQuiz(tx: Tx, orgId: string, topicId: string) {
  const existing = await tx.select().from(schema.quizzes).where(and(eq(schema.quizzes.organizationId, orgId), eq(schema.quizzes.topicId, topicId))).limit(1);
  if (existing[0]) return existing[0];
  const [quiz] = await tx.insert(schema.quizzes).values({ organizationId: orgId, topicId }).returning();
  return quiz;
}

async function autoAssignForRole(tx: Tx, orgId: string, userId: string, roleId: string, assignedBy: string) {
  const requirements = await tx
    .select()
    .from(schema.roleModuleRequirements)
    .where(and(eq(schema.roleModuleRequirements.organizationId, orgId), eq(schema.roleModuleRequirements.roleId, roleId), eq(schema.roleModuleRequirements.isRequired, true)));
  for (const req of requirements) {
    const already = await tx
      .select({ id: schema.assignments.id })
      .from(schema.assignments)
      .where(and(eq(schema.assignments.organizationId, orgId), eq(schema.assignments.userId, userId), eq(schema.assignments.moduleId, req.moduleId)))
      .limit(1);
    if (already.length === 0) {
      await tx.insert(schema.assignments).values({ organizationId: orgId, userId, moduleId: req.moduleId, assignedBy, source: "auto" });
    }
  }
}

// ---------------- Module Builder ----------------

export async function createTopic(formData: FormData) {
  const user = await requireStaff();
  const moduleVersionId = z.string().parse(formData.get("moduleVersionId"));
  const moduleId = z.string().parse(formData.get("moduleId"));
  const title = z.string().min(1).parse(formData.get("title"));
  await withTenantContext(user.organizationId, async (tx) => {
    const existing = await tx.select({ id: schema.topics.id }).from(schema.topics).where(and(eq(schema.topics.organizationId, user.organizationId), eq(schema.topics.moduleVersionId, moduleVersionId)));
    await tx.insert(schema.topics).values({ organizationId: user.organizationId, moduleVersionId, title, sortOrder: existing.length + 1 });
  });
  revalidatePath(`/builder/${moduleId}`);
}

export async function updateTopicTitle(formData: FormData) {
  const user = await requireStaff();
  const id = z.string().parse(formData.get("id"));
  const moduleId = z.string().parse(formData.get("moduleId"));
  const title = z.string().min(1).parse(formData.get("title"));
  await withTenantContext(user.organizationId, async (tx) => {
    const result = await tx
      .update(schema.topics)
      .set({ title })
      .where(and(eq(schema.topics.organizationId, user.organizationId), eq(schema.topics.id, id)))
      .returning({ id: schema.topics.id });
    if (result.length === 0) throw new Error("Topic not found");
  });
  revalidatePath(`/builder/${moduleId}`);
}

export async function deleteTopic(formData: FormData) {
  const user = await requireStaff();
  const id = z.string().parse(formData.get("id"));
  const moduleId = z.string().parse(formData.get("moduleId"));
  await withTenantContext(user.organizationId, async (tx) => {
    // quizzes.topicId cascades on delete — without this guard, deleting a topic silently takes
    // its knowledge check (and every question/option on it) with it, with no warning anywhere.
    const [quiz] = await tx.select({ id: schema.quizzes.id }).from(schema.quizzes).where(and(eq(schema.quizzes.organizationId, user.organizationId), eq(schema.quizzes.topicId, id))).limit(1);
    if (quiz) {
      const [question] = await tx
        .select({ id: schema.quizQuestions.id })
        .from(schema.quizQuestions)
        .where(and(eq(schema.quizQuestions.organizationId, user.organizationId), eq(schema.quizQuestions.quizId, quiz.id)))
        .limit(1);
      if (question) throw new Error("This topic has a knowledge check on it — remove its questions first, or deleting the topic will take the quiz with it.");
    }
    await tx.delete(schema.topics).where(and(eq(schema.topics.organizationId, user.organizationId), eq(schema.topics.id, id)));
  });
  revalidatePath(`/builder/${moduleId}`);
}

export async function createStep(formData: FormData) {
  const user = await requireStaff();
  const topicId = z.string().parse(formData.get("topicId"));
  const moduleId = z.string().parse(formData.get("moduleId"));
  const title = z.string().min(1).parse(formData.get("title"));
  await withTenantContext(user.organizationId, async (tx) => {
    const existing = await tx.select({ id: schema.steps.id }).from(schema.steps).where(and(eq(schema.steps.organizationId, user.organizationId), eq(schema.steps.topicId, topicId)));
    await tx.insert(schema.steps).values({ organizationId: user.organizationId, topicId, title, body: "", sortOrder: existing.length + 1 });
  });
  revalidatePath(`/builder/${moduleId}`);
}

export async function updateStep(formData: FormData) {
  const user = await requireStaff();
  const id = z.string().parse(formData.get("id"));
  const moduleId = z.string().parse(formData.get("moduleId"));
  const title = z.string().min(1).parse(formData.get("title"));
  const body = z.string().parse(formData.get("body"));
  await withTenantContext(user.organizationId, async (tx) => {
    const result = await tx
      .update(schema.steps)
      .set({ title, body })
      .where(and(eq(schema.steps.organizationId, user.organizationId), eq(schema.steps.id, id)))
      .returning({ id: schema.steps.id });
    if (result.length === 0) throw new Error("Step not found");
  });
  revalidatePath(`/builder/${moduleId}`);
}

export async function deleteStep(formData: FormData) {
  const user = await requireStaff();
  const id = z.string().parse(formData.get("id"));
  const moduleId = z.string().parse(formData.get("moduleId"));
  await withTenantContext(user.organizationId, (tx) => tx.delete(schema.steps).where(and(eq(schema.steps.organizationId, user.organizationId), eq(schema.steps.id, id))));
  revalidatePath(`/builder/${moduleId}`);
}

export async function addStepEmbed(formData: FormData) {
  const user = await requireStaff();
  const stepId = z.string().parse(formData.get("stepId"));
  const moduleId = z.string().parse(formData.get("moduleId"));
  const kind = z.enum(["video", "image", "link"]).parse(formData.get("kind"));
  const url = z.string().url().parse(formData.get("url"));
  const label = z.string().parse(formData.get("label"));
  await withTenantContext(user.organizationId, (tx) =>
    tx.insert(schema.stepEmbeds).values({ organizationId: user.organizationId, stepId, kind, url, label: label || url })
  );
  revalidatePath(`/builder/${moduleId}`);
}

export async function deleteStepEmbed(formData: FormData) {
  const user = await requireStaff();
  const id = z.string().parse(formData.get("id"));
  const moduleId = z.string().parse(formData.get("moduleId"));
  await withTenantContext(user.organizationId, (tx) => tx.delete(schema.stepEmbeds).where(and(eq(schema.stepEmbeds.organizationId, user.organizationId), eq(schema.stepEmbeds.id, id))));
  revalidatePath(`/builder/${moduleId}`);
}

export async function addScript(formData: FormData) {
  const user = await requireStaff();
  const moduleVersionId = z.string().parse(formData.get("moduleVersionId"));
  const type = z.string().parse(formData.get("type")) as (typeof schema.scriptTypeEnum.enumValues)[number];
  const body = z.string().parse(formData.get("body"));
  await withTenantContext(user.organizationId, (tx) => tx.insert(schema.scripts).values({ organizationId: user.organizationId, moduleVersionId, type, body }));
  revalidatePath("/builder", "layout");
}

export async function deleteScript(formData: FormData) {
  const user = await requireStaff();
  const id = z.string().parse(formData.get("id"));
  await withTenantContext(user.organizationId, (tx) => tx.delete(schema.scripts).where(and(eq(schema.scripts.organizationId, user.organizationId), eq(schema.scripts.id, id))));
  revalidatePath("/builder", "layout");
}

export async function addChecklistItem(formData: FormData) {
  const user = await requireStaff();
  const moduleVersionId = z.string().parse(formData.get("moduleVersionId"));
  const text = z.string().min(1).parse(formData.get("text"));
  await withTenantContext(user.organizationId, async (tx) => {
    const existing = await tx
      .select({ id: schema.checklistItems.id })
      .from(schema.checklistItems)
      .where(and(eq(schema.checklistItems.organizationId, user.organizationId), eq(schema.checklistItems.moduleVersionId, moduleVersionId)));
    await tx.insert(schema.checklistItems).values({
      organizationId: user.organizationId,
      moduleVersionId,
      text,
      sortOrder: existing.length + 1,
      isRequired: formData.get("isRequired") === "on",
    });
  });
  revalidatePath("/builder", "layout");
}

export async function deleteChecklistItem(formData: FormData) {
  const user = await requireStaff();
  const id = z.string().parse(formData.get("id"));
  await withTenantContext(user.organizationId, (tx) =>
    tx.delete(schema.checklistItems).where(and(eq(schema.checklistItems.organizationId, user.organizationId), eq(schema.checklistItems.id, id)))
  );
  revalidatePath("/builder", "layout");
}

export async function addQuizQuestion(formData: FormData) {
  const user = await requireStaff();
  const topicId = z.string().parse(formData.get("topicId"));
  const moduleId = z.string().parse(formData.get("moduleId"));
  const prompt = z.string().min(1).parse(formData.get("prompt"));
  const correctIndex = Number(formData.get("correctIndex"));
  const optionTexts = [0, 1, 2, 3].map((i) => String(formData.get(`option${i}`) ?? "").trim()).filter(Boolean);
  if (optionTexts.length < 2) throw new Error("Need at least 2 options");

  await withTenantContext(user.organizationId, async (tx) => {
    const quiz = await getOrCreateQuiz(tx, user.organizationId, topicId);
    const existingQuestions = await tx
      .select({ id: schema.quizQuestions.id })
      .from(schema.quizQuestions)
      .where(and(eq(schema.quizQuestions.organizationId, user.organizationId), eq(schema.quizQuestions.quizId, quiz.id)));
    const [question] = await tx
      .insert(schema.quizQuestions)
      .values({ organizationId: user.organizationId, quizId: quiz.id, prompt, sortOrder: existingQuestions.length + 1 })
      .returning();
    await tx.insert(schema.quizOptions).values(
      optionTexts.map((text, i) => ({
        organizationId: user.organizationId,
        questionId: question.id,
        text,
        isCorrect: i === correctIndex,
        explanation: String(formData.get(`explanation${i}`) ?? ""),
      }))
    );
  });
  revalidatePath(`/builder/${moduleId}`);
}

export async function deleteQuizQuestion(formData: FormData) {
  const user = await requireStaff();
  const id = z.string().parse(formData.get("id"));
  const moduleId = z.string().parse(formData.get("moduleId"));
  await withTenantContext(user.organizationId, (tx) =>
    tx.delete(schema.quizQuestions).where(and(eq(schema.quizQuestions.organizationId, user.organizationId), eq(schema.quizQuestions.id, id)))
  );
  revalidatePath(`/builder/${moduleId}`);
}

export async function updateScenario(formData: FormData) {
  const user = await requireStaff();
  const moduleVersionId = z.string().parse(formData.get("moduleVersionId"));
  const prompt = z.string().parse(formData.get("prompt"));
  await withTenantContext(user.organizationId, async (tx) => {
    const existing = await tx
      .select({ id: schema.practicalScenarios.id })
      .from(schema.practicalScenarios)
      .where(and(eq(schema.practicalScenarios.organizationId, user.organizationId), eq(schema.practicalScenarios.moduleVersionId, moduleVersionId)))
      .limit(1);
    if (existing[0]) {
      await tx.update(schema.practicalScenarios).set({ prompt }).where(eq(schema.practicalScenarios.id, existing[0].id));
    } else {
      await tx.insert(schema.practicalScenarios).values({ organizationId: user.organizationId, moduleVersionId, prompt, kind: "simulated" });
    }
  });
  revalidatePath("/builder", "layout");
}

const publishSchema = z.object({
  moduleId: z.string(),
  changeType: z.enum(["material", "cosmetic"]),
  changelog: z.string(),
});

export async function publishModule(formData: FormData) {
  const user = await requireStaff();
  const { moduleId, changeType, changelog } = publishSchema.parse({
    moduleId: formData.get("moduleId"),
    changeType: formData.get("changeType"),
    changelog: formData.get("changelog"),
  });

  const [mv] = await withTenantContext(user.organizationId, (tx) =>
    tx.select().from(schema.moduleVersions).where(and(eq(schema.moduleVersions.organizationId, user.organizationId), eq(schema.moduleVersions.moduleId, moduleId))).limit(1)
  );
  if (!mv) throw new Error("Module not found");

  const completeness = await moduleCompleteness(user.organizationId, mv.id);
  if (!completeness.publishable) throw new Error("Module is not complete enough to publish");

  await withTenantContext(user.organizationId, async (tx) => {
    const [mod] = await tx.select().from(schema.modules).where(and(eq(schema.modules.organizationId, user.organizationId), eq(schema.modules.id, moduleId))).limit(1);
    if (!mod) throw new Error("Module not found");

    const wasPublished = mod.status === "published";
    const newVersion = wasPublished ? mv.version + 1 : 1;
    await tx
      .update(schema.moduleVersions)
      .set({ version: newVersion, changeType, publishedBy: user.id, publishedAt: new Date(), changelog, isDraft: false })
      .where(eq(schema.moduleVersions.id, mv.id));
    await tx.update(schema.modules).set({ status: "published", currentVersion: newVersion }).where(eq(schema.modules.id, moduleId));

    if (wasPublished && changeType === "material") {
      const certified = await tx
        .select()
        .from(schema.certifications)
        .where(and(eq(schema.certifications.organizationId, user.organizationId), eq(schema.certifications.moduleId, moduleId), eq(schema.certifications.status, "certified")));
      for (const cert of certified) {
        await logCertEvent(tx, user.organizationId, cert.id, cert.status, "needs_retraining", user.id, `Module republished as v${newVersion} (material change) — retraining required.`);
        await tx.update(schema.certifications).set({ status: "needs_retraining" }).where(eq(schema.certifications.id, cert.id));
        await createNotificationTx(tx, {
          organizationId: user.organizationId,
          userId: cert.userId,
          type: "content_changed",
          title: `${mod.title} was updated`,
          body: changelog || `Republished as v${newVersion} — this changed enough that you need to retrain.`,
          linkHref: `/learn/${moduleId}`,
        });
      }
    }
  });

  // Best-effort: the AI knowledge chat should reflect the newly published content, but a
  // reindex failure (e.g. no OPENROUTER_API_KEY configured yet) shouldn't block publishing itself.
  try {
    await reindexModule(user.organizationId, moduleId);
  } catch (err) {
    console.error(`Knowledge chat reindex failed for module ${moduleId}:`, err);
  }

  revalidatePath("/builder", "layout");
  revalidatePath("/matrix");
}

// ---------------- Learner flow ----------------

export async function startTraining(formData: FormData) {
  const moduleId = z.string().parse(formData.get("moduleId"));
  const user = await requireCurrentUser();
  await withTenantContext(user.organizationId, async (tx) => {
    const cert = await getOrCreateCert(tx, user.organizationId, user.id, moduleId);
    if (cert.status === "not_started") {
      await logCertEvent(tx, user.organizationId, cert.id, cert.status, "training", user.id, "Opened module content.");
      await tx.update(schema.certifications).set({ status: "training" }).where(eq(schema.certifications.id, cert.id));
    }
  });
  revalidatePath(`/learn/${moduleId}`);
  revalidatePath("/matrix");
}

export async function completeStep(formData: FormData) {
  const stepId = z.string().parse(formData.get("stepId"));
  const moduleId = z.string().parse(formData.get("moduleId"));
  const moduleVersionId = z.string().parse(formData.get("moduleVersionId"));
  const user = await requireCurrentUser();

  const steps = await orderedSteps(user.organizationId, moduleVersionId);

  await withTenantContext(user.organizationId, async (tx) => {
    const already = await tx
      .select({ id: schema.stepProgress.id })
      .from(schema.stepProgress)
      .where(and(eq(schema.stepProgress.organizationId, user.organizationId), eq(schema.stepProgress.userId, user.id), eq(schema.stepProgress.stepId, stepId)))
      .limit(1);
    if (already.length === 0) {
      await tx.insert(schema.stepProgress).values({ organizationId: user.organizationId, userId: user.id, stepId });
    }

    const cert = await getOrCreateCert(tx, user.organizationId, user.id, moduleId);
    const doneRows = await tx.select({ stepId: schema.stepProgress.stepId }).from(schema.stepProgress).where(and(eq(schema.stepProgress.organizationId, user.organizationId), eq(schema.stepProgress.userId, user.id)));
    const done = new Set(doneRows.map((r) => r.stepId));
    const allStepsDone = steps.length > 0 && steps.every((s) => done.has(s.id));
    if (allStepsDone && cert.status === "training") {
      await logCertEvent(tx, user.organizationId, cert.id, cert.status, "ready_for_test", user.id, "Reviewed all topics and steps.");
      await tx.update(schema.certifications).set({ status: "ready_for_test" }).where(eq(schema.certifications.id, cert.id));
    }
  });

  revalidatePath(`/learn/${moduleId}`);
  revalidatePath("/matrix");
}

const attemptSchema = z.object({ quizId: z.string(), moduleId: z.string(), moduleVersion: z.coerce.number() });

export async function submitQuizAttempt(formData: FormData) {
  const { quizId, moduleId, moduleVersion } = attemptSchema.parse({
    quizId: formData.get("quizId"),
    moduleId: formData.get("moduleId"),
    moduleVersion: formData.get("moduleVersion"),
  });
  const user = await requireCurrentUser();

  await withTenantContext(user.organizationId, async (tx) => {
    const [quiz] = await tx.select().from(schema.quizzes).where(and(eq(schema.quizzes.organizationId, user.organizationId), eq(schema.quizzes.id, quizId))).limit(1);
    if (!quiz) throw new Error("Quiz not found");
    const questions = await tx.select().from(schema.quizQuestions).where(and(eq(schema.quizQuestions.organizationId, user.organizationId), eq(schema.quizQuestions.quizId, quizId)));
    const options = await tx.select().from(schema.quizOptions).where(eq(schema.quizOptions.organizationId, user.organizationId));
    const optionsByQuestion = new Map<string, typeof options>();
    for (const o of options) {
      if (!optionsByQuestion.has(o.questionId)) optionsByQuestion.set(o.questionId, []);
      optionsByQuestion.get(o.questionId)!.push(o);
    }

    const answers: Record<string, string> = {};
    let correct = 0;
    for (const question of questions) {
      const chosen = String(formData.get(`answer_${question.id}`) ?? "");
      answers[question.id] = chosen;
      if ((optionsByQuestion.get(question.id) ?? []).find((o) => o.id === chosen)?.isCorrect) correct++;
    }
    const score = questions.length ? Math.round((correct / questions.length) * 100) : 0;
    const passed = score >= quiz.passingScore;

    await tx.insert(schema.quizAttempts).values({ organizationId: user.organizationId, userId: user.id, quizId, moduleVersion, score, passed, answers });

    const [mod] = await tx.select().from(schema.modules).where(and(eq(schema.modules.organizationId, user.organizationId), eq(schema.modules.id, moduleId))).limit(1);
    const [mv] = mod
      ? await tx.select().from(schema.moduleVersions).where(and(eq(schema.moduleVersions.organizationId, user.organizationId), eq(schema.moduleVersions.moduleId, mod.id))).limit(1)
      : [];
    const cert = await getOrCreateCert(tx, user.organizationId, user.id, moduleId);
    if (mv && (await allModuleQuizzesPassed(user.organizationId, user.id, mv.id))) {
      await logCertEvent(tx, user.organizationId, cert.id, cert.status, "tested_passed", user.id, `Passed every knowledge check (latest: ${score}%).`);
      await tx.update(schema.certifications).set({ status: "tested_passed" }).where(eq(schema.certifications.id, cert.id));
    } else if (!passed) {
      await logCertEvent(tx, user.organizationId, cert.id, cert.status, "tested_failed", user.id, `Quiz attempt scored ${score}% (passing ${quiz.passingScore}%).`);
      await tx.update(schema.certifications).set({ status: "tested_failed" }).where(eq(schema.certifications.id, cert.id));
    }
  });

  revalidatePath(`/learn/${moduleId}`);
  revalidatePath("/matrix");
  revalidatePath("/certify");
}

const signSchema = z.object({ moduleId: z.string(), signatureData: z.string().min(50) });

export async function signModuleCompletion(formData: FormData) {
  const user = await requireCurrentUser();
  const { moduleId, signatureData } = signSchema.parse({
    moduleId: formData.get("moduleId"),
    signatureData: formData.get("signatureData"),
  });
  await withTenantContext(user.organizationId, async (tx) => {
    const cert = await getOrCreateCert(tx, user.organizationId, user.id, moduleId);
    await tx.update(schema.certifications).set({ signatureData, signedAt: new Date() }).where(eq(schema.certifications.id, cert.id));
  });
  revalidatePath(`/learn/${moduleId}`);
  revalidatePath("/certify");
}

// ---------------- Evaluation & Certification ----------------

const evalSchema = z.object({
  userId: z.string(),
  moduleId: z.string(),
  scenarioId: z.string(),
  notes: z.string(),
  result: z.enum(["pass", "fail"]),
});

export async function submitPracticalEvaluation(formData: FormData) {
  const evaluator = await requireStaff();
  const parsed = evalSchema.parse({
    userId: formData.get("userId"),
    moduleId: formData.get("moduleId"),
    scenarioId: formData.get("scenarioId"),
    notes: formData.get("notes"),
    result: formData.get("result"),
  });
  const rubricScores = {} as Record<RubricKey, number>;
  for (const key of ["speed", "accuracy", "communication", "documentation", "scheduling", "escalation"] as RubricKey[]) {
    rubricScores[key] = Number(formData.get(`rubric_${key}`) ?? 0);
  }
  await withTenantContext(evaluator.organizationId, (tx) =>
    tx.insert(schema.practicalEvaluations).values({
      organizationId: evaluator.organizationId,
      userId: parsed.userId,
      scenarioId: parsed.scenarioId,
      evaluatorId: evaluator.id,
      rubricScores,
      result: parsed.result,
      notes: parsed.notes,
    })
  );
  revalidatePath("/certify");
}

const certifySchema = z.object({ userId: z.string(), moduleId: z.string(), notes: z.string() });

export async function certifyUser(formData: FormData) {
  const approver = await requireStaff();
  const { userId, moduleId, notes } = certifySchema.parse({
    userId: formData.get("userId"),
    moduleId: formData.get("moduleId"),
    notes: formData.get("notes"),
  });

  const certId = await withTenantContext(approver.organizationId, async (tx) => {
    const [mod] = await tx.select().from(schema.modules).where(and(eq(schema.modules.organizationId, approver.organizationId), eq(schema.modules.id, moduleId))).limit(1);
    if (!mod) throw new Error("Module not found");
    const cert = await getOrCreateCert(tx, approver.organizationId, userId, moduleId);
    if (!cert.signatureData) throw new Error("This person hasn't signed their completion acknowledgment yet — they need to sign it from the module page first.");
    const now = new Date();
    const expires = new Date(now);
    expires.setFullYear(expires.getFullYear() + 1);

    await logCertEvent(tx, approver.organizationId, cert.id, cert.status, "certified", approver.id, notes || "Certified after passing quiz and practical evaluation.");
    await tx
      .update(schema.certifications)
      .set({ status: "certified", moduleVersion: mod.currentVersion, certifiedBy: approver.id, certifiedAt: now, expiresAt: expires, notes })
      .where(eq(schema.certifications.id, cert.id));
    return cert.id;
  });

  revalidatePath("/certify");
  revalidatePath("/matrix");
  revalidatePath(`/cert/${certId}`);
}

// ---------------- People (admin) ----------------

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  roleId: z.string(),
  accessRole: z.enum(["admin", "editor", "learner"]),
  password: z.union([z.string().min(8), z.literal("")]).optional(),
});

export async function createUser(formData: FormData) {
  const admin = await requireAdmin();
  const { name, email, roleId, accessRole, password } = createUserSchema.parse({
    name: formData.get("name"),
    email: formData.get("email"),
    roleId: formData.get("roleId"),
    accessRole: formData.get("accessRole") || "learner",
    password: formData.get("password") || undefined,
  });

  const newUserId = await withTenantContext(admin.organizationId, async (tx) => {
    const existing = await tx
      .select({ id: schema.profiles.id })
      .from(schema.profiles)
      .where(and(eq(schema.profiles.organizationId, admin.organizationId), eq(schema.profiles.email, email.toLowerCase())))
      .limit(1);
    if (existing.length > 0) throw new Error("A person with that email already exists");

    const [created] = await tx
      .insert(schema.profiles)
      .values({
        organizationId: admin.organizationId,
        name,
        email: email.toLowerCase(),
        roleId,
        accessRole,
        employmentStatus: "active",
      })
      .returning();
    await autoAssignForRole(tx, admin.organizationId, created.id, roleId, admin.id);
    return created.id;
  });

  // Optional: give them a ready-to-use login immediately instead of making them self-register at
  // /register. Best-effort — if this fails (e.g. an auth account already exists for that email
  // from a prior self-registration attempt), the roster entry above still stands; they can
  // register themselves, or an admin can retry setting a password from their profile page.
  if (password) {
    try {
      const { data, error } = await createSupabaseAdminClient().auth.admin.createUser({ email: email.toLowerCase(), password, email_confirm: true });
      if (error) throw error;
      await withTenantContext(admin.organizationId, (tx) => tx.update(schema.profiles).set({ authUserId: data.user.id }).where(eq(schema.profiles.id, newUserId)));
    } catch (err) {
      console.error(`Failed to create login for ${email}:`, err);
    }
  }

  revalidatePath("/people");
  redirect(`/people/${newUserId}`);
}

const updateUserSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  email: z.string().email(),
  roleId: z.string(),
  accessRole: z.enum(["admin", "editor", "learner"]),
});

export async function updateUser(formData: FormData) {
  const admin = await requireAdmin();
  const { id, name, email, roleId, accessRole } = updateUserSchema.parse({
    id: formData.get("id"),
    name: formData.get("name"),
    email: formData.get("email"),
    roleId: formData.get("roleId"),
    accessRole: formData.get("accessRole") || "learner",
  });

  await withTenantContext(admin.organizationId, async (tx) => {
    const [existingUser] = await tx.select().from(schema.profiles).where(and(eq(schema.profiles.organizationId, admin.organizationId), eq(schema.profiles.id, id))).limit(1);
    if (!existingUser) throw new Error("User not found");
    const roleChanged = existingUser.roleId !== roleId;

    await tx
      .update(schema.profiles)
      .set({ name, email: email.toLowerCase(), roleId, accessRole })
      .where(eq(schema.profiles.id, id));

    if (roleChanged) await autoAssignForRole(tx, admin.organizationId, id, roleId, admin.id);
  });

  revalidatePath("/people");
  revalidatePath(`/people/${id}`);
}

export async function setUserActive(formData: FormData) {
  const admin = await requireAdmin();
  const id = z.string().parse(formData.get("id"));
  const active = formData.get("active") === "true";
  await withTenantContext(admin.organizationId, async (tx) => {
    const result = await tx
      .update(schema.profiles)
      .set({ employmentStatus: active ? "active" : "inactive" })
      .where(and(eq(schema.profiles.organizationId, admin.organizationId), eq(schema.profiles.id, id)))
      .returning({ id: schema.profiles.id });
    if (result.length === 0) throw new Error("User not found");
  });
  revalidatePath("/people");
  revalidatePath(`/people/${id}`);
}

const setPasswordSchema = z.object({ id: z.string(), password: z.string().min(8) });

export async function adminSetUserPassword(formData: FormData) {
  const admin = await requireAdmin();
  const { id, password } = setPasswordSchema.parse({ id: formData.get("id"), password: formData.get("password") });

  const [target] = await withTenantContext(admin.organizationId, (tx) =>
    tx.select({ authUserId: schema.profiles.authUserId }).from(schema.profiles).where(and(eq(schema.profiles.organizationId, admin.organizationId), eq(schema.profiles.id, id))).limit(1)
  );
  if (!target) throw new Error("User not found");
  if (!target.authUserId) throw new Error("This person hasn't registered an account yet — they need to sign up at /register first.");

  const { error } = await createSupabaseAdminClient().auth.admin.updateUserById(target.authUserId, { password });
  if (error) throw new Error(`Failed to set password: ${error.message}`);

  revalidatePath(`/people/${id}`);
}

export async function deleteUser(formData: FormData) {
  const admin = await requireAdmin();
  const id = z.string().parse(formData.get("id"));
  await withTenantContext(admin.organizationId, async (tx) => {
    // Everything else (certifications, assignments, quiz attempts, group memberships, step
    // progress, evaluations they gave, AI roleplay sessions) cascades via FK ON DELETE — see
    // src/lib/drizzle/schema.ts. Records where this person was only referenced as an approver
    // (certifiedBy, actorId, assignedBy, publishedBy) keep that history but lose the attribution
    // (ON DELETE SET NULL), rather than being deleted.
    const result = await tx.delete(schema.profiles).where(and(eq(schema.profiles.organizationId, admin.organizationId), eq(schema.profiles.id, id))).returning({ id: schema.profiles.id });
    if (result.length === 0) throw new Error("User not found");
  });
  revalidatePath("/people");
  redirect("/people");
}

// ---------------- Roles ----------------

const roleSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  parentRoleId: z.string().optional(),
});

export async function createRole(formData: FormData) {
  const admin = await requireAdmin();
  const { name, description, parentRoleId } = roleSchema.parse({
    name: formData.get("name"),
    description: formData.get("description"),
    parentRoleId: formData.get("parentRoleId") || undefined,
  });
  await withTenantContext(admin.organizationId, (tx) =>
    tx.insert(schema.roles).values({ organizationId: admin.organizationId, name, description, parentRoleId: parentRoleId ?? null })
  );
  revalidatePath("/people/roles");
}

export async function updateRole(formData: FormData) {
  const admin = await requireAdmin();
  const id = z.string().parse(formData.get("id"));
  const { name, description, parentRoleId } = roleSchema.parse({
    name: formData.get("name"),
    description: formData.get("description"),
    parentRoleId: formData.get("parentRoleId") || undefined,
  });
  if (parentRoleId === id) throw new Error("A role cannot be its own parent");
  await withTenantContext(admin.organizationId, async (tx) => {
    const result = await tx
      .update(schema.roles)
      .set({ name, description, parentRoleId: parentRoleId ?? null })
      .where(and(eq(schema.roles.organizationId, admin.organizationId), eq(schema.roles.id, id)))
      .returning({ id: schema.roles.id });
    if (result.length === 0) throw new Error("Role not found");
  });
  revalidatePath("/people/roles");
}

export async function addResponsibility(formData: FormData) {
  const admin = await requireAdmin();
  const roleId = z.string().parse(formData.get("roleId"));
  const title = z.string().min(1).parse(formData.get("title"));
  await withTenantContext(admin.organizationId, async (tx) => {
    const existing = await tx
      .select({ id: schema.responsibilities.id })
      .from(schema.responsibilities)
      .where(and(eq(schema.responsibilities.organizationId, admin.organizationId), eq(schema.responsibilities.roleId, roleId)));
    await tx.insert(schema.responsibilities).values({ organizationId: admin.organizationId, roleId, title, sortOrder: existing.length + 1 });
  });
  revalidatePath("/people/roles");
}

export async function deleteResponsibility(formData: FormData) {
  const admin = await requireAdmin();
  const id = z.string().parse(formData.get("id"));
  await withTenantContext(admin.organizationId, (tx) =>
    tx.delete(schema.responsibilities).where(and(eq(schema.responsibilities.organizationId, admin.organizationId), eq(schema.responsibilities.id, id)))
  );
  revalidatePath("/people/roles");
}

// ---------------- Groups ----------------

export async function createGroup(formData: FormData) {
  const admin = await requireAdmin();
  const name = z.string().min(1).parse(formData.get("name"));
  const description = z.string().parse(formData.get("description"));
  const [group] = await withTenantContext(admin.organizationId, (tx) =>
    tx.insert(schema.groups).values({ organizationId: admin.organizationId, name, description }).returning()
  );
  revalidatePath("/groups");
  redirect(`/groups/${group.id}`);
}

export async function addGroupMember(formData: FormData) {
  const admin = await requireAdmin();
  const groupId = z.string().parse(formData.get("groupId"));
  const userId = z.string().parse(formData.get("userId"));
  await withTenantContext(admin.organizationId, async (tx) => {
    const already = await tx
      .select({ id: schema.groupMembers.id })
      .from(schema.groupMembers)
      .where(and(eq(schema.groupMembers.organizationId, admin.organizationId), eq(schema.groupMembers.groupId, groupId), eq(schema.groupMembers.userId, userId)))
      .limit(1);
    if (already.length === 0) {
      await tx.insert(schema.groupMembers).values({ organizationId: admin.organizationId, groupId, userId });
    }
  });
  revalidatePath(`/groups/${groupId}`);
}

export async function removeGroupMember(formData: FormData) {
  const admin = await requireAdmin();
  const id = z.string().parse(formData.get("id"));
  const groupId = await withTenantContext(admin.organizationId, async (tx) => {
    const [member] = await tx.select({ groupId: schema.groupMembers.groupId }).from(schema.groupMembers).where(and(eq(schema.groupMembers.organizationId, admin.organizationId), eq(schema.groupMembers.id, id))).limit(1);
    await tx.delete(schema.groupMembers).where(and(eq(schema.groupMembers.organizationId, admin.organizationId), eq(schema.groupMembers.id, id)));
    return member?.groupId;
  });
  if (groupId) revalidatePath(`/groups/${groupId}`);
}

// ---------------- Content creation ----------------

const createModuleSchema = z.object({
  title: z.string().min(1),
  phase: z.coerce.number().default(1),
  templateKey: z.string().optional(),
});

export async function createModule(formData: FormData) {
  const user = await requireCurrentUser();
  if (!(user.accessRole === "admin" || user.accessRole === "editor")) throw new Error("Not authorized to create content");
  const { title, phase, templateKey } = createModuleSchema.parse({
    title: formData.get("title"),
    phase: formData.get("phase") || 1,
    templateKey: formData.get("templateKey") || undefined,
  });

  const moduleId = await withTenantContext(user.organizationId, async (tx) => {
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const [mod] = await tx
      .insert(schema.modules)
      .values({ organizationId: user.organizationId, title, slug, phase, ownerId: user.id, currentVersion: 0, status: "draft", estimatedMinutes: 15 })
      .returning();
    const [mv] = await tx
      .insert(schema.moduleVersions)
      .values({
        organizationId: user.organizationId,
        moduleId: mod.id,
        version: 0,
        changelog: templateKey ? `Started from the "${templateKey}" template.` : "",
        isDraft: true,
      })
      .returning();
    for (let i = 0; i < STARTER_OUTLINE.length; i++) {
      const [topic] = await tx
        .insert(schema.topics)
        .values({ organizationId: user.organizationId, moduleVersionId: mv.id, title: STARTER_OUTLINE[i], sortOrder: i + 1 })
        .returning();
      await tx.insert(schema.steps).values({ organizationId: user.organizationId, topicId: topic.id, title: "Overview", body: "", sortOrder: 1 });
    }
    return mod.id;
  });

  revalidatePath("/builder");
  redirect(`/builder/${moduleId}`);
}

const aiModuleSchema = z.object({
  title: z.string().min(1),
  estimatedMinutes: z.number().int().min(5).max(120).default(20),
  topics: z
    .array(
      z.object({
        title: z.string().min(1),
        steps: z.array(z.object({ title: z.string().min(1), body: z.string().min(1) })).min(1),
      })
    )
    .min(1),
  checklist: z.array(z.string().min(1)).min(1),
  quiz: z
    .array(
      z.object({
        prompt: z.string().min(1),
        options: z
          .array(z.object({ text: z.string().min(1), correct: z.boolean(), explanation: z.string().default("") }))
          .min(2)
          .refine((options) => options.filter((o) => o.correct).length === 1, {
            message: "Each quiz question must have exactly one correct option",
          }),
      })
    )
    .min(1),
});

const AI_MODULE_JSON_SHAPE = {
  title: "string — a short, specific module title",
  estimatedMinutes: "number — realistic minutes to complete, 5 to 60",
  topics: [
    {
      title: "string — a topic/chapter title",
      steps: [{ title: "string — a short step title", body: "string — 2-4 concrete, actionable sentences or a short bulleted list. No filler." }],
    },
  ],
  checklist: ["string — one concrete, checkable action item"],
  quiz: [
    {
      prompt: "string — a comprehension question about the content above",
      options: [{ text: "string", correct: "boolean — exactly one option per question must be true", explanation: "string — why this option is right or wrong" }],
    },
  ],
};

const generateModuleSchema = z.object({
  prompt: z.string().min(10),
  phase: z.coerce.number().default(1),
});

/**
 * Drafts a full module — topics, steps, a checklist, and a quiz — from a plain-language
 * description, via the same free OpenRouter model used by the roleplay/knowledge-chat features.
 * Always lands as an unpublished draft: AI output still needs a human review pass before it's
 * something the team is actually certified against, same as a hand-written draft.
 */
export async function generateModuleFromPrompt(formData: FormData) {
  const user = await requireStaff();
  if (!process.env.OPENROUTER_API_KEY) throw new Error("The AI module generator isn't set up yet — ask an admin to add an OpenRouter API key.");
  const { prompt, phase } = generateModuleSchema.parse({
    prompt: formData.get("prompt"),
    phase: formData.get("phase") || 1,
  });

  const system = `You are an instructional designer writing internal training content for Dream Team Roofing, a residential roofing company. Write real, specific, actionable content grounded in how a roofing company actually operates — never generic filler ("communicate effectively", "be professional") without concrete detail on how. Keep it tight: 2 to 3 topics, each with 1 to 2 steps. Include a checklist of 4 to 6 concrete action items, and a quiz of 2 to 3 questions (2 to 3 options each, exactly one correct, with a short explanation per option) that actually tests comprehension of the content — not trivia.`;

  // Free-tier models occasionally return truncated JSON or drift from the requested shape — a
  // couple of retries meaningfully improves reliability without punishing the user for it.
  let parsed: z.infer<typeof aiModuleSchema> | undefined;
  let lastError: unknown;
  for (let attempt = 0; attempt < 3 && !parsed; attempt++) {
    try {
      const generated = await callModelForJson<unknown>({
        system,
        prompt: `Write a training module about: ${prompt}`,
        schema: AI_MODULE_JSON_SHAPE,
        maxTokens: 6000,
      });
      parsed = aiModuleSchema.parse(generated);
    } catch (err) {
      lastError = err;
    }
  }
  if (!parsed) throw new Error(`The AI couldn't generate a valid module that time — try again, or rephrase the description. (${lastError instanceof Error ? lastError.message : "unknown error"})`);

  const moduleId = await withTenantContext(user.organizationId, async (tx) => {
    const slug = parsed.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const [mod] = await tx
      .insert(schema.modules)
      .values({
        organizationId: user.organizationId,
        title: parsed.title,
        slug,
        phase,
        ownerId: user.id,
        currentVersion: 0,
        status: "draft",
        estimatedMinutes: parsed.estimatedMinutes,
      })
      .returning();
    const [mv] = await tx
      .insert(schema.moduleVersions)
      .values({
        organizationId: user.organizationId,
        moduleId: mod.id,
        version: 0,
        changelog: `Drafted by AI from: "${prompt}"`,
        isDraft: true,
      })
      .returning();

    // Batched as multi-row inserts (one round trip per table, not per row) — this environment's
    // Supabase pooler round-trip latency made the naive one-row-at-a-time version take minutes
    // for a full module. A single INSERT ... VALUES (...), (...) RETURNING id reliably preserves
    // row order in Postgres, which is what lets each batch line back up with its parent below.
    const topicRows = await tx
      .insert(schema.topics)
      .values(parsed.topics.map((t, i) => ({ organizationId: user.organizationId, moduleVersionId: mv.id, title: t.title, sortOrder: i + 1 })))
      .returning();

    const stepValues = parsed.topics.flatMap((t, ti) =>
      t.steps.map((s, si) => ({ organizationId: user.organizationId, topicId: topicRows[ti].id, title: s.title, body: s.body, sortOrder: si + 1 }))
    );
    if (stepValues.length > 0) await tx.insert(schema.steps).values(stepValues);

    await tx
      .insert(schema.checklistItems)
      .values(parsed.checklist.map((text, i) => ({ organizationId: user.organizationId, moduleVersionId: mv.id, text, sortOrder: i + 1, isRequired: true })));

    const [quiz] = await tx.insert(schema.quizzes).values({ organizationId: user.organizationId, topicId: topicRows[0].id, passingScore: 80 }).returning();
    const questionRows = await tx
      .insert(schema.quizQuestions)
      .values(parsed.quiz.map((q, i) => ({ organizationId: user.organizationId, quizId: quiz.id, prompt: q.prompt, sortOrder: i + 1 })))
      .returning();

    const optionValues = parsed.quiz.flatMap((q, qi) =>
      q.options.map((opt) => ({ organizationId: user.organizationId, questionId: questionRows[qi].id, text: opt.text, isCorrect: opt.correct, explanation: opt.explanation }))
    );
    if (optionValues.length > 0) await tx.insert(schema.quizOptions).values(optionValues);

    return mod.id;
  });

  revalidatePath("/builder");
  redirect(`/builder/${moduleId}`);
}

// ---------------- Content Blocks ----------------

export async function addContentBlock(formData: FormData) {
  const user = await requireStaff();
  const stepId = z.string().parse(formData.get("stepId"));
  const moduleId = z.string().parse(formData.get("moduleId"));
  const type = z.enum(["text", "callout", "video", "audio", "file", "checklist"]).parse(formData.get("type"));
  const title = String(formData.get("title") || "").trim();
  const body = String(formData.get("body") || "").trim();
  const mediaUrl = String(formData.get("mediaUrl") || "").trim();
  const calloutType = (formData.get("calloutType") as "tip" | "warning" | "rule" | "script") || "tip";
  const fileSize = String(formData.get("fileSize") || "").trim();
  const fileFormat = String(formData.get("fileFormat") || "").trim();

  await withTenantContext(user.organizationId, async (tx) => {
    const existing = await tx.select({ id: schema.contentBlocks.id }).from(schema.contentBlocks).where(and(eq(schema.contentBlocks.organizationId, user.organizationId), eq(schema.contentBlocks.stepId, stepId)));
    await tx.insert(schema.contentBlocks).values({
      organizationId: user.organizationId,
      stepId,
      type,
      sortOrder: existing.length + 1,
      title: title || null,
      body: body || null,
      mediaUrl: mediaUrl || null,
      calloutType: type === "callout" ? calloutType : null,
      fileSize: fileSize || null,
      fileFormat: fileFormat || null,
    });
  });

  revalidatePath(`/builder/${moduleId}`);
}

export async function updateContentBlock(formData: FormData) {
  const user = await requireStaff();
  const id = z.string().parse(formData.get("id"));
  const moduleId = z.string().parse(formData.get("moduleId"));
  const title = String(formData.get("title") || "").trim();
  const body = String(formData.get("body") || "").trim();
  const mediaUrl = String(formData.get("mediaUrl") || "").trim();
  const calloutType = (formData.get("calloutType") as "tip" | "warning" | "rule" | "script") || undefined;
  const fileSize = String(formData.get("fileSize") || "").trim();
  const fileFormat = String(formData.get("fileFormat") || "").trim();

  await withTenantContext(user.organizationId, async (tx) => {
    const result = await tx
      .update(schema.contentBlocks)
      .set({
        title: title || null,
        body: body || null,
        mediaUrl: mediaUrl || null,
        ...(calloutType ? { calloutType } : {}),
        fileSize: fileSize || null,
        fileFormat: fileFormat || null,
      })
      .where(and(eq(schema.contentBlocks.organizationId, user.organizationId), eq(schema.contentBlocks.id, id)))
      .returning({ id: schema.contentBlocks.id });
    if (result.length === 0) throw new Error("Block not found");
  });

  revalidatePath(`/builder/${moduleId}`);
}

export async function deleteContentBlock(formData: FormData) {
  const user = await requireStaff();
  const id = z.string().parse(formData.get("id"));
  const moduleId = z.string().parse(formData.get("moduleId"));
  await withTenantContext(user.organizationId, (tx) =>
    tx.delete(schema.contentBlocks).where(and(eq(schema.contentBlocks.organizationId, user.organizationId), eq(schema.contentBlocks.id, id)))
  );
  revalidatePath(`/builder/${moduleId}`);
}

// ---------------- AI Roleplay Scenarios (Builder) ----------------

export async function createAiScenario(formData: FormData) {
  const user = await requireStaff();
  const moduleVersionId = z.string().parse(formData.get("moduleVersionId"));
  const moduleId = z.string().parse(formData.get("moduleId"));
  const title = z.string().min(1).parse(formData.get("title"));
  const description = String(formData.get("description") || "").trim();
  const customerPersona = z.string().min(1).parse(formData.get("customerPersona"));
  const systemPrompt = z.string().min(1).parse(formData.get("systemPrompt"));
  const rubricPrompt = String(formData.get("rubricPrompt") || "").trim();
  const initialMessage = z.string().min(1).parse(formData.get("initialMessage"));
  const maxTurns = Number(formData.get("maxTurns") || 5);
  const passingScore = Number(formData.get("passingScore") || 80);
  const topicId = String(formData.get("topicId") || "") || null;

  await withTenantContext(user.organizationId, (tx) =>
    tx.insert(schema.aiRoleplayScenarios).values({
      organizationId: user.organizationId,
      moduleVersionId,
      topicId,
      title,
      description,
      customerPersona,
      systemPrompt,
      rubricPrompt,
      initialMessage,
      maxTurns,
      passingScore,
    })
  );

  revalidatePath(`/builder/${moduleId}`);
}

export async function deleteAiScenario(formData: FormData) {
  const user = await requireStaff();
  const id = z.string().parse(formData.get("id"));
  const moduleId = z.string().parse(formData.get("moduleId"));
  await withTenantContext(user.organizationId, (tx) =>
    tx.delete(schema.aiRoleplayScenarios).where(and(eq(schema.aiRoleplayScenarios.organizationId, user.organizationId), eq(schema.aiRoleplayScenarios.id, id)))
  );
  revalidatePath(`/builder/${moduleId}`);
}

// ---------------- AI Roleplay Turn Execution (Learner) ----------------

export async function submitRoleplayTurnAction(params: { scenarioId: string; history: AiRoleplayMessage[]; userMessage: string }) {
  const user = await requireCurrentUser();
  const [scenario] = await withTenantContext(user.organizationId, (tx) =>
    tx.select().from(schema.aiRoleplayScenarios).where(and(eq(schema.aiRoleplayScenarios.organizationId, user.organizationId), eq(schema.aiRoleplayScenarios.id, params.scenarioId))).limit(1)
  );
  if (!scenario) throw new Error("Scenario not found");

  return processRoleplayTurn(scenario, params.history, params.userMessage);
}

export async function saveRoleplaySessionAction(params: {
  scenarioId: string;
  messages: AiRoleplayMessage[];
  score?: number;
  passed?: boolean;
  feedback?: { summary: string; strengths: string[]; improvements: string[]; scriptAdherence: string };
}) {
  const user = await requireCurrentUser();
  const [session] = await withTenantContext(user.organizationId, (tx) =>
    tx
      .insert(schema.aiRoleplaySessions)
      .values({
        organizationId: user.organizationId,
        userId: user.id,
        scenarioId: params.scenarioId,
        messages: params.messages,
        status: "completed",
        score: params.score,
        passed: params.passed,
        feedback: params.feedback,
        completedAt: new Date(),
      })
      .returning()
  );

  return { sessionId: session.id, success: true };
}

// ---------------- AI Knowledge Chat ----------------

export async function askKnowledgeBaseAction(question: string) {
  const user = await requireCurrentUser();
  return answerFromKnowledgeBase(user.organizationId, question);
}

// ---------------- Notifications ----------------

export async function markNotificationRead(formData: FormData) {
  const user = await requireCurrentUser();
  const id = z.string().parse(formData.get("id"));
  await withTenantContext(user.organizationId, (tx) =>
    tx
      .update(schema.notifications)
      .set({ readAt: new Date() })
      .where(and(eq(schema.notifications.organizationId, user.organizationId), eq(schema.notifications.userId, user.id), eq(schema.notifications.id, id)))
  );
  revalidatePath("/", "layout");
}

export async function markAllNotificationsRead() {
  const user = await requireCurrentUser();
  await withTenantContext(user.organizationId, (tx) =>
    tx
      .update(schema.notifications)
      .set({ readAt: new Date() })
      .where(and(eq(schema.notifications.organizationId, user.organizationId), eq(schema.notifications.userId, user.id), isNull(schema.notifications.readAt)))
  );
  revalidatePath("/", "layout");
}

// ---------------- Content Feedback ----------------

const addCommentSchema = z.object({ stepId: z.string(), body: z.string().min(1) });

export async function addStepComment(formData: FormData) {
  const user = await requireCurrentUser();
  const { stepId, body } = addCommentSchema.parse({ stepId: formData.get("stepId"), body: formData.get("body") });

  const moduleId = await withTenantContext(user.organizationId, async (tx) => {
    const [step] = await tx.select().from(schema.steps).where(and(eq(schema.steps.organizationId, user.organizationId), eq(schema.steps.id, stepId))).limit(1);
    if (!step) throw new Error("Step not found");
    const [topic] = await tx.select().from(schema.topics).where(and(eq(schema.topics.organizationId, user.organizationId), eq(schema.topics.id, step.topicId))).limit(1);
    const [mv] = await tx.select().from(schema.moduleVersions).where(and(eq(schema.moduleVersions.organizationId, user.organizationId), eq(schema.moduleVersions.id, topic.moduleVersionId))).limit(1);
    const [mod] = await tx.select().from(schema.modules).where(and(eq(schema.modules.organizationId, user.organizationId), eq(schema.modules.id, mv.moduleId))).limit(1);

    await tx.insert(schema.contentComments).values({ organizationId: user.organizationId, stepId, moduleId: mod.id, authorId: user.id, body });

    if (mod.ownerId !== user.id) {
      await createNotificationTx(tx, {
        organizationId: user.organizationId,
        userId: mod.ownerId,
        type: "content_feedback",
        title: `${user.name} flagged something in ${mod.title}`,
        body: `On "${step.title}": ${body}`,
        linkHref: `/builder/${mod.id}`,
      });
    }

    return mod.id;
  });

  revalidatePath(`/learn/${moduleId}`);
  revalidatePath(`/builder/${moduleId}`);
}

export async function resolveStepComment(formData: FormData) {
  const user = await requireStaff();
  const id = z.string().parse(formData.get("id"));
  const moduleId = z.string().parse(formData.get("moduleId"));
  await withTenantContext(user.organizationId, (tx) =>
    tx
      .update(schema.contentComments)
      .set({ resolved: true, resolvedBy: user.id, resolvedAt: new Date() })
      .where(and(eq(schema.contentComments.organizationId, user.organizationId), eq(schema.contentComments.id, id)))
  );
  revalidatePath(`/builder/${moduleId}`);
}
