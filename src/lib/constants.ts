export const SOP_SECTIONS = [
  { key: "purpose", label: "Purpose" },
  { key: "when_to_use", label: "When to Use" },
  { key: "person_responsible", label: "Person Responsible" },
  { key: "response_deadline", label: "Response Deadline" },
  { key: "information_required", label: "Information Required" },
  { key: "steps", label: "Steps" },
  { key: "scripts", label: "Scripts" },
  { key: "decision_rules", label: "Decision Rules" },
  { key: "documentation", label: "Documentation" },
  { key: "checklist", label: "Checklist" },
  { key: "common_mistakes", label: "Common Mistakes" },
  { key: "escalation", label: "Escalation" },
  { key: "training_video", label: "Training Video" },
] as const;

export type SopSectionKey = (typeof SOP_SECTIONS)[number]["key"];

export const SCRIPT_TYPES = [
  { key: "phone", label: "Phone" },
  { key: "text", label: "Text" },
  { key: "voicemail", label: "Voicemail" },
  { key: "confirmation", label: "Confirmation" },
  { key: "dont_know", label: "\"I Don't Know\"" },
  { key: "escalation", label: "Escalation" },
] as const;

export type ScriptType = (typeof SCRIPT_TYPES)[number]["key"];

export const CERT_STATUSES = [
  "not_started",
  "training",
  "ready_for_test",
  "tested_failed",
  "tested_passed",
  "certified",
  "needs_retraining",
  "expired",
] as const;

export type CertStatus = (typeof CERT_STATUSES)[number];

export const CERT_STATUS_LABEL: Record<CertStatus, string> = {
  not_started: "Not Started",
  training: "Training",
  ready_for_test: "Ready for Test",
  tested_failed: "Tested — Failed",
  tested_passed: "Tested — Passed",
  certified: "Certified",
  needs_retraining: "Needs Retraining",
  expired: "Certification Expired",
};

export const CERT_STATUS_PILL: Record<CertStatus, string> = {
  not_started: "p-neutral",
  training: "p-amber",
  ready_for_test: "p-indigo",
  tested_failed: "p-bad",
  tested_passed: "p-good",
  certified: "p-cert",
  needs_retraining: "p-amber",
  expired: "p-bad",
};

export const RUBRIC_DIMENSIONS = [
  { key: "speed", label: "Speed" },
  { key: "accuracy", label: "Accuracy" },
  { key: "communication", label: "Communication" },
  { key: "documentation", label: "Documentation" },
  { key: "scheduling", label: "Scheduling" },
  { key: "escalation", label: "Escalation Judgment" },
] as const;

export type RubricKey = (typeof RUBRIC_DIMENSIONS)[number]["key"];
