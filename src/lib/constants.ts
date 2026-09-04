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

export const SECTION_GUIDANCE: Record<SopSectionKey, string> = {
  purpose: "Why does this process exist? What problem does it solve for the customer or the business?",
  when_to_use: "What triggers this — a phone call, a form, a specific job status? Be concrete.",
  person_responsible: "Which role owns this end to end? Name the role, not the person.",
  response_deadline: "What's the time window? \"As soon as possible\" is not a deadline.",
  information_required: "What has to be collected before this can move forward?",
  steps: "Numbered steps, in the order they actually happen. This becomes the checklist.",
  scripts: "Point to the scripts below — don't restate them here.",
  decision_rules: "The branches: if X, do Y. This is where most training gaps hide.",
  documentation: "Where does this get logged, and how fast? Undocumented work didn't happen.",
  checklist: "Point to the checklist below.",
  common_mistakes: "What does a new hire usually get wrong here? Be specific, not generic.",
  escalation: "When does this go to a manager, and how?",
  training_video: "What should the video(s) cover, and roughly how long?",
};

export const TEMPLATES = [
  {
    key: "customer-call",
    title: "Customer Call Handling",
    description: "For any process that starts with the phone ringing — leads, service calls, follow-ups.",
  },
  {
    key: "site-safety",
    title: "Job Site Safety Checklist",
    description: "Pre- and post-job safety steps for crews on site.",
  },
  {
    key: "onboarding",
    title: "New Hire Onboarding",
    description: "First day, first week — what a new hire needs to do and who they need to meet.",
  },
  {
    key: "escalation",
    title: "Complaint & Escalation Handling",
    description: "De-escalation steps and the handoff to a manager.",
  },
  {
    key: "warranty",
    title: "Warranty / Callback Handling",
    description: "What happens when a completed job gets a callback.",
  },
] as const;

export type TemplateKey = (typeof TEMPLATES)[number]["key"];

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
