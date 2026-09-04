"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb, newId, persist } from "./db";
import { getCurrentUser, setCurrentUserCookie } from "./session";
import type { CertStatus } from "./constants";
import type { RubricKey } from "./constants";
import { STARTER_OUTLINE } from "./constants";
import { moduleCompleteness, allModuleQuizzesPassed, orderedSteps, topicsForModuleVersion } from "./derive";

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

async function requireStaff() {
  const user = await getCurrentUser();
  if (!(user.isAdmin || user.isManager)) throw new Error("Not authorized to edit content");
  return user;
}

export async function createTopic(formData: FormData) {
  await requireStaff();
  const moduleVersionId = z.string().parse(formData.get("moduleVersionId"));
  const moduleId = z.string().parse(formData.get("moduleId"));
  const title = z.string().min(1).parse(formData.get("title"));
  const d = db();
  const existing = topicsForModuleVersion(moduleVersionId);
  d.topics.push({ id: newId("topic"), moduleVersionId, title, sortOrder: existing.length + 1 });
  persist();
  revalidatePath(`/builder/${moduleId}`);
}

export async function updateTopicTitle(formData: FormData) {
  await requireStaff();
  const id = z.string().parse(formData.get("id"));
  const moduleId = z.string().parse(formData.get("moduleId"));
  const title = z.string().min(1).parse(formData.get("title"));
  const d = db();
  const topic = d.topics.find((t) => t.id === id);
  if (!topic) throw new Error("Topic not found");
  topic.title = title;
  persist();
  revalidatePath(`/builder/${moduleId}`);
}

export async function deleteTopic(formData: FormData) {
  await requireStaff();
  const id = z.string().parse(formData.get("id"));
  const moduleId = z.string().parse(formData.get("moduleId"));
  const d = db();
  const stepIds = new Set(d.steps.filter((s) => s.topicId === id).map((s) => s.id));
  const quizIds = new Set(d.quizzes.filter((q) => q.topicId === id).map((q) => q.id));
  d.steps = d.steps.filter((s) => s.topicId !== id);
  d.stepEmbeds = d.stepEmbeds.filter((e) => !stepIds.has(e.stepId));
  d.stepProgress = d.stepProgress.filter((p) => !stepIds.has(p.stepId));
  d.quizQuestions = d.quizQuestions.filter((q) => !quizIds.has(q.quizId));
  d.quizzes = d.quizzes.filter((q) => q.topicId !== id);
  d.topics = d.topics.filter((t) => t.id !== id);
  persist();
  revalidatePath(`/builder/${moduleId}`);
}

export async function createStep(formData: FormData) {
  await requireStaff();
  const topicId = z.string().parse(formData.get("topicId"));
  const moduleId = z.string().parse(formData.get("moduleId"));
  const title = z.string().min(1).parse(formData.get("title"));
  const d = db();
  const existing = d.steps.filter((s) => s.topicId === topicId);
  d.steps.push({ id: newId("step"), topicId, title, body: "", sortOrder: existing.length + 1 });
  persist();
  revalidatePath(`/builder/${moduleId}`);
}

export async function updateStep(formData: FormData) {
  await requireStaff();
  const id = z.string().parse(formData.get("id"));
  const moduleId = z.string().parse(formData.get("moduleId"));
  const title = z.string().min(1).parse(formData.get("title"));
  const body = z.string().parse(formData.get("body"));
  const d = db();
  const step = d.steps.find((s) => s.id === id);
  if (!step) throw new Error("Step not found");
  step.title = title;
  step.body = body;
  persist();
  revalidatePath(`/builder/${moduleId}`);
}

export async function deleteStep(formData: FormData) {
  await requireStaff();
  const id = z.string().parse(formData.get("id"));
  const moduleId = z.string().parse(formData.get("moduleId"));
  const d = db();
  d.stepEmbeds = d.stepEmbeds.filter((e) => e.stepId !== id);
  d.stepProgress = d.stepProgress.filter((p) => p.stepId !== id);
  d.steps = d.steps.filter((s) => s.id !== id);
  persist();
  revalidatePath(`/builder/${moduleId}`);
}

export async function addStepEmbed(formData: FormData) {
  await requireStaff();
  const stepId = z.string().parse(formData.get("stepId"));
  const moduleId = z.string().parse(formData.get("moduleId"));
  const kind = z.enum(["video", "image", "link"]).parse(formData.get("kind"));
  const url = z.string().url().parse(formData.get("url"));
  const label = z.string().parse(formData.get("label"));
  db().stepEmbeds.push({ id: newId("embed"), stepId, kind, url, label: label || url });
  persist();
  revalidatePath(`/builder/${moduleId}`);
}

export async function deleteStepEmbed(formData: FormData) {
  await requireStaff();
  const id = z.string().parse(formData.get("id"));
  const moduleId = z.string().parse(formData.get("moduleId"));
  const d = db();
  d.stepEmbeds = d.stepEmbeds.filter((e) => e.id !== id);
  persist();
  revalidatePath(`/builder/${moduleId}`);
}

export async function addScript(formData: FormData) {
  await requireStaff();
  const moduleVersionId = z.string().parse(formData.get("moduleVersionId"));
  const type = z.string().parse(formData.get("type")) as never;
  const body = z.string().parse(formData.get("body"));
  db().scripts.push({ id: newId("scr"), moduleVersionId, type, body });
  persist();
  revalidatePath("/builder", "layout");
}

export async function deleteScript(formData: FormData) {
  await requireStaff();
  const id = z.string().parse(formData.get("id"));
  const d = db();
  d.scripts = d.scripts.filter((s) => s.id !== id);
  persist();
  revalidatePath("/builder", "layout");
}

export async function addChecklistItem(formData: FormData) {
  await requireStaff();
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
  await requireStaff();
  const id = z.string().parse(formData.get("id"));
  const d = db();
  d.checklistItems = d.checklistItems.filter((c) => c.id !== id);
  persist();
  revalidatePath("/builder", "layout");
}

function getOrCreateQuiz(topicId: string) {
  const d = db();
  let quiz = d.quizzes.find((q) => q.topicId === topicId);
  if (!quiz) {
    quiz = { id: newId("quiz"), topicId, passingScore: 90 };
    d.quizzes.push(quiz);
  }
  return quiz;
}

export async function addQuizQuestion(formData: FormData) {
  await requireStaff();
  const topicId = z.string().parse(formData.get("topicId"));
  const moduleId = z.string().parse(formData.get("moduleId"));
  const prompt = z.string().min(1).parse(formData.get("prompt"));
  const correctIndex = Number(formData.get("correctIndex"));
  const optionTexts = [0, 1, 2, 3].map((i) => String(formData.get(`option${i}`) ?? "").trim()).filter(Boolean);
  if (optionTexts.length < 2) throw new Error("Need at least 2 options");

  const quiz = getOrCreateQuiz(topicId);
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
  revalidatePath(`/builder/${moduleId}`);
}

export async function deleteQuizQuestion(formData: FormData) {
  await requireStaff();
  const id = z.string().parse(formData.get("id"));
  const moduleId = z.string().parse(formData.get("moduleId"));
  const d = db();
  d.quizQuestions = d.quizQuestions.filter((q) => q.id !== id);
  persist();
  revalidatePath(`/builder/${moduleId}`);
}

export async function updateScenario(formData: FormData) {
  await requireStaff();
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
  await requireStaff();
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

export async function completeStep(formData: FormData) {
  const stepId = z.string().parse(formData.get("stepId"));
  const moduleId = z.string().parse(formData.get("moduleId"));
  const moduleVersionId = z.string().parse(formData.get("moduleVersionId"));
  const user = await getCurrentUser();
  const d = db();
  if (!d.stepProgress.some((p) => p.userId === user.id && p.stepId === stepId)) {
    d.stepProgress.push({ id: newId("progress"), userId: user.id, stepId, completedAt: new Date().toISOString() });
  }
  const cert = getOrCreateCert(user.id, moduleId);
  const steps = orderedSteps(moduleVersionId);
  const done = new Set(d.stepProgress.filter((p) => p.userId === user.id).map((p) => p.stepId));
  const allStepsDone = steps.length > 0 && steps.every((s) => done.has(s.id));
  if (allStepsDone && cert.status === "training") {
    logCertEvent(cert.id, cert.status, "ready_for_test", user.id, "Reviewed all topics and steps.");
    cert.status = "ready_for_test";
  }
  persist();
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

  const mod = d.modules.find((m) => m.id === moduleId);
  const mv = mod ? d.moduleVersions.find((v) => v.moduleId === mod.id) : undefined;
  const cert = getOrCreateCert(user.id, moduleId);
  if (mv && allModuleQuizzesPassed(user.id, mv.id)) {
    logCertEvent(cert.id, cert.status, "tested_passed", user.id, `Passed every knowledge check (latest: ${score}%).`);
    cert.status = "tested_passed";
  } else if (!passed) {
    logCertEvent(cert.id, cert.status, "tested_failed", user.id, `Quiz attempt scored ${score}% (passing ${quiz.passingScore}%).`);
    cert.status = "tested_failed";
  }
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
  await requireStaff();
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
  await requireStaff();
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

// ---------------- People (admin) ----------------

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user.isAdmin) throw new Error("Admin access required");
  return user;
}

function autoAssignForRole(userId: string, roleId: string, assignedBy: string) {
  const d = db();
  const requirements = d.roleModuleRequirements.filter((r) => r.roleId === roleId && r.isRequired);
  for (const req of requirements) {
    const already = d.assignments.some((a) => a.userId === userId && a.moduleId === req.moduleId);
    if (!already) {
      d.assignments.push({
        id: newId("asn"),
        userId,
        moduleId: req.moduleId,
        assignedBy,
        assignedAt: new Date().toISOString(),
        dueAt: null,
        source: "auto",
      });
    }
  }
}

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  roleId: z.string(),
});

export async function createUser(formData: FormData) {
  const admin = await requireAdmin();
  const { name, email, roleId } = createUserSchema.parse({
    name: formData.get("name"),
    email: formData.get("email"),
    roleId: formData.get("roleId"),
  });
  const d = db();
  if (d.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
    throw new Error("A person with that email already exists");
  }
  const id = newId("u");
  d.users.push({
    id,
    name,
    email,
    roleId,
    isAdmin: formData.get("isAdmin") === "on",
    isManager: formData.get("isManager") === "on",
    employmentStatus: "active",
    hiredAt: new Date().toISOString(),
  });
  autoAssignForRole(id, roleId, admin.id);
  persist();
  revalidatePath("/people");
  redirect(`/people/${id}`);
}

const updateUserSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  email: z.string().email(),
  roleId: z.string(),
});

export async function updateUser(formData: FormData) {
  const admin = await requireAdmin();
  const { id, name, email, roleId } = updateUserSchema.parse({
    id: formData.get("id"),
    name: formData.get("name"),
    email: formData.get("email"),
    roleId: formData.get("roleId"),
  });
  const d = db();
  const user = d.users.find((u) => u.id === id);
  if (!user) throw new Error("User not found");
  const roleChanged = user.roleId !== roleId;
  user.name = name;
  user.email = email;
  user.roleId = roleId;
  user.isAdmin = formData.get("isAdmin") === "on";
  user.isManager = formData.get("isManager") === "on";
  if (roleChanged) autoAssignForRole(id, roleId, admin.id);
  persist();
  revalidatePath("/people");
  revalidatePath(`/people/${id}`);
}

export async function setUserActive(formData: FormData) {
  await requireAdmin();
  const id = z.string().parse(formData.get("id"));
  const active = formData.get("active") === "true";
  const d = db();
  const user = d.users.find((u) => u.id === id);
  if (!user) throw new Error("User not found");
  user.employmentStatus = active ? "active" : "inactive";
  persist();
  revalidatePath("/people");
  revalidatePath(`/people/${id}`);
}

export async function deleteUser(formData: FormData) {
  await requireAdmin();
  const id = z.string().parse(formData.get("id"));
  const d = db();
  const user = d.users.find((u) => u.id === id);
  if (!user) throw new Error("User not found");

  const certIds = new Set(d.certifications.filter((c) => c.userId === id).map((c) => c.id));
  d.certificationEvents = d.certificationEvents.filter((e) => !certIds.has(e.certificationId));
  d.certifications = d.certifications.filter((c) => c.userId !== id);
  d.assignments = d.assignments.filter((a) => a.userId !== id);
  d.quizAttempts = d.quizAttempts.filter((a) => a.userId !== id);
  d.practicalEvaluations = d.practicalEvaluations.filter((e) => e.userId !== id && e.evaluatorId !== id);
  d.stepProgress = d.stepProgress.filter((p) => p.userId !== id);
  d.groupMembers = d.groupMembers.filter((m) => m.userId !== id);
  d.users = d.users.filter((u) => u.id !== id);
  persist();
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
  await requireAdmin();
  const { name, description, parentRoleId } = roleSchema.parse({
    name: formData.get("name"),
    description: formData.get("description"),
    parentRoleId: formData.get("parentRoleId") || undefined,
  });
  const d = db();
  d.roles.push({ id: newId("role"), name, description, parentRoleId: parentRoleId ?? null });
  persist();
  revalidatePath("/people/roles");
}

export async function updateRole(formData: FormData) {
  await requireAdmin();
  const id = z.string().parse(formData.get("id"));
  const { name, description, parentRoleId } = roleSchema.parse({
    name: formData.get("name"),
    description: formData.get("description"),
    parentRoleId: formData.get("parentRoleId") || undefined,
  });
  if (parentRoleId === id) throw new Error("A role cannot be its own parent");
  const d = db();
  const role = d.roles.find((r) => r.id === id);
  if (!role) throw new Error("Role not found");
  role.name = name;
  role.description = description;
  role.parentRoleId = parentRoleId ?? null;
  persist();
  revalidatePath("/people/roles");
}

export async function addResponsibility(formData: FormData) {
  await requireAdmin();
  const roleId = z.string().parse(formData.get("roleId"));
  const title = z.string().min(1).parse(formData.get("title"));
  const d = db();
  const existing = d.responsibilities.filter((r) => r.roleId === roleId);
  d.responsibilities.push({ id: newId("resp"), roleId, title, sortOrder: existing.length + 1 });
  persist();
  revalidatePath("/people/roles");
}

export async function deleteResponsibility(formData: FormData) {
  await requireAdmin();
  const id = z.string().parse(formData.get("id"));
  const d = db();
  d.responsibilities = d.responsibilities.filter((r) => r.id !== id);
  persist();
  revalidatePath("/people/roles");
}

// ---------------- Groups ----------------

export async function createGroup(formData: FormData) {
  await requireAdmin();
  const name = z.string().min(1).parse(formData.get("name"));
  const description = z.string().parse(formData.get("description"));
  const d = db();
  const id = newId("group");
  d.groups.push({ id, name, description });
  persist();
  revalidatePath("/groups");
  redirect(`/groups/${id}`);
}

export async function addGroupMember(formData: FormData) {
  await requireAdmin();
  const groupId = z.string().parse(formData.get("groupId"));
  const userId = z.string().parse(formData.get("userId"));
  const d = db();
  const already = d.groupMembers.some((m) => m.groupId === groupId && m.userId === userId);
  if (!already) {
    d.groupMembers.push({ id: newId("gm"), groupId, userId });
    persist();
  }
  revalidatePath(`/groups/${groupId}`);
}

export async function removeGroupMember(formData: FormData) {
  await requireAdmin();
  const id = z.string().parse(formData.get("id"));
  const d = db();
  const member = d.groupMembers.find((m) => m.id === id);
  d.groupMembers = d.groupMembers.filter((m) => m.id !== id);
  persist();
  if (member) revalidatePath(`/groups/${member.groupId}`);
}

// ---------------- Content creation ----------------

const createModuleSchema = z.object({
  title: z.string().min(1),
  phase: z.coerce.number().default(1),
  templateKey: z.string().optional(),
});

export async function createModule(formData: FormData) {
  const user = await getCurrentUser();
  if (!(user.isAdmin || user.isManager)) throw new Error("Not authorized to create content");
  const { title, phase, templateKey } = createModuleSchema.parse({
    title: formData.get("title"),
    phase: formData.get("phase") || 1,
    templateKey: formData.get("templateKey") || undefined,
  });
  const d = db();
  const moduleId = newId("mod");
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  d.modules.push({
    id: moduleId,
    title,
    slug,
    phase,
    ownerId: user.id,
    currentVersion: 0,
    status: "draft",
    estimatedMinutes: 15,
    createdAt: new Date().toISOString(),
  });
  const moduleVersionId = newId("mv");
  d.moduleVersions.push({
    id: moduleVersionId,
    moduleId,
    version: 0,
    changeType: null,
    publishedBy: null,
    publishedAt: null,
    changelog: templateKey ? `Started from the "${templateKey}" template.` : "",
    isDraft: true,
  });
  for (const topicTitle of STARTER_OUTLINE) {
    const topicId = newId("topic");
    d.topics.push({ id: topicId, moduleVersionId, title: topicTitle, sortOrder: d.topics.filter((t) => t.moduleVersionId === moduleVersionId).length + 1 });
    d.steps.push({ id: newId("step"), topicId, title: "Overview", body: "", sortOrder: 1 });
  }
  persist();
  revalidatePath("/builder");
  redirect(`/builder/${moduleId}`);
}
