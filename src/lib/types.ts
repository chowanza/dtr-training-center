import type { CertStatus, RubricKey, ScriptType } from "./constants";

export interface Role {
  id: string;
  name: string;
  description: string;
  parentRoleId: string | null;
}

export interface User {
  id: string;
  name: string;
  email: string;
  roleId: string;
  isAdmin: boolean;
  isManager: boolean;
  employmentStatus: "active" | "inactive";
  hiredAt: string;
}

export interface Group {
  id: string;
  name: string;
  description: string;
}

export interface GroupMember {
  id: string;
  groupId: string;
  userId: string;
}

export interface Responsibility {
  id: string;
  roleId: string;
  title: string;
  sortOrder: number;
}

export interface RoleModuleRequirement {
  id: string;
  roleId: string;
  moduleId: string;
  isRequired: boolean;
  sequence: number;
  recertMonths: number | null;
}

export type ModuleStatus = "draft" | "published" | "archived";

export interface Module {
  id: string;
  title: string;
  slug: string;
  phase: number;
  ownerId: string;
  currentVersion: number;
  status: ModuleStatus;
  estimatedMinutes: number;
  createdAt: string;
}

export type ChangeType = "material" | "cosmetic";

export interface ModuleVersion {
  id: string;
  moduleId: string;
  version: number;
  changeType: ChangeType | null;
  publishedBy: string | null;
  publishedAt: string | null;
  changelog: string;
  isDraft: boolean;
}

export interface Topic {
  id: string;
  moduleVersionId: string;
  title: string;
  sortOrder: number;
}

export type EmbedKind = "video" | "image" | "link";

export interface StepEmbed {
  id: string;
  stepId: string;
  kind: EmbedKind;
  url: string;
  label: string;
}

export type ContentBlockType = "text" | "callout" | "video" | "audio" | "file" | "checklist";

export interface ContentBlock {
  id: string;
  stepId: string;
  type: ContentBlockType;
  sortOrder: number;
  title?: string;
  body?: string;
  calloutType?: "tip" | "warning" | "rule" | "script";
  mediaUrl?: string;
  fileSize?: string;
  fileFormat?: string;
  checklistItems?: { id: string; text: string; defaultChecked?: boolean }[];
}

export interface AiRoleplayScenario {
  id: string;
  moduleVersionId: string;
  topicId?: string;
  title: string;
  description: string;
  customerPersona: string;
  systemPrompt: string;
  rubricPrompt: string;
  initialMessage: string;
  maxTurns: number;
  passingScore: number;
}

export interface AiRoleplayMessage {
  sender: "ai_customer" | "user_agent";
  text: string;
  timestamp: string;
}

export interface AiRoleplaySession {
  id: string;
  userId: string;
  scenarioId: string;
  messages: AiRoleplayMessage[];
  status: "in_progress" | "completed";
  score?: number;
  passed?: boolean;
  feedback?: {
    summary: string;
    strengths: string[];
    improvements: string[];
    scriptAdherence: string;
  };
  startedAt: string;
  completedAt?: string;
}

export interface Step {
  id: string;
  topicId: string;
  title: string;
  body: string;
  sortOrder: number;
}

export interface Script {
  id: string;
  moduleVersionId: string;
  type: ScriptType;
  body: string;
}

export interface ChecklistItem {
  id: string;
  moduleVersionId: string;
  text: string;
  sortOrder: number;
  isRequired: boolean;
}

export interface Quiz {
  id: string;
  topicId: string;
  passingScore: number;
}

export interface QuizOption {
  id: string;
  questionId: string;
  text: string;
  isCorrect: boolean;
  explanation: string;
}

export interface QuizQuestion {
  id: string;
  quizId: string;
  prompt: string;
  sortOrder: number;
  options: QuizOption[];
}

export interface QuizAttempt {
  id: string;
  userId: string;
  quizId: string;
  moduleVersion: number;
  score: number;
  passed: boolean;
  answers: Record<string, string>; // questionId -> optionId
  startedAt: string;
  submittedAt: string;
}

export interface StepProgress {
  id: string;
  userId: string;
  stepId: string;
  completedAt: string;
}

export interface PracticalScenario {
  id: string;
  moduleVersionId: string;
  prompt: string;
  kind: "simulated" | "live";
}

export interface PracticalEvaluation {
  id: string;
  userId: string;
  scenarioId: string;
  evaluatorId: string;
  rubricScores: Record<RubricKey, number>;
  result: "pass" | "fail";
  notes: string;
  evaluatedAt: string;
}

export interface Certification {
  id: string;
  userId: string;
  moduleId: string;
  status: CertStatus;
  moduleVersion: number | null;
  certifiedBy: string | null;
  certifiedAt: string | null;
  expiresAt: string | null;
  notes: string;
}

export interface CertificationEvent {
  id: string;
  certificationId: string;
  fromStatus: CertStatus | null;
  toStatus: CertStatus;
  actorId: string;
  reason: string;
  occurredAt: string;
}

export interface Assignment {
  id: string;
  userId: string;
  moduleId: string;
  assignedBy: string;
  assignedAt: string;
  dueAt: string | null;
  source: "auto" | "manual" | "retraining";
}

export interface Database {
  roles: Role[];
  users: User[];
  groups: Group[];
  groupMembers: GroupMember[];
  responsibilities: Responsibility[];
  roleModuleRequirements: RoleModuleRequirement[];
  modules: Module[];
  moduleVersions: ModuleVersion[];
  topics: Topic[];
  steps: Step[];
  stepEmbeds: StepEmbed[];
  stepProgress: StepProgress[];
  scripts: Script[];
  checklistItems: ChecklistItem[];
  quizzes: Quiz[];
  quizQuestions: QuizQuestion[];
  quizAttempts: QuizAttempt[];
  practicalScenarios: PracticalScenario[];
  practicalEvaluations: PracticalEvaluation[];
  certifications: Certification[];
  certificationEvents: CertificationEvent[];
  assignments: Assignment[];
  contentBlocks: ContentBlock[];
  aiRoleplayScenarios: AiRoleplayScenario[];
  aiRoleplaySessions: AiRoleplaySession[];
}
