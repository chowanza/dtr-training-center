import { getDb } from "./db";

export function topicsForModuleVersion(moduleVersionId: string) {
  const d = getDb();
  return d.topics.filter((t) => t.moduleVersionId === moduleVersionId).sort((a, b) => a.sortOrder - b.sortOrder);
}

export function stepsForTopic(topicId: string) {
  const d = getDb();
  return d.steps.filter((s) => s.topicId === topicId).sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Every step across every topic in a module version, in reading order. */
export function orderedSteps(moduleVersionId: string) {
  const topics = topicsForModuleVersion(moduleVersionId);
  return topics.flatMap((t) => stepsForTopic(t.id));
}

export function quizzesForModuleVersion(moduleVersionId: string) {
  const d = getDb();
  const topicIds = new Set(topicsForModuleVersion(moduleVersionId).map((t) => t.id));
  return d.quizzes.filter((q) => topicIds.has(q.topicId));
}

export function moduleCompleteness(moduleVersionId: string) {
  const d = getDb();
  const steps = orderedSteps(moduleVersionId);
  const filled = steps.filter((s) => s.body.trim().length > 0).length;
  const quizzes = quizzesForModuleVersion(moduleVersionId);
  const questionCount = quizzes.reduce((n, q) => n + d.quizQuestions.filter((qq) => qq.quizId === q.id).length, 0);
  const checklistCount = d.checklistItems.filter((c) => c.moduleVersionId === moduleVersionId).length;
  const stepsComplete = steps.length > 0 && filled === steps.length;
  return {
    filled,
    total: steps.length,
    pct: steps.length ? Math.round((filled / steps.length) * 100) : 0,
    hasQuiz: questionCount > 0,
    hasChecklist: checklistCount > 0,
    publishable: stepsComplete && questionCount > 0 && checklistCount > 0,
  };
}

/** Has this user passed every knowledge check in the module? Vacuously true if it has none. */
export function allModuleQuizzesPassed(userId: string, moduleVersionId: string) {
  const d = getDb();
  const quizzes = quizzesForModuleVersion(moduleVersionId).filter((q) => d.quizQuestions.some((qq) => qq.quizId === q.id));
  if (quizzes.length === 0) return true;
  return quizzes.every((q) => d.quizAttempts.some((a) => a.userId === userId && a.quizId === q.id && a.passed));
}

export function completedStepIds(userId: string) {
  const d = getDb();
  return new Set(d.stepProgress.filter((p) => p.userId === userId).map((p) => p.stepId));
}

export function requiredModulesForRole(roleId: string) {
  const d = getDb();
  const reqs = d.roleModuleRequirements.filter((r) => r.roleId === roleId && r.isRequired);
  return reqs
    .map((r) => d.modules.find((m) => m.id === r.moduleId))
    .filter((m): m is NonNullable<typeof m> => !!m);
}

export function completionForUser(userId: string) {
  const d = getDb();
  const user = d.users.find((u) => u.id === userId);
  if (!user) return { done: 0, total: 0, pct: 0 };
  const required = requiredModulesForRole(user.roleId);
  const done = d.certifications.filter(
    (c) => c.userId === userId && c.status === "certified" && required.some((m) => m.id === c.moduleId)
  ).length;
  const total = required.length;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

export function roleChildren(roleId: string | null) {
  const d = getDb();
  return d.roles.filter((r) => r.parentRoleId === roleId);
}

export function usersInRole(roleId: string) {
  const d = getDb();
  return d.users.filter((u) => u.roleId === roleId && u.employmentStatus === "active");
}
