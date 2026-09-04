import type { Database } from "./types";

const now = () => new Date().toISOString();

export function createSeedDatabase(): Database {
  const t0 = new Date();
  t0.setDate(t0.getDate() - 10);
  const day = (n: number) => {
    const d = new Date(t0);
    d.setDate(d.getDate() + n);
    return d.toISOString();
  };

  const roleOwner = { id: "role-owner", name: "Owner", description: "Company owner.", parentRoleId: null };
  const roleOfficeManager = { id: "role-office-manager", name: "Office Manager", description: "Manages CSRs, authors training content, certifies trainees.", parentRoleId: "role-owner" };
  const roleCsr = { id: "role-csr", name: "CSR", description: "Customer Service Representative — first touch on every inbound lead.", parentRoleId: "role-office-manager" };

  const uOwen = { id: "u-owen", name: "Owen", email: "owen@dreamteamroofingfl.com", roleId: "role-owner", isAdmin: true, isManager: true, employmentStatus: "active" as const, hiredAt: day(0) };
  const uLuis = { id: "u-luis", name: "Luis", email: "luis@dreamteamroofingfl.com", roleId: "role-office-manager", isAdmin: true, isManager: true, employmentStatus: "active" as const, hiredAt: day(0) };
  const uArmando = { id: "u-armando", name: "Armando", email: "armando@dreamteamroofingfl.com", roleId: "role-csr", isAdmin: false, isManager: false, employmentStatus: "active" as const, hiredAt: day(2) };
  const uMaria = { id: "u-maria", name: "Maria Lopez", email: "maria@dreamteamroofingfl.com", roleId: "role-csr", isAdmin: false, isManager: false, employmentStatus: "active" as const, hiredAt: day(8) };

  const groups: Database["groups"] = [
    { id: "group-leadership", name: "Leadership", description: "Owner and office management." },
    { id: "group-csr", name: "CSR Team", description: "Customer service representatives." },
  ];
  const groupMembers: Database["groupMembers"] = [
    { id: "gm-1", groupId: "group-leadership", userId: uOwen.id },
    { id: "gm-2", groupId: "group-leadership", userId: uLuis.id },
    { id: "gm-3", groupId: "group-csr", userId: uArmando.id },
    { id: "gm-4", groupId: "group-csr", userId: uMaria.id },
  ];

  const responsibilities = [
    { id: "resp-1", roleId: "role-csr", title: "Answer and qualify inbound leads", sortOrder: 1 },
    { id: "resp-2", roleId: "role-csr", title: "Schedule and confirm appointments", sortOrder: 2 },
    { id: "resp-3", roleId: "role-csr", title: "Log every interaction in Workiz", sortOrder: 3 },
    { id: "resp-4", roleId: "role-csr", title: "Handle escalations and unhappy customers", sortOrder: 4 },
  ];

  // ---- Module 1: New Lead Handling — fully authored, published v1 ----
  const mod1: Database["modules"][number] = {
    id: "mod-new-lead",
    title: "New Lead Handling",
    slug: "new-lead-handling",
    phase: 1,
    ownerId: uLuis.id,
    currentVersion: 1,
    status: "published",
    estimatedMinutes: 15,
    createdAt: day(0),
  };

  const mv1: Database["moduleVersions"][number] = {
    id: "mv-new-lead-1",
    moduleId: mod1.id,
    version: 1,
    changeType: "material",
    publishedBy: uLuis.id,
    publishedAt: day(1),
    changelog: "Initial published version.",
    isDraft: false,
  };

  const topics1: Database["topics"] = [
    { id: "topic-1-a", moduleVersionId: mv1.id, title: "Purpose & When to Use", sortOrder: 1 },
    { id: "topic-1-b", moduleVersionId: mv1.id, title: "Handling the Call", sortOrder: 2 },
    { id: "topic-1-c", moduleVersionId: mv1.id, title: "Documentation & Quality", sortOrder: 3 },
    { id: "topic-1-d", moduleVersionId: mv1.id, title: "Escalation", sortOrder: 4 },
    { id: "topic-1-e", moduleVersionId: mv1.id, title: "Training Video", sortOrder: 5 },
  ];

  const steps1: Database["steps"] = [
    { id: "step-1-a1", topicId: "topic-1-a", title: "Purpose", sortOrder: 1, body: "Ensure every inbound roofing lead is captured, qualified, and scheduled within our response window so we don't lose jobs to slower competitors." },
    { id: "step-1-a2", topicId: "topic-1-a", title: "When to Use", sortOrder: 2, body: "Any time a new lead arrives — phone call, web form, Angi/HomeAdvisor, referral, or a missed-call callback." },
    { id: "step-1-b1", topicId: "topic-1-b", title: "Who's Responsible, and By When", sortOrder: 1, body: "The CSR on lead-response duty for that shift. Call or text back within 5 minutes during business hours, within 30 minutes outside business hours. Every lead gets a first-touch attempt the same day it arrives, no exceptions." },
    { id: "step-1-b2", topicId: "topic-1-b", title: "Information to Collect", sortOrder: 2, body: "Full name, callback phone number, service address, issue type (leak, storm damage, full replacement, inspection), whether insurance is involved, and preferred appointment window." },
    { id: "step-1-b3", topicId: "topic-1-b", title: "Step-by-Step", sortOrder: 3, body: "1. Answer within 3 rings using the phone greeting script.\n2. Confirm name, phone, and service address — read the address back to the customer.\n3. Ask the qualifying questions: issue type, insurance involved, urgency.\n4. Offer the earliest available appointment window that matches urgency.\n5. Confirm the appointment out loud and send the confirmation text immediately.\n6. Log the lead in Workiz before moving to the next call, tagged with source and issue type.\n\nUse the phone, text, voicemail, confirmation, and escalation scripts attached to this module — don't improvise the opening line, customers judge us in the first 10 seconds." },
    { id: "step-1-b4", topicId: "topic-1-b", title: "Decision Rules", sortOrder: 4, body: "If there is an active interior leak or safety hazard → treat as same-day emergency, escalate to dispatch immediately.\nIf insurance is involved → flag the lead \"Insurance\" in Workiz and note the carrier if known.\nIf the caller asks a pricing question you can't answer → use the \"I don't know\" script, never guess a number.\nIf the caller is upset or asks for a manager by name → use the escalation script and loop in Luis." },
    { id: "step-1-c1", topicId: "topic-1-c", title: "Documentation", sortOrder: 1, body: "Log every lead in Workiz within 2 minutes of the call ending. Tag lead source and issue type. A lead does not exist until it exists in Workiz — verbal notes and sticky notes do not count. Run the checklist attached to this module on every call." },
    { id: "step-1-c2", topicId: "topic-1-c", title: "Common Mistakes", sortOrder: 2, body: "Booking an appointment without confirming the address.\nForgetting to send the confirmation text.\nGuessing at pricing instead of using the \"I don't know\" script.\nLetting a lead sit in a notepad instead of logging it in Workiz right away." },
    { id: "step-1-d1", topicId: "topic-1-d", title: "When to Escalate", sortOrder: 1, body: "Escalate to the Office Manager (Luis) immediately if: the customer is hostile, there is an active interior leak or safety issue, or the customer explicitly asks for a manager. Use the escalation script and tag the Workiz record \"Needs Manager.\"" },
    { id: "step-1-e1", topicId: "topic-1-e", title: "Video Overview", sortOrder: 1, body: "Three-part series: (1) Answering the phone — 4 min. (2) Qualifying the lead — 6 min. (3) Booking and logging in Workiz — 5 min. Add the recordings below once they're ready." },
  ];

  const scripts1: Database["scripts"] = [
    { id: "scr-1-phone", moduleVersionId: mv1.id, type: "phone", body: "\"Thank you for calling Dream Team Roofing, this is [Name] — how can I help you today?\"" },
    { id: "scr-1-text", moduleVersionId: mv1.id, type: "text", body: "\"Hi [Name], this is Dream Team Roofing following up on your roofing request. What's the best time for us to call you back today?\"" },
    { id: "scr-1-voicemail", moduleVersionId: mv1.id, type: "voicemail", body: "\"Hi [Name], this is [CSR name] from Dream Team Roofing returning your call about [issue]. Please call us back at [number] — we'd love to get you scheduled.\"" },
    { id: "scr-1-confirm", moduleVersionId: mv1.id, type: "confirmation", body: "\"You're all set for [day] between [window] at [address]. You'll get a text reminder the day before — anything else I can help with?\"" },
    { id: "scr-1-dontknow", moduleVersionId: mv1.id, type: "dont_know", body: "\"That's a great question — I want to give you an accurate answer, so let me have our estimator confirm that when they're on site. I don't want to guess and get it wrong.\"" },
    { id: "scr-1-escalation", moduleVersionId: mv1.id, type: "escalation", body: "\"I completely understand, and I want to make sure this gets handled right. Let me get my manager on the line — can you hold for just a moment?\"" },
  ];

  const checklist1: Database["checklistItems"] = [
    { id: "chk-1-1", moduleVersionId: mv1.id, text: "Confirmed caller name and callback number", sortOrder: 1, isRequired: true },
    { id: "chk-1-2", moduleVersionId: mv1.id, text: "Read the service address back to the customer", sortOrder: 2, isRequired: true },
    { id: "chk-1-3", moduleVersionId: mv1.id, text: "Asked issue type and urgency", sortOrder: 3, isRequired: true },
    { id: "chk-1-4", moduleVersionId: mv1.id, text: "Asked whether insurance is involved", sortOrder: 4, isRequired: true },
    { id: "chk-1-5", moduleVersionId: mv1.id, text: "Offered earliest appointment window matching urgency", sortOrder: 5, isRequired: true },
    { id: "chk-1-6", moduleVersionId: mv1.id, text: "Sent confirmation text before ending the call", sortOrder: 6, isRequired: true },
    { id: "chk-1-7", moduleVersionId: mv1.id, text: "Logged the lead in Workiz with source and issue type", sortOrder: 7, isRequired: true },
    { id: "chk-1-8", moduleVersionId: mv1.id, text: "Noted any special access instructions (gate code, pets, etc.)", sortOrder: 8, isRequired: false },
  ];

  const quiz1: Database["quizzes"][number] = { id: "quiz-1", topicId: "topic-1-b", passingScore: 90 };

  const q = (id: string, prompt: string, options: { text: string; correct?: boolean; explanation: string }[], sortOrder: number): Database["quizQuestions"][number] => ({
    id,
    quizId: quiz1.id,
    prompt,
    sortOrder,
    options: options.map((o, i) => ({ id: `${id}-opt${i}`, questionId: id, text: o.text, isCorrect: !!o.correct, explanation: o.explanation })),
  });

  const quizQuestions1: Database["quizQuestions"] = [
    q("qq-1", "How fast should you attempt first contact on a new lead during business hours?", [
      { text: "Within 5 minutes", correct: true, explanation: "Correct — a 5-minute response window is the standard during business hours." },
      { text: "Within 30 minutes", explanation: "That's the after-hours window, not the business-hours one." },
      { text: "By end of day", explanation: "Too slow — leads go cold fast against faster competitors." },
      { text: "Whenever you get a chance", explanation: "There is always a defined response window — never \"whenever.\"" },
    ], 1),
    q("qq-2", "A customer describes an active interior leak. What do you do?", [
      { text: "Book the earliest normal appointment", explanation: "An active interior leak is a safety issue, not a routine booking." },
      { text: "Treat it as a same-day emergency and escalate to dispatch immediately", correct: true, explanation: "Correct — active leaks are same-day emergencies per the decision rules." },
      { text: "Tell them to call their insurance first", explanation: "That's not our first move — get them scheduled and looped in appropriately." },
      { text: "Leave a note for the next shift", explanation: "Too slow for an active safety issue." },
    ], 2),
    q("qq-3", "A caller asks how much a full roof replacement costs before anyone has seen the roof. What do you say?", [
      { text: "Give your best guess based on square footage", explanation: "Guessing at pricing is a listed common mistake — never do this." },
      { text: "Use the \"I don't know\" script and offer an estimator visit", correct: true, explanation: "Correct — never guess a number; hand it to the estimator." },
      { text: "Tell them roofing is expensive and change the subject", explanation: "Unhelpful and unprofessional." },
      { text: "Transfer the call with no explanation", explanation: "Always explain what's happening on the call before any handoff." },
    ], 3),
    q("qq-4", "When exactly does a new lead need to be logged in Workiz?", [
      { text: "At the end of the day, in a batch", explanation: "Too slow — leads must be logged right after the call." },
      { text: "Within 2 minutes of the call ending", correct: true, explanation: "Correct — a lead doesn't exist until it exists in Workiz, logged within 2 minutes." },
      { text: "Only if the customer books an appointment", explanation: "Every lead gets logged, not just booked ones." },
      { text: "Whenever there's a lull in calls", explanation: "There's a hard deadline, not a \"when convenient\" rule." },
    ], 4),
    q("qq-5", "A customer is hostile and demands to speak to a manager. What's the correct move?", [
      { text: "Tell them the manager isn't available", explanation: "Never deflect an explicit manager request." },
      { text: "Use the escalation script and loop in the Office Manager immediately", correct: true, explanation: "Correct — this is exactly the escalation trigger defined in the SOP." },
      { text: "Argue your point until they calm down", explanation: "Not your call to make — escalate per policy." },
      { text: "Hang up and let them call back later", explanation: "Never end a hostile call unresolved — escalate instead." },
    ], 5),
  ];

  const scenario1: Database["practicalScenarios"][number] = {
    id: "scenario-1",
    moduleVersionId: mv1.id,
    prompt: "An AHS customer calls, upset: the technician is running two hours late for a same-day interior leak inspection and they're threatening to cancel and call a competitor. Handle the call — de-escalate, confirm a real ETA, and document the interaction correctly.",
    kind: "simulated",
  };

  // ---- Modules 2–8: shells, unauthored ----
  const shellTitles = [
    "Scheduling & Dispatch",
    "Customer Communication Standards",
    "Insurance Claims Intake",
    "Appointment Confirmations",
    "Complaint Escalation",
    "Workiz Documentation",
    "Storm & Emergency Response",
  ];
  const shellModules: Database["modules"] = shellTitles.map((title, i) => ({
    id: `mod-shell-${i + 1}`,
    title,
    slug: title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    phase: 1,
    ownerId: uLuis.id,
    currentVersion: 0,
    status: "draft",
    estimatedMinutes: 15,
    createdAt: day(0),
  }));
  const shellVersions: Database["moduleVersions"] = shellModules.map((m, i) => ({
    id: `mv-shell-${i + 1}`,
    moduleId: m.id,
    version: 0,
    changeType: null,
    publishedBy: null,
    publishedAt: null,
    changelog: "",
    isDraft: true,
  }));
  const allModules = [mod1, ...shellModules];
  const roleModuleRequirements: Database["roleModuleRequirements"] = allModules.map((m, i) => ({
    id: `rmr-${m.id}`,
    roleId: "role-csr",
    moduleId: m.id,
    isRequired: true,
    sequence: i + 1,
    recertMonths: 12,
  }));

  // ---- Assignments: Armando + Maria assigned all 8 CSR modules ----
  const assignments: Database["assignments"] = [];
  for (const user of [uArmando, uMaria]) {
    allModules.forEach((m) => {
      assignments.push({
        id: `asn-${user.id}-${m.id}`,
        userId: user.id,
        moduleId: m.id,
        assignedBy: uLuis.id,
        assignedAt: day(2),
        dueAt: null,
        source: "auto",
      });
    });
  }

  // ---- Certifications: Armando certified on New Lead Handling; everything else not_started ----
  const certifications: Database["certifications"] = [];
  const certificationEvents: Database["certificationEvents"] = [];

  function seedCert(user: typeof uArmando, mod: Database["modules"][number], status: (typeof certifications)[number]["status"]) {
    const id = `cert-${user.id}-${mod.id}`;
    certifications.push({
      id,
      userId: user.id,
      moduleId: mod.id,
      status,
      moduleVersion: status === "certified" ? 1 : null,
      certifiedBy: status === "certified" ? uLuis.id : null,
      certifiedAt: status === "certified" ? day(5) : null,
      expiresAt: status === "certified" ? new Date(new Date(day(5)).setFullYear(new Date(day(5)).getFullYear() + 1)).toISOString() : null,
      notes: "",
    });
    certificationEvents.push({ id: `${id}-ev1`, certificationId: id, fromStatus: null, toStatus: "not_started", actorId: uLuis.id, reason: "Assigned via role requirement.", occurredAt: day(2) });
    if (status !== "not_started") {
      certificationEvents.push({ id: `${id}-ev2`, certificationId: id, fromStatus: "not_started", toStatus: "training", actorId: user.id, reason: "Started module.", occurredAt: day(3) });
    }
    return id;
  }

  for (const mod of allModules) {
    if (mod.id === mod1.id) {
      seedCert(uArmando, mod, "certified");
    } else {
      seedCert(uArmando, mod, "not_started");
    }
    seedCert(uMaria, mod, "not_started");
  }
  // Give Maria one module in progress and Armando's cert a full event trail.
  const mariaCert2 = certifications.find((c) => c.userId === uMaria.id && c.moduleId === "mod-shell-1")!;
  mariaCert2.status = "training";
  certificationEvents.push({ id: `${mariaCert2.id}-ev2`, certificationId: mariaCert2.id, fromStatus: "not_started", toStatus: "training", actorId: uMaria.id, reason: "Started module.", occurredAt: day(6) });

  const armandoCert1 = certifications.find((c) => c.userId === uArmando.id && c.moduleId === mod1.id)!;
  ["ready_for_test", "tested_passed", "certified"].forEach((status, i) => {
    certificationEvents.push({
      id: `${armandoCert1.id}-ev${3 + i}`,
      certificationId: armandoCert1.id,
      fromStatus: (i === 0 ? "training" : i === 1 ? "ready_for_test" : "tested_passed") as never,
      toStatus: status as never,
      actorId: status === "certified" ? uLuis.id : uArmando.id,
      reason: status === "certified" ? "Passed quiz and practical evaluation. Certified by Luis." : status === "tested_passed" ? "Quiz passed at 100%, practical evaluation passed." : "Training complete, ready for testing.",
      occurredAt: day(4 + i),
    });
  });

  // ---- Quiz attempt + practical evaluation for Armando on module 1 ----
  const quizAttempts: Database["quizAttempts"] = [
    {
      id: "attempt-armando-1",
      userId: uArmando.id,
      quizId: quiz1.id,
      moduleVersion: 1,
      score: 100,
      passed: true,
      answers: Object.fromEntries(quizQuestions1.map((qq) => [qq.id, qq.options.find((o) => o.isCorrect)!.id])),
      startedAt: day(4),
      submittedAt: day(4),
    },
  ];

  const practicalEvaluations: Database["practicalEvaluations"] = [
    {
      id: "eval-armando-1",
      userId: uArmando.id,
      scenarioId: scenario1.id,
      evaluatorId: uLuis.id,
      rubricScores: { speed: 4, accuracy: 5, communication: 5, documentation: 4, scheduling: 5, escalation: 4 },
      result: "pass",
      notes: "Stayed calm, gave a real ETA instead of a vague apology, and logged the callback in Workiz correctly. Slightly slow to offer a concrete alternative window — worth a quick note, not a retest.",
      evaluatedAt: day(5),
    },
  ];

  return {
    roles: [roleOwner, roleOfficeManager, roleCsr],
    users: [uOwen, uLuis, uArmando, uMaria],
    groups,
    groupMembers,
    responsibilities,
    roleModuleRequirements,
    modules: allModules,
    moduleVersions: [mv1, ...shellVersions],
    topics: topics1,
    steps: steps1,
    stepEmbeds: [],
    stepProgress: [],
    scripts: scripts1,
    checklistItems: checklist1,
    quizzes: [quiz1],
    quizQuestions: quizQuestions1,
    quizAttempts,
    practicalScenarios: [scenario1],
    practicalEvaluations,
    certifications,
    certificationEvents,
    assignments,
  };
}

export const SEED_TIMESTAMP = now();
