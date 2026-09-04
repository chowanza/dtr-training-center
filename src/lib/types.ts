import type { CertStatus, RubricKey, ScriptType, SopSectionKey } from "./constants";

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

export interface SopSection {
  id: string;
  moduleVersionId: string;
  sectionKey: SopSectionKey;
  body: string;
}

export interface Script {
  id: string;
  moduleVersionId: string;
  type: ScriptType;
  body: string;
}

export interface Video {
  id: string;
  moduleVersionId: string;
  title: string;
  url: string;
  durationS: number;
  sortOrder: number;
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
  moduleVersionId: string;
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
  sopSections: SopSection[];
  scripts: Script[];
  videos: Video[];
  checklistItems: ChecklistItem[];
  quizzes: Quiz[];
  quizQuestions: QuizQuestion[];
  quizAttempts: QuizAttempt[];
  practicalScenarios: PracticalScenario[];
  practicalEvaluations: PracticalEvaluation[];
  certifications: Certification[];
  certificationEvents: CertificationEvent[];
  assignments: Assignment[];
}
