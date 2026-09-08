-- Dropping "embedding" auto-drops idx_knowledge_chunks_embedding (the HNSW index was built
-- directly on that column). Switching the AI knowledge chat from pgvector semantic search to
-- Postgres full-text search, since Claude (replacing Gemini) has no embeddings API.
ALTER TABLE "knowledge_chunks" DROP COLUMN "embedding";
--> statement-breakpoint
CREATE INDEX idx_knowledge_chunks_content_fts ON knowledge_chunks
  USING gin (to_tsvector('english', content));