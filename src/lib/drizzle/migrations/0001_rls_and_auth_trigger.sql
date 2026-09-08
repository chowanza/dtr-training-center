-- Hand-written migration (not generated from schema.ts): pgvector extension, the
-- roles.parent_role_id self-reference, indexes, Row Level Security policies for every
-- tenant-scoped table, and the trigger that links a Supabase auth user to a pre-provisioned
-- profile by email. See src/lib/drizzle/client.ts (withTenantContext) for how
-- app.current_org_id gets set per request — that's what every policy below checks against.

-- ---------------- pgvector ----------------
-- Also enable this once from the Supabase dashboard (Database -> Extensions) if this statement
-- errors due to permissions on your plan; it's normally fine to run from a migration.
CREATE EXTENSION IF NOT EXISTS vector;

-- ---------------- roles self-reference ----------------
-- Left off the CREATE TABLE in 0000 to avoid a circular definition in schema.ts; added here now
-- that the table exists.
ALTER TABLE "roles" ADD CONSTRAINT "roles_parent_role_id_roles_id_fk"
  FOREIGN KEY ("parent_role_id") REFERENCES "public"."roles"("id") ON DELETE SET NULL;

-- ---------------- current_org_id() helper ----------------
CREATE OR REPLACE FUNCTION current_org_id() RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT nullif(current_setting('app.current_org_id', true), '')::uuid
$$;

-- ---------------- indexes ----------------
-- organization_id on every tenant table: every single query and every RLS policy filters on
-- this, so it's the single most important index in the whole schema.
CREATE INDEX idx_roles_org ON roles (organization_id);
CREATE INDEX idx_profiles_org ON profiles (organization_id);
CREATE INDEX idx_groups_org ON groups (organization_id);
CREATE INDEX idx_group_members_org ON group_members (organization_id);
CREATE INDEX idx_responsibilities_org ON responsibilities (organization_id);
CREATE INDEX idx_role_module_requirements_org ON role_module_requirements (organization_id);
CREATE INDEX idx_modules_org ON modules (organization_id);
CREATE INDEX idx_module_versions_org ON module_versions (organization_id);
CREATE INDEX idx_topics_org ON topics (organization_id);
CREATE INDEX idx_steps_org ON steps (organization_id);
CREATE INDEX idx_step_embeds_org ON step_embeds (organization_id);
CREATE INDEX idx_step_progress_org ON step_progress (organization_id);
CREATE INDEX idx_scripts_org ON scripts (organization_id);
CREATE INDEX idx_checklist_items_org ON checklist_items (organization_id);
CREATE INDEX idx_content_blocks_org ON content_blocks (organization_id);
CREATE INDEX idx_quizzes_org ON quizzes (organization_id);
CREATE INDEX idx_quiz_questions_org ON quiz_questions (organization_id);
CREATE INDEX idx_quiz_options_org ON quiz_options (organization_id);
CREATE INDEX idx_quiz_attempts_org ON quiz_attempts (organization_id);
CREATE INDEX idx_practical_scenarios_org ON practical_scenarios (organization_id);
CREATE INDEX idx_practical_evaluations_org ON practical_evaluations (organization_id);
CREATE INDEX idx_certifications_org ON certifications (organization_id);
CREATE INDEX idx_certification_events_org ON certification_events (organization_id);
CREATE INDEX idx_assignments_org ON assignments (organization_id);
CREATE INDEX idx_ai_roleplay_scenarios_org ON ai_roleplay_scenarios (organization_id);
CREATE INDEX idx_ai_roleplay_sessions_org ON ai_roleplay_sessions (organization_id);
CREATE INDEX idx_knowledge_chunks_org ON knowledge_chunks (organization_id);

-- Foreign-key lookup indexes for the joins derive.ts and actions.ts actually do. Postgres does
-- not auto-index foreign keys (unlike primary keys), so without these, every cascade delete and
-- every "give me all X for this Y" query is a sequential scan.
CREATE INDEX idx_profiles_role ON profiles (role_id);
CREATE INDEX idx_roles_parent ON roles (parent_role_id);
CREATE INDEX idx_group_members_group ON group_members (group_id);
CREATE INDEX idx_group_members_user ON group_members (user_id);
CREATE INDEX idx_responsibilities_role ON responsibilities (role_id);
CREATE INDEX idx_role_module_requirements_role ON role_module_requirements (role_id);
CREATE INDEX idx_role_module_requirements_module ON role_module_requirements (module_id);
CREATE INDEX idx_module_versions_module ON module_versions (module_id);
CREATE INDEX idx_topics_module_version ON topics (module_version_id);
CREATE INDEX idx_steps_topic ON steps (topic_id);
CREATE INDEX idx_step_embeds_step ON step_embeds (step_id);
CREATE INDEX idx_step_progress_user ON step_progress (user_id);
CREATE INDEX idx_step_progress_step ON step_progress (step_id);
CREATE INDEX idx_scripts_module_version ON scripts (module_version_id);
CREATE INDEX idx_checklist_items_module_version ON checklist_items (module_version_id);
CREATE INDEX idx_content_blocks_step ON content_blocks (step_id);
CREATE INDEX idx_quizzes_topic ON quizzes (topic_id);
CREATE INDEX idx_quiz_questions_quiz ON quiz_questions (quiz_id);
CREATE INDEX idx_quiz_options_question ON quiz_options (question_id);
CREATE INDEX idx_quiz_attempts_user ON quiz_attempts (user_id);
CREATE INDEX idx_quiz_attempts_quiz ON quiz_attempts (quiz_id);
CREATE INDEX idx_practical_scenarios_module_version ON practical_scenarios (module_version_id);
CREATE INDEX idx_practical_evaluations_user ON practical_evaluations (user_id);
CREATE INDEX idx_practical_evaluations_scenario ON practical_evaluations (scenario_id);
CREATE INDEX idx_certifications_user ON certifications (user_id);
CREATE INDEX idx_certifications_module ON certifications (module_id);
CREATE INDEX idx_certification_events_certification ON certification_events (certification_id);
CREATE INDEX idx_assignments_user ON assignments (user_id);
CREATE INDEX idx_assignments_module ON assignments (module_id);
CREATE INDEX idx_ai_roleplay_scenarios_module_version ON ai_roleplay_scenarios (module_version_id);
CREATE INDEX idx_ai_roleplay_sessions_user ON ai_roleplay_sessions (user_id);
CREATE INDEX idx_ai_roleplay_sessions_scenario ON ai_roleplay_sessions (scenario_id);
CREATE INDEX idx_knowledge_chunks_module ON knowledge_chunks (module_id);

-- Vector similarity search index for the AI knowledge chat (HNSW, cosine distance — matches the
-- cosine-similarity query src/lib/ai-chat.ts will run).
CREATE INDEX idx_knowledge_chunks_embedding ON knowledge_chunks
  USING hnsw (embedding vector_cosine_ops);

-- ---------------- Row Level Security ----------------
-- organizations gets its own shape (no organization_id column — it IS the org, so the policy
-- checks its own id). Every other table below follows the same pattern.
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON organizations
  USING (id = current_org_id());

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON roles
  USING (organization_id = current_org_id()) WITH CHECK (organization_id = current_org_id());

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON profiles
  USING (organization_id = current_org_id()) WITH CHECK (organization_id = current_org_id());

ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON groups
  USING (organization_id = current_org_id()) WITH CHECK (organization_id = current_org_id());

ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON group_members
  USING (organization_id = current_org_id()) WITH CHECK (organization_id = current_org_id());

ALTER TABLE responsibilities ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON responsibilities
  USING (organization_id = current_org_id()) WITH CHECK (organization_id = current_org_id());

ALTER TABLE role_module_requirements ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON role_module_requirements
  USING (organization_id = current_org_id()) WITH CHECK (organization_id = current_org_id());

ALTER TABLE modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON modules
  USING (organization_id = current_org_id()) WITH CHECK (organization_id = current_org_id());

ALTER TABLE module_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON module_versions
  USING (organization_id = current_org_id()) WITH CHECK (organization_id = current_org_id());

ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON topics
  USING (organization_id = current_org_id()) WITH CHECK (organization_id = current_org_id());

ALTER TABLE steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON steps
  USING (organization_id = current_org_id()) WITH CHECK (organization_id = current_org_id());

ALTER TABLE step_embeds ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON step_embeds
  USING (organization_id = current_org_id()) WITH CHECK (organization_id = current_org_id());

ALTER TABLE step_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON step_progress
  USING (organization_id = current_org_id()) WITH CHECK (organization_id = current_org_id());

ALTER TABLE scripts ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON scripts
  USING (organization_id = current_org_id()) WITH CHECK (organization_id = current_org_id());

ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON checklist_items
  USING (organization_id = current_org_id()) WITH CHECK (organization_id = current_org_id());

ALTER TABLE content_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON content_blocks
  USING (organization_id = current_org_id()) WITH CHECK (organization_id = current_org_id());

ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON quizzes
  USING (organization_id = current_org_id()) WITH CHECK (organization_id = current_org_id());

ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON quiz_questions
  USING (organization_id = current_org_id()) WITH CHECK (organization_id = current_org_id());

ALTER TABLE quiz_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON quiz_options
  USING (organization_id = current_org_id()) WITH CHECK (organization_id = current_org_id());

ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON quiz_attempts
  USING (organization_id = current_org_id()) WITH CHECK (organization_id = current_org_id());

ALTER TABLE practical_scenarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON practical_scenarios
  USING (organization_id = current_org_id()) WITH CHECK (organization_id = current_org_id());

ALTER TABLE practical_evaluations ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON practical_evaluations
  USING (organization_id = current_org_id()) WITH CHECK (organization_id = current_org_id());

ALTER TABLE certifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON certifications
  USING (organization_id = current_org_id()) WITH CHECK (organization_id = current_org_id());

ALTER TABLE certification_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON certification_events
  USING (organization_id = current_org_id()) WITH CHECK (organization_id = current_org_id());

ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON assignments
  USING (organization_id = current_org_id()) WITH CHECK (organization_id = current_org_id());

ALTER TABLE ai_roleplay_scenarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON ai_roleplay_scenarios
  USING (organization_id = current_org_id()) WITH CHECK (organization_id = current_org_id());

ALTER TABLE ai_roleplay_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON ai_roleplay_sessions
  USING (organization_id = current_org_id()) WITH CHECK (organization_id = current_org_id());

ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON knowledge_chunks
  USING (organization_id = current_org_id()) WITH CHECK (organization_id = current_org_id());

-- ---------------- link a Supabase auth user to a pre-provisioned profile ----------------
-- Admins create a `profiles` row (roster entry) before the person has ever logged in — see
-- the createUser action. The first time that email actually signs in via magic link, Supabase
-- inserts a row into auth.users; this trigger finds the matching pending profile (by email,
-- auth_user_id still null) and links it. An email with no matching profile is left unlinked —
-- there's no public self-signup in v1, only admin-provisioned people.
CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET auth_user_id = NEW.id
  WHERE email = NEW.email AND auth_user_id IS NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_auth_user();
