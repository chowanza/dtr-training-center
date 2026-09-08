import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "./drizzle/client";
import { modules, moduleVersions, topics, steps, scripts, checklistItems, knowledgeChunks } from "./drizzle/schema";
import { SCRIPT_TYPES } from "./constants";

/**
 * Re-indexes a module's PUBLISHED content into knowledge_chunks for the AI knowledge chat.
 * Called from publishModule (src/lib/actions.ts) right after a successful publish — never
 * indexes drafts, since an employee shouldn't be able to ask the AI about unreviewed content.
 * Always replaces the module's prior chunks outright, so a republish (even cosmetic) keeps the
 * chat's answers in sync with whatever is live.
 */
export async function reindexModule(orgId: string, moduleId: string) {
  const [mod] = await db.select().from(modules).where(and(eq(modules.organizationId, orgId), eq(modules.id, moduleId))).limit(1);
  if (!mod) return;

  await db.delete(knowledgeChunks).where(and(eq(knowledgeChunks.organizationId, orgId), eq(knowledgeChunks.moduleId, moduleId)));
  if (mod.status !== "published") return;

  const [mv] = await db
    .select({ id: moduleVersions.id })
    .from(moduleVersions)
    .where(and(eq(moduleVersions.organizationId, orgId), eq(moduleVersions.moduleId, moduleId)))
    .limit(1);
  if (!mv) return;

  const topicRows = await db.select().from(topics).where(and(eq(topics.organizationId, orgId), eq(topics.moduleVersionId, mv.id))).orderBy(topics.sortOrder);
  const topicIds = topicRows.map((t) => t.id);
  const topicTitleById = new Map(topicRows.map((t) => [t.id, t.title]));

  const stepRows = topicIds.length
    ? await db.select().from(steps).where(and(eq(steps.organizationId, orgId), inArray(steps.topicId, topicIds)))
    : [];
  const scriptRows = await db.select().from(scripts).where(and(eq(scripts.organizationId, orgId), eq(scripts.moduleVersionId, mv.id)));
  const checklistRows = await db.select().from(checklistItems).where(and(eq(checklistItems.organizationId, orgId), eq(checklistItems.moduleVersionId, mv.id)));

  type Chunk = { sourceType: "step" | "script" | "checklist_item"; sourceId: string; content: string };
  const chunks: Chunk[] = [];

  for (const s of stepRows) {
    if (!s.body.trim()) continue;
    const topicTitle = topicTitleById.get(s.topicId) ?? "";
    chunks.push({ sourceType: "step", sourceId: s.id, content: `${mod.title} — ${topicTitle} — ${s.title}\n${s.body}` });
  }
  for (const s of scriptRows) {
    const label = SCRIPT_TYPES.find((t) => t.key === s.type)?.label ?? s.type;
    chunks.push({ sourceType: "script", sourceId: s.id, content: `${mod.title} — ${label} script\n${s.body}` });
  }
  for (const c of checklistRows) {
    chunks.push({ sourceType: "checklist_item", sourceId: c.id, content: `${mod.title} — checklist item\n${c.text}` });
  }

  if (chunks.length > 0) {
    await db.insert(knowledgeChunks).values(
      chunks.map((chunk) => ({
        organizationId: orgId,
        sourceType: chunk.sourceType,
        sourceId: chunk.sourceId,
        moduleId,
        content: chunk.content,
      }))
    );
  }
}
