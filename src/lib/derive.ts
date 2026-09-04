import { getDb } from "./db";

export function moduleCompleteness(moduleVersionId: string) {
  const d = getDb();
  const sections = d.sopSections.filter((s) => s.moduleVersionId === moduleVersionId);
  const filled = sections.filter((s) => s.body.trim().length > 0).length;
  const quiz = d.quizzes.find((q) => q.moduleVersionId === moduleVersionId);
  const questionCount = quiz ? d.quizQuestions.filter((q) => q.quizId === quiz.id).length : 0;
  const checklistCount = d.checklistItems.filter((c) => c.moduleVersionId === moduleVersionId).length;
  const sectionsComplete = sections.length > 0 && filled === sections.length;
  return {
    filled,
    total: sections.length,
    pct: sections.length ? Math.round((filled / sections.length) * 100) : 0,
    hasQuiz: questionCount > 0,
    hasChecklist: checklistCount > 0,
    publishable: sectionsComplete && questionCount > 0 && checklistCount > 0,
  };
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
