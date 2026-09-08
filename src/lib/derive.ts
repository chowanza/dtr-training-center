import { and, eq, inArray, isNull } from "drizzle-orm";
import { withTenantContext } from "./drizzle/client";
import {
  topics,
  steps,
  quizzes,
  quizQuestions,
  quizAttempts,
  contentBlocks,
  aiRoleplayScenarios,
  aiRoleplaySessions,
  checklistItems,
  roleModuleRequirements,
  modules,
  certifications,
  stepProgress,
  roles,
  profiles,
} from "./drizzle/schema";

export async function topicsForModuleVersion(orgId: string, moduleVersionId: string) {
  return withTenantContext(orgId, (tx) =>
    tx.select().from(topics).where(and(eq(topics.organizationId, orgId), eq(topics.moduleVersionId, moduleVersionId))).orderBy(topics.sortOrder)
  );
}

export async function stepsForTopic(orgId: string, topicId: string) {
  return withTenantContext(orgId, (tx) =>
    tx.select().from(steps).where(and(eq(steps.organizationId, orgId), eq(steps.topicId, topicId))).orderBy(steps.sortOrder)
  );
}

/** Every step across every topic in a module version, in reading order. */
export async function orderedSteps(orgId: string, moduleVersionId: string) {
  return withTenantContext(orgId, async (tx) => {
    const topicRows = await tx.select({ id: topics.id }).from(topics).where(and(eq(topics.organizationId, orgId), eq(topics.moduleVersionId, moduleVersionId))).orderBy(topics.sortOrder);
    const topicIds = topicRows.map((t) => t.id);
    if (topicIds.length === 0) return [];
    const stepRows = await tx.select().from(steps).where(and(eq(steps.organizationId, orgId), inArray(steps.topicId, topicIds))).orderBy(steps.sortOrder);
    const byTopic = new Map<string, typeof stepRows>();
    for (const s of stepRows) {
      if (!byTopic.has(s.topicId)) byTopic.set(s.topicId, []);
      byTopic.get(s.topicId)!.push(s);
    }
    return topicIds.flatMap((id) => byTopic.get(id) ?? []);
  });
}

export async function quizzesForModuleVersion(orgId: string, moduleVersionId: string) {
  return withTenantContext(orgId, async (tx) => {
    const topicRows = await tx.select({ id: topics.id }).from(topics).where(and(eq(topics.organizationId, orgId), eq(topics.moduleVersionId, moduleVersionId)));
    const topicIds = topicRows.map((t) => t.id);
    if (topicIds.length === 0) return [];
    return tx.select().from(quizzes).where(and(eq(quizzes.organizationId, orgId), inArray(quizzes.topicId, topicIds)));
  });
}

export async function contentBlocksForStep(orgId: string, stepId: string) {
  return withTenantContext(orgId, (tx) =>
    tx.select().from(contentBlocks).where(and(eq(contentBlocks.organizationId, orgId), eq(contentBlocks.stepId, stepId))).orderBy(contentBlocks.sortOrder)
  );
}

export async function aiScenariosForModuleVersion(orgId: string, moduleVersionId: string) {
  return withTenantContext(orgId, (tx) =>
    tx.select().from(aiRoleplayScenarios).where(and(eq(aiRoleplayScenarios.organizationId, orgId), eq(aiRoleplayScenarios.moduleVersionId, moduleVersionId)))
  );
}

export async function aiSessionForUserAndScenario(orgId: string, userId: string, scenarioId: string) {
  return withTenantContext(orgId, async (tx) => {
    const rows = await tx
      .select()
      .from(aiRoleplaySessions)
      .where(and(eq(aiRoleplaySessions.organizationId, orgId), eq(aiRoleplaySessions.userId, userId), eq(aiRoleplaySessions.scenarioId, scenarioId)))
      .limit(1);
    return rows[0];
  });
}

export async function moduleCompleteness(orgId: string, moduleVersionId: string) {
  return withTenantContext(orgId, async (tx) => {
    const topicRows = await tx.select({ id: topics.id }).from(topics).where(and(eq(topics.organizationId, orgId), eq(topics.moduleVersionId, moduleVersionId)));
    const topicIds = topicRows.map((t) => t.id);

    const stepRows = topicIds.length
      ? await tx.select().from(steps).where(and(eq(steps.organizationId, orgId), inArray(steps.topicId, topicIds)))
      : [];
    const stepIds = stepRows.map((s) => s.id);

    const blockStepIds = stepIds.length
      ? new Set(
          (await tx.select({ stepId: contentBlocks.stepId }).from(contentBlocks).where(and(eq(contentBlocks.organizationId, orgId), inArray(contentBlocks.stepId, stepIds)))).map(
            (b) => b.stepId
          )
        )
      : new Set<string>();
    const filled = stepRows.filter((s) => s.body.trim().length > 0 || blockStepIds.has(s.id)).length;

    const quizRows = topicIds.length
      ? await tx.select({ id: quizzes.id }).from(quizzes).where(and(eq(quizzes.organizationId, orgId), inArray(quizzes.topicId, topicIds)))
      : [];
    const quizIds = quizRows.map((q) => q.id);
    const questionCount = quizIds.length
      ? (await tx.select({ id: quizQuestions.id }).from(quizQuestions).where(and(eq(quizQuestions.organizationId, orgId), inArray(quizQuestions.quizId, quizIds)))).length
      : 0;

    const checklistCount = (
      await tx.select({ id: checklistItems.id }).from(checklistItems).where(and(eq(checklistItems.organizationId, orgId), eq(checklistItems.moduleVersionId, moduleVersionId)))
    ).length;

    const stepsComplete = stepRows.length > 0 && filled === stepRows.length;
    return {
      filled,
      total: stepRows.length,
      pct: stepRows.length ? Math.round((filled / stepRows.length) * 100) : 0,
      hasQuiz: questionCount > 0,
      hasChecklist: checklistCount > 0,
      publishable: stepsComplete && questionCount > 0 && checklistCount > 0,
    };
  });
}

/** Has this user passed every knowledge check in the module? Vacuously true if it has none. */
export async function allModuleQuizzesPassed(orgId: string, userId: string, moduleVersionId: string) {
  return withTenantContext(orgId, async (tx) => {
    const topicRows = await tx.select({ id: topics.id }).from(topics).where(and(eq(topics.organizationId, orgId), eq(topics.moduleVersionId, moduleVersionId)));
    const topicIds = topicRows.map((t) => t.id);
    if (topicIds.length === 0) return true;

    const quizRows = await tx.select({ id: quizzes.id }).from(quizzes).where(and(eq(quizzes.organizationId, orgId), inArray(quizzes.topicId, topicIds)));
    const quizIds = quizRows.map((q) => q.id);
    if (quizIds.length === 0) return true;

    const questionRows = await tx
      .select({ quizId: quizQuestions.quizId })
      .from(quizQuestions)
      .where(and(eq(quizQuestions.organizationId, orgId), inArray(quizQuestions.quizId, quizIds)));
    const quizIdsWithQuestions = [...new Set(questionRows.map((q) => q.quizId))];
    if (quizIdsWithQuestions.length === 0) return true;

    const passedRows = await tx
      .select({ quizId: quizAttempts.quizId })
      .from(quizAttempts)
      .where(
        and(
          eq(quizAttempts.organizationId, orgId),
          eq(quizAttempts.userId, userId),
          inArray(quizAttempts.quizId, quizIdsWithQuestions),
          eq(quizAttempts.passed, true)
        )
      );
    const passedQuizIds = new Set(passedRows.map((r) => r.quizId));
    return quizIdsWithQuestions.every((id) => passedQuizIds.has(id));
  });
}

export async function completedStepIds(orgId: string, userId: string) {
  return withTenantContext(orgId, async (tx) => {
    const rows = await tx.select({ stepId: stepProgress.stepId }).from(stepProgress).where(and(eq(stepProgress.organizationId, orgId), eq(stepProgress.userId, userId)));
    return new Set(rows.map((r) => r.stepId));
  });
}

export async function requiredModulesForRole(orgId: string, roleId: string) {
  return withTenantContext(orgId, async (tx) => {
    const reqs = await tx
      .select({ moduleId: roleModuleRequirements.moduleId })
      .from(roleModuleRequirements)
      .where(and(eq(roleModuleRequirements.organizationId, orgId), eq(roleModuleRequirements.roleId, roleId), eq(roleModuleRequirements.isRequired, true)));
    const moduleIds = reqs.map((r) => r.moduleId);
    if (moduleIds.length === 0) return [];
    return tx.select().from(modules).where(and(eq(modules.organizationId, orgId), inArray(modules.id, moduleIds)));
  });
}

export async function completionForUser(orgId: string, userId: string) {
  return withTenantContext(orgId, async (tx) => {
    const userRows = await tx.select().from(profiles).where(and(eq(profiles.organizationId, orgId), eq(profiles.id, userId))).limit(1);
    const user = userRows[0];
    if (!user) return { done: 0, total: 0, pct: 0 };

    const reqs = await tx
      .select({ moduleId: roleModuleRequirements.moduleId })
      .from(roleModuleRequirements)
      .where(and(eq(roleModuleRequirements.organizationId, orgId), eq(roleModuleRequirements.roleId, user.roleId), eq(roleModuleRequirements.isRequired, true)));
    const requiredIds = new Set(reqs.map((r) => r.moduleId));
    if (requiredIds.size === 0) return { done: 0, total: 0, pct: 0 };

    const certRows = await tx
      .select({ moduleId: certifications.moduleId })
      .from(certifications)
      .where(and(eq(certifications.organizationId, orgId), eq(certifications.userId, userId), eq(certifications.status, "certified")));
    const done = certRows.filter((c) => requiredIds.has(c.moduleId)).length;
    const total = requiredIds.size;
    return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
  });
}

export async function roleChildren(orgId: string, roleId: string | null) {
  return withTenantContext(orgId, (tx) =>
    tx
      .select()
      .from(roles)
      .where(and(eq(roles.organizationId, orgId), roleId === null ? isNull(roles.parentRoleId) : eq(roles.parentRoleId, roleId)))
  );
}

export async function usersInRole(orgId: string, roleId: string) {
  return withTenantContext(orgId, (tx) =>
    tx
      .select()
      .from(profiles)
      .where(and(eq(profiles.organizationId, orgId), eq(profiles.roleId, roleId), eq(profiles.employmentStatus, "active")))
  );
}
