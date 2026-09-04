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
