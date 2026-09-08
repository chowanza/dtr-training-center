import { sql } from "drizzle-orm";
import {
  pgTable,
  pgSchema,
  pgEnum,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";

/**
 * Every table in this schema (except `organizations` itself and the `auth`-schema stub) carries
 * an `organizationId` column, even child rows like `steps` or `quizOptions`. This is the
 * standard denormalized-tenant-id pattern for RLS-based multi-tenant Postgres: it lets every
 * table use the same simple policy — `USING (organization_id = current_org_id())` — instead of
 * walking a chain of foreign keys to figure out which org a row belongs to. See
 * src/lib/drizzle/client.ts for how `organizationId` gets set per request (withTenantContext)
 * and the accompanying SQL migration for the matching RLS policies.
 */

// ---------------- Supabase-managed auth schema (external reference only) ----------------
const authSchema = pgSchema("auth");
export const authUsers = authSchema.table("users", {
  id: uuid("id").primaryKey(),
});

// ---------------- Enums ----------------
export const employmentStatusEnum = pgEnum("employment_status", ["active", "inactive"]);
export const moduleStatusEnum = pgEnum("module_status", ["draft", "published", "archived"]);
export const changeTypeEnum = pgEnum("change_type", ["material", "cosmetic"]);
export const embedKindEnum = pgEnum("embed_kind", ["video", "image", "link"]);
export const scriptTypeEnum = pgEnum("script_type", [
  "phone",
  "text",
  "voicemail",
  "confirmation",
  "dont_know",
  "escalation",
]);
export const certStatusEnum = pgEnum("cert_status", [
  "not_started",
  "training",
  "ready_for_test",
  "tested_failed",
  "tested_passed",
  "certified",
  "needs_retraining",
  "expired",
]);
export const scenarioKindEnum = pgEnum("scenario_kind", ["simulated", "live"]);
export const evalResultEnum = pgEnum("eval_result", ["pass", "fail"]);
export const assignmentSourceEnum = pgEnum("assignment_source", ["auto", "manual", "retraining"]);
export const contentBlockTypeEnum = pgEnum("content_block_type", [
  "text",
  "callout",
  "video",
  "audio",
  "file",
  "checklist",
]);
export const calloutTypeEnum = pgEnum("callout_type", ["tip", "warning", "rule", "script"]);
export const roleplaySessionStatusEnum = pgEnum("roleplay_session_status", ["in_progress", "completed"]);
export const roleplaySenderEnum = pgEnum("roleplay_sender", ["ai_customer", "user_agent"]);
export const knowledgeSourceTypeEnum = pgEnum("knowledge_source_type", ["step", "script", "checklist_item"]);
// What a person can DO in the app — distinct from `roles` above, which is their job/org-chart
// position and drives which training modules are required for them. admin: full access, incl.
// people/role management and certifying others. editor: can author and publish content, cannot
// manage people/roles or certify. learner: can only consume training assigned to them.
export const accessRoleEnum = pgEnum("access_role", ["admin", "editor", "learner"]);

const id = () => uuid("id").primaryKey().defaultRandom();
const orgId = () => uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" });
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

// ---------------- Tenancy ----------------

export const organizations = pgTable("organizations", {
  id: id(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: createdAt(),
});

// ---------------- People & roles (Cluster 1) ----------------

export const roles = pgTable("roles", {
  id: id(),
  organizationId: orgId(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  // Self-reference; no .references() to avoid a circular init — enforced via the RLS/migration SQL instead.
  parentRoleId: uuid("parent_role_id"),
});

export const profiles = pgTable("profiles", {
  id: id(),
  // Nullable + unique: set by the handle_new_user() trigger once this person actually logs in.
  // A profile can exist (roster entry, assigned modules) before anyone has signed in as them.
  authUserId: uuid("auth_user_id").unique().references(() => authUsers.id, { onDelete: "set null" }),
  organizationId: orgId(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  roleId: uuid("role_id").notNull().references(() => roles.id),
  accessRole: accessRoleEnum("access_role").notNull().default("learner"),
  employmentStatus: employmentStatusEnum("employment_status").notNull().default("active"),
  hiredAt: timestamp("hired_at", { withTimezone: true }).notNull().defaultNow(),
});

export const groups = pgTable("groups", {
  id: id(),
  organizationId: orgId(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
});

export const groupMembers = pgTable("group_members", {
  id: id(),
  organizationId: orgId(),
  groupId: uuid("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
});

export const responsibilities = pgTable("responsibilities", {
  id: id(),
  organizationId: orgId(),
  roleId: uuid("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  sortOrder: integer("sort_order").notNull().default(1),
});

export const roleModuleRequirements = pgTable("role_module_requirements", {
  id: id(),
  organizationId: orgId(),
  roleId: uuid("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
  moduleId: uuid("module_id").notNull().references(() => modules.id, { onDelete: "cascade" }),
  isRequired: boolean("is_required").notNull().default(true),
  sequence: integer("sequence").notNull().default(1),
  recertMonths: integer("recert_months"),
});

// ---------------- Content (Cluster 2) ----------------

export const modules = pgTable("modules", {
  id: id(),
  organizationId: orgId(),
  title: text("title").notNull(),
  slug: text("slug").notNull(),
  phase: integer("phase").notNull().default(1),
  ownerId: uuid("owner_id").notNull().references(() => profiles.id),
  currentVersion: integer("current_version").notNull().default(0),
  status: moduleStatusEnum("status").notNull().default("draft"),
  estimatedMinutes: integer("estimated_minutes").notNull().default(15),
  createdAt: createdAt(),
});

export const moduleVersions = pgTable("module_versions", {
  id: id(),
  organizationId: orgId(),
  moduleId: uuid("module_id").notNull().references(() => modules.id, { onDelete: "cascade" }),
  version: integer("version").notNull().default(0),
  changeType: changeTypeEnum("change_type"),
  publishedBy: uuid("published_by").references(() => profiles.id, { onDelete: "set null" }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  changelog: text("changelog").notNull().default(""),
  isDraft: boolean("is_draft").notNull().default(true),
});

export const topics = pgTable("topics", {
  id: id(),
  organizationId: orgId(),
  moduleVersionId: uuid("module_version_id").notNull().references(() => moduleVersions.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  sortOrder: integer("sort_order").notNull().default(1),
});

export const steps = pgTable("steps", {
  id: id(),
  organizationId: orgId(),
  topicId: uuid("topic_id").notNull().references(() => topics.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(1),
});

export const stepEmbeds = pgTable("step_embeds", {
  id: id(),
  organizationId: orgId(),
  stepId: uuid("step_id").notNull().references(() => steps.id, { onDelete: "cascade" }),
  kind: embedKindEnum("kind").notNull(),
  url: text("url").notNull(),
  label: text("label").notNull().default(""),
});

export const stepProgress = pgTable("step_progress", {
  id: id(),
  organizationId: orgId(),
  userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  stepId: uuid("step_id").notNull().references(() => steps.id, { onDelete: "cascade" }),
  completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const scripts = pgTable("scripts", {
  id: id(),
  organizationId: orgId(),
  moduleVersionId: uuid("module_version_id").notNull().references(() => moduleVersions.id, { onDelete: "cascade" }),
  type: scriptTypeEnum("type").notNull(),
  body: text("body").notNull(),
});

export const checklistItems = pgTable("checklist_items", {
  id: id(),
  organizationId: orgId(),
  moduleVersionId: uuid("module_version_id").notNull().references(() => moduleVersions.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  sortOrder: integer("sort_order").notNull().default(1),
  isRequired: boolean("is_required").notNull().default(true),
});

// ---------------- Rich content blocks ----------------

export const contentBlocks = pgTable("content_blocks", {
  id: id(),
  organizationId: orgId(),
  stepId: uuid("step_id").notNull().references(() => steps.id, { onDelete: "cascade" }),
  type: contentBlockTypeEnum("type").notNull(),
  sortOrder: integer("sort_order").notNull().default(1),
  title: text("title"),
  body: text("body"),
  calloutType: calloutTypeEnum("callout_type"),
  mediaUrl: text("media_url"),
  fileSize: text("file_size"),
  fileFormat: text("file_format"),
  // [{ id, text, defaultChecked? }] — small, page-local checklist inside a block.
  checklistItems: jsonb("checklist_items").$type<{ id: string; text: string; defaultChecked?: boolean }[]>(),
});

// ---------------- Assessment & certification (Cluster 3) ----------------

export const quizzes = pgTable("quizzes", {
  id: id(),
  organizationId: orgId(),
  topicId: uuid("topic_id").notNull().references(() => topics.id, { onDelete: "cascade" }),
  passingScore: integer("passing_score").notNull().default(90),
});

export const quizQuestions = pgTable("quiz_questions", {
  id: id(),
  organizationId: orgId(),
  quizId: uuid("quiz_id").notNull().references(() => quizzes.id, { onDelete: "cascade" }),
  prompt: text("prompt").notNull(),
  sortOrder: integer("sort_order").notNull().default(1),
});

// Normalized out of the nested `options: []` shape the JSON store used — Postgres wants rows,
// not embedded arrays of objects, for anything that needs its own foreign keys.
export const quizOptions = pgTable("quiz_options", {
  id: id(),
  organizationId: orgId(),
  questionId: uuid("question_id").notNull().references(() => quizQuestions.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  isCorrect: boolean("is_correct").notNull().default(false),
  explanation: text("explanation").notNull().default(""),
});

export const quizAttempts = pgTable("quiz_attempts", {
  id: id(),
  organizationId: orgId(),
  userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  quizId: uuid("quiz_id").notNull().references(() => quizzes.id, { onDelete: "cascade" }),
  moduleVersion: integer("module_version").notNull(),
  score: integer("score").notNull(),
  passed: boolean("passed").notNull(),
  // { [questionId]: optionId }
  answers: jsonb("answers").$type<Record<string, string>>().notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
});

export const practicalScenarios = pgTable("practical_scenarios", {
  id: id(),
  organizationId: orgId(),
  moduleVersionId: uuid("module_version_id").notNull().references(() => moduleVersions.id, { onDelete: "cascade" }),
  prompt: text("prompt").notNull(),
  kind: scenarioKindEnum("kind").notNull().default("simulated"),
});

export const practicalEvaluations = pgTable("practical_evaluations", {
  id: id(),
  organizationId: orgId(),
  userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  scenarioId: uuid("scenario_id").notNull().references(() => practicalScenarios.id, { onDelete: "cascade" }),
  // Cascades (not set-null): deleting the evaluator deletes evaluations they performed, matching
  // the app's original delete-user behavior of dropping that person's evaluation records outright.
  evaluatorId: uuid("evaluator_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  // { speed, accuracy, communication, documentation, scheduling, escalation } -> 1-5
  rubricScores: jsonb("rubric_scores").$type<Record<string, number>>().notNull(),
  result: evalResultEnum("result").notNull(),
  notes: text("notes").notNull().default(""),
  evaluatedAt: timestamp("evaluated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const certifications = pgTable("certifications", {
  id: id(),
  organizationId: orgId(),
  userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  moduleId: uuid("module_id").notNull().references(() => modules.id, { onDelete: "cascade" }),
  status: certStatusEnum("status").notNull().default("not_started"),
  moduleVersion: integer("module_version"),
  certifiedBy: uuid("certified_by").references(() => profiles.id, { onDelete: "set null" }),
  certifiedAt: timestamp("certified_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  notes: text("notes").notNull().default(""),
});

// Append-only by convention (enforced in the query layer, not the DB): never UPDATE a row here,
// only INSERT — certifications.status is the derived current state.
export const certificationEvents = pgTable("certification_events", {
  id: id(),
  organizationId: orgId(),
  certificationId: uuid("certification_id").notNull().references(() => certifications.id, { onDelete: "cascade" }),
  fromStatus: certStatusEnum("from_status"),
  toStatus: certStatusEnum("to_status").notNull(),
  // Nullable + set-null: the audit event itself stays (append-only), but loses the specific
  // actor's identity if that profile is later deleted.
  actorId: uuid("actor_id").references(() => profiles.id, { onDelete: "set null" }),
  reason: text("reason").notNull().default(""),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
});

export const assignments = pgTable("assignments", {
  id: id(),
  organizationId: orgId(),
  userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  moduleId: uuid("module_id").notNull().references(() => modules.id, { onDelete: "cascade" }),
  assignedBy: uuid("assigned_by").references(() => profiles.id, { onDelete: "set null" }),
  assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
  dueAt: timestamp("due_at", { withTimezone: true }),
  source: assignmentSourceEnum("source").notNull().default("manual"),
});

// ---------------- AI roleplay ----------------

export const aiRoleplayScenarios = pgTable("ai_roleplay_scenarios", {
  id: id(),
  organizationId: orgId(),
  moduleVersionId: uuid("module_version_id").notNull().references(() => moduleVersions.id, { onDelete: "cascade" }),
  topicId: uuid("topic_id").references(() => topics.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  customerPersona: text("customer_persona").notNull(),
  systemPrompt: text("system_prompt").notNull(),
  rubricPrompt: text("rubric_prompt").notNull().default(""),
  initialMessage: text("initial_message").notNull(),
  maxTurns: integer("max_turns").notNull().default(5),
  passingScore: integer("passing_score").notNull().default(80),
});

export const aiRoleplaySessions = pgTable("ai_roleplay_sessions", {
  id: id(),
  organizationId: orgId(),
  userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  scenarioId: uuid("scenario_id").notNull().references(() => aiRoleplayScenarios.id, { onDelete: "cascade" }),
  messages: jsonb("messages").$type<{ sender: "ai_customer" | "user_agent"; text: string; timestamp: string }[]>().notNull(),
  status: roleplaySessionStatusEnum("status").notNull().default("in_progress"),
  score: integer("score"),
  passed: boolean("passed"),
  feedback: jsonb("feedback").$type<{
    summary: string;
    strengths: string[];
    improvements: string[];
    scriptAdherence: string;
  }>(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

// ---------------- AI knowledge chat ----------------

export const knowledgeChunks = pgTable("knowledge_chunks", {
  id: id(),
  organizationId: orgId(),
  sourceType: knowledgeSourceTypeEnum("source_type").notNull(),
  sourceId: uuid("source_id").notNull(),
  moduleId: uuid("module_id").notNull().references(() => modules.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Referenced by the RLS migration to keep the "current org" session variable typed consistently.
export const currentOrgIdExpr = sql`current_setting('app.current_org_id', true)::uuid`;
