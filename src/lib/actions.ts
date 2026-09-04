"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getDb, newId, persist } from "./db";
import { getCurrentUser, setCurrentUserCookie } from "./session";
import type { CertStatus } from "./constants";
import type { RubricKey } from "./constants";
import { moduleCompleteness } from "./derive";

function db() {
  return getDb();
}

function logCertEvent(certificationId: string, fromStatus: CertStatus | null, toStatus: CertStatus, actorId: string, reason: string) {
  db().certificationEvents.push({
    id: newId("certev"),
    certificationId,
    fromStatus,
    toStatus,
    actorId,
    reason,
    occurredAt: new Date().toISOString(),
  });
}

// ---------------- Session ----------------

export async function switchUser(formData: FormData) {
  const userId = z.string().parse(formData.get("userId"));
  await setCurrentUserCookie(userId);
  revalidatePath("/", "layout");
}

// ---------------- Module Builder ----------------

export async function saveAllSections(moduleId: string, formData: FormData) {
  const d = db();
  const mv = d.moduleVersions.find((v) => v.moduleId === moduleId);
  if (!mv) throw new Error("Module not found");
  const sections = d.sopSections.filter((s) => s.moduleVersionId === mv.id);
  for (const section of sections) {
    const value = formData.get(`section:${section.id}`);
    if (typeof value === "string") section.body = value;
  }
  persist();
  revalidatePath(`/builder/${moduleId}`);
  revalidatePath("/builder");
}

export async function addScript(formData: FormData) {
  const moduleVersionId = z.string().parse(formData.get("moduleVersionId"));
  const type = z.string().parse(formData.get("type")) as never;
  const body = z.string().parse(formData.get("body"));
  db().scripts.push({ id: newId("scr"), moduleVersionId, type, body });
  persist();
  revalidatePath("/builder", "layout");
}

export async function deleteScript(formData: FormData) {
  const id = z.string().parse(formData.get("id"));
  const d = db();
  d.scripts = d.scripts.filter((s) => s.id !== id);
  persist();
  revalidatePath("/builder", "layout");
}

export async function addChecklistItem(formData: FormData) {
  const moduleVersionId = z.string().parse(formData.get("moduleVersionId"));
  const text = z.string().min(1).parse(formData.get("text"));
  const d = db();
  const existing = d.checklistItems.filter((c) => c.moduleVersionId === moduleVersionId);
  d.checklistItems.push({
    id: newId("chk"),
    moduleVersionId,
    text,
    sortOrder: existing.length + 1,
    isRequired: formData.get("isRequired") === "on",
  });
  persist();
  revalidatePath("/builder", "layout");
}

export async function deleteChecklistItem(formData: FormData) {
  const id = z.string().parse(formData.get("id"));
  const d = db();
  d.checklistItems = d.checklistItems.filter((c) => c.id !== id);
  persist();
  revalidatePath("/builder", "layout");
}

function getOrCreateQuiz(moduleVersionId: string) {
  const d = db();
  let quiz = d.quizzes.find((q) => q.moduleVersionId === moduleVersionId);
  if (!quiz) {
    quiz = { id: newId("quiz"), moduleVersionId, passingScore: 90 };
    d.quizzes.push(quiz);
  }
  return quiz;
}

export async function addQuizQuestion(formData: FormData) {
  const moduleVersionId = z.string().parse(formData.get("moduleVersionId"));
  const prompt = z.string().min(1).parse(formData.get("prompt"));
  const correctIndex = Number(formData.get("correctIndex"));
  const optionTexts = [0, 1, 2, 3].map((i) => String(formData.get(`option${i}`) ?? "").trim()).filter(Boolean);
  if (optionTexts.length < 2) throw new Error("Need at least 2 options");

  const quiz = getOrCreateQuiz(moduleVersionId);
  const d = db();
  const questionId = newId("qq");
  d.quizQuestions.push({
    id: questionId,
    quizId: quiz.id,
    prompt,
    sortOrder: d.quizQuestions.filter((q) => q.quizId === quiz.id).length + 1,
    options: optionTexts.map((text, i) => ({
      id: newId("opt"),
      questionId,
      text,
      isCorrect: i === correctIndex,
      explanation: String(formData.get(`explanation${i}`) ?? ""),
    })),
  });
  persist();
  revalidatePath("/builder", "layout");
}

export async function deleteQuizQuestion(formData: FormData) {
  const id = z.string().parse(formData.get("id"));
  const d = db();
  d.quizQuestions = d.quizQuestions.filter((q) => q.id !== id);
  persist();
  revalidatePath("/builder", "layout");
}

export async function updateScenario(formData: FormData) {
  const moduleVersionId = z.string().parse(formData.get("moduleVersionId"));
  const prompt = z.string().parse(formData.get("prompt"));
  const d = db();
  let scenario = d.practicalScenarios.find((s) => s.moduleVersionId === moduleVersionId);
  if (!scenario) {
    scenario = { id: newId("scn"), moduleVersionId, prompt, kind: "simulated" };
    d.practicalScenarios.push(scenario);
  } else {
    scenario.prompt = prompt;
  }
  persist();
  revalidatePath("/builder", "layout");
}

const publishSchema = z.object({
  moduleId: z.string(),
  changeType: z.enum(["material", "cosmetic"]),
  changelog: z.string(),
});

export async function publishModule(formData: FormData) {
  const { moduleId, changeType, changelog } = publishSchema.parse({
    moduleId: formData.get("moduleId"),
    changeType: formData.get("changeType"),
    changelog: formData.get("changelog"),
  });
  const d = db();
  const user = await getCurrentUser();
  const mod = d.modules.find((m) => m.id === moduleId);
  const mv = d.moduleVersions.find((v) => v.moduleId === moduleId);
  if (!mod || !mv) throw new Error("Module not found");

  const completeness = moduleCompleteness(mv.id);
  if (!completeness.publishable) throw new Error("Module is not complete enough to publish");

  const wasPublished = mod.status === "published";
  const newVersion = wasPublished ? mv.version + 1 : 1;
  mv.version = newVersion;
  mv.changeType = changeType;
  mv.publishedBy = user.id;
  mv.publishedAt = new Date().toISOString();
  mv.changelog = changelog;
  mv.isDraft = false;
  mod.status = "published";
  mod.currentVersion = newVersion;

  if (wasPublished && changeType === "material") {
    for (const cert of d.certifications.filter((c) => c.moduleId === moduleId && c.status === "certified")) {
      logCertEvent(cert.id, cert.status, "needs_retraining", user.id, `Module republished as v${newVersion} (material change) — retraining required.`);
      cert.status = "needs_retraining";
    }
  }
  persist();
  revalidatePath("/builder", "layout");
  revalidatePath("/matrix");
}

// ---------------- Learner flow ----------------

function getOrCreateCert(userId: string, moduleId: string) {
  const d = db();
  let cert = d.certifications.find((c) => c.userId === userId && c.moduleId === moduleId);
  if (!cert) {
    cert = { id: newId("cert"), userId, moduleId, status: "not_started", moduleVersion: null, certifiedBy: null, certifiedAt: null, expiresAt: null, notes: "" };
    d.certifications.push(cert);
    logCertEvent(cert.id, null, "not_started", userId, "Assigned.");
  }
  return cert;
}

export async function startTraining(formData: FormData) {
  const moduleId = z.string().parse(formData.get("moduleId"));
  const user = await getCurrentUser();
  const cert = getOrCreateCert(user.id, moduleId);
  if (cert.status === "not_started") {
    logCertEvent(cert.id, cert.status, "training", user.id, "Opened module content.");
    cert.status = "training";
    persist();
  }
  revalidatePath(`/learn/${moduleId}`);
  revalidatePath("/matrix");
}

export async function markReadyForTest(formData: FormData) {
  const moduleId = z.string().parse(formData.get("moduleId"));
  const user = await getCurrentUser();
  const cert = getOrCreateCert(user.id, moduleId);
  if (cert.status === "training") {
    logCertEvent(cert.id, cert.status, "ready_for_test", user.id, "Reviewed all SOP content, scripts, and checklist.");
    cert.status = "ready_for_test";
    persist();
  }
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
  const d = db();
  const user = await getCurrentUser();
  const quiz = d.quizzes.find((q) => q.id === quizId);
  if (!quiz) throw new Error("Quiz not found");
  const questions = d.quizQuestions.filter((q) => q.quizId === quizId);

  const answers: Record<string, string> = {};
  let correct = 0;
  for (const question of questions) {
    const chosen = String(formData.get(`answer_${question.id}`) ?? "");
    answers[question.id] = chosen;
    if (question.options.find((o) => o.id === chosen)?.isCorrect) correct++;
  }
  const score = questions.length ? Math.round((correct / questions.length) * 100) : 0;
  const passed = score >= quiz.passingScore;

  d.quizAttempts.push({
    id: newId("attempt"),
    userId: user.id,
    quizId,
    moduleVersion,
    score,
    passed,
    answers,
    startedAt: new Date().toISOString(),
    submittedAt: new Date().toISOString(),
  });

  const cert = getOrCreateCert(user.id, moduleId);
  const toStatus: CertStatus = passed ? "tested_passed" : "tested_failed";
  logCertEvent(cert.id, cert.status, toStatus, user.id, `Quiz attempt scored ${score}% (passing ${quiz.passingScore}%).`);
  cert.status = toStatus;
  persist();
  revalidatePath(`/learn/${moduleId}`);
  revalidatePath("/matrix");
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
  const parsed = evalSchema.parse({
    userId: formData.get("userId"),
    moduleId: formData.get("moduleId"),
    scenarioId: formData.get("scenarioId"),
    notes: formData.get("notes"),
    result: formData.get("result"),
  });
  const evaluator = await getCurrentUser();
  const d = db();
  const rubricScores = {} as Record<RubricKey, number>;
  for (const key of ["speed", "accuracy", "communication", "documentation", "scheduling", "escalation"] as RubricKey[]) {
    rubricScores[key] = Number(formData.get(`rubric_${key}`) ?? 0);
  }
  d.practicalEvaluations.push({
    id: newId("eval"),
    userId: parsed.userId,
    scenarioId: parsed.scenarioId,
    evaluatorId: evaluator.id,
    rubricScores,
    result: parsed.result,
    notes: parsed.notes,
    evaluatedAt: new Date().toISOString(),
  });
  persist();
  revalidatePath("/certify");
}

const certifySchema = z.object({ userId: z.string(), moduleId: z.string(), notes: z.string() });

export async function certifyUser(formData: FormData) {
  const { userId, moduleId, notes } = certifySchema.parse({
    userId: formData.get("userId"),
    moduleId: formData.get("moduleId"),
    notes: formData.get("notes"),
  });
  const d = db();
  const approver = await getCurrentUser();
  const mod = d.modules.find((m) => m.id === moduleId);
  if (!mod) throw new Error("Module not found");
  const cert = getOrCreateCert(userId, moduleId);
  const now = new Date();
  const expires = new Date(now);
  expires.setFullYear(expires.getFullYear() + 1);

  logCertEvent(cert.id, cert.status, "certified", approver.id, notes || "Certified after passing quiz and practical evaluation.");
  cert.status = "certified";
  cert.moduleVersion = mod.currentVersion;
  cert.certifiedBy = approver.id;
  cert.certifiedAt = now.toISOString();
  cert.expiresAt = expires.toISOString();
  cert.notes = notes;
  persist();
  revalidatePath("/certify");
  revalidatePath("/matrix");
  revalidatePath(`/cert/${cert.id}`);
}
