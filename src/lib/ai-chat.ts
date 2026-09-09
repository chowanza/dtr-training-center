import "server-only";
import { sql, and, eq, inArray } from "drizzle-orm";
import { db } from "./drizzle/client";
import { modules } from "./drizzle/schema";
import { callModelForText } from "./ai-client";

export interface KnowledgeCitation {
  moduleId: string;
  moduleTitle: string;
  sourceType: string;
}

export interface KnowledgeAnswer {
  answer: string;
  citations: KnowledgeCitation[];
}

const TOP_K = 6;

interface ChunkRow {
  id: string;
  source_type: string;
  module_id: string;
  content: string;
}

/**
 * RAG over this org's PUBLISHED training content only (indexed by reindexModule at publish
 * time — see src/lib/knowledge-index.ts). Matches the question against chunks with Postgres
 * full-text search (org-scoped), then asks the model to answer strictly from those chunks —
 * grounded, with the same "say you don't know rather than guess" discipline the app trains
 * CSRs on. Full-text rather than semantic/vector search since the model has no embeddings API.
 *
 * Terms are OR'd together (not plainto_tsquery's implicit AND) and ranked by match quality —
 * a natural question rarely has every one of its words in a single short chunk, so requiring
 * all of them would return nothing for most real questions.
 */
export async function answerFromKnowledgeBase(orgId: string, question: string): Promise<KnowledgeAnswer> {
  if (!process.env.OPENROUTER_API_KEY) {
    return { answer: "The AI knowledge chat isn't set up yet — ask an admin to add an OpenRouter API key.", citations: [] };
  }

  const result = await db.execute(sql`
    WITH q AS (
      SELECT to_tsquery('english', string_agg(lexeme, ' | ')) AS tsq
      FROM unnest(tsvector_to_array(to_tsvector('english', ${question}))) AS lexeme
    )
    SELECT knowledge_chunks.id, source_type, module_id, content
    FROM knowledge_chunks, q
    WHERE organization_id = ${orgId}
      AND q.tsq IS NOT NULL
      AND to_tsvector('english', content) @@ q.tsq
    ORDER BY ts_rank(to_tsvector('english', content), q.tsq) DESC
    LIMIT ${TOP_K}
  `);
  const rows = Array.from(result) as unknown as ChunkRow[];

  if (rows.length === 0) {
    return {
      answer: "I couldn't find anything published that answers that — try rephrasing, or it might not be written down yet. Check with your manager.",
      citations: [],
    };
  }

  const moduleIds = [...new Set(rows.map((r) => r.module_id))];
  const moduleRows = await db.select().from(modules).where(and(inArray(modules.id, moduleIds), eq(modules.organizationId, orgId)));
  const moduleTitleById = new Map(moduleRows.map((m) => [m.id, m.title]));

  const context = rows.map((r, i) => `[${i + 1}] (from "${moduleTitleById.get(r.module_id) ?? "a training module"}")\n${r.content}`).join("\n\n");

  const system = `You are the internal knowledge assistant for this company's Training Center. Answer the employee's question using ONLY the context provided — never invent information, prices, or policies that aren't in it. If the context doesn't actually answer the question, say plainly that you don't know and suggest they ask their manager or check the relevant training module — the same "I don't know" discipline this company trains its staff on. Respond in English, in 2-5 sentences, conversational and direct. Don't mention "the context" or "chunks" — just answer naturally, like a knowledgeable coworker would.`;

  const prompt = `CONTEXT:\n${context}\n\nQUESTION: ${question}`;

  const answer = await callModelForText({ system, prompt, maxTokens: 512 });

  const seen = new Set<string>();
  const citations: KnowledgeCitation[] = [];
  for (const r of rows) {
    if (seen.has(r.module_id)) continue;
    seen.add(r.module_id);
    citations.push({ moduleId: r.module_id, moduleTitle: moduleTitleById.get(r.module_id) ?? "a training module", sourceType: r.source_type });
  }

  return { answer: answer || "Sorry, I couldn't generate an answer just now.", citations };
}
