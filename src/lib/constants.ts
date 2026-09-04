/** Starter outline dropped into every new module — a head start, not a requirement. */
export const STARTER_OUTLINE = [
  "Purpose & When to Use",
  "Step-by-Step Process",
  "Decision Rules & Escalation",
  "Documentation & Common Mistakes",
] as const;

export const EMBED_KINDS = [
  { key: "video", label: "Video" },
  { key: "image", label: "Image" },
  { key: "link", label: "Link" },
] as const;

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
