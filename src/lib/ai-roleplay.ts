import { z } from "zod";
import type { AiRoleplayMessage } from "./types";
import type { aiRoleplayScenarios } from "./drizzle/schema";
import { callModelForJson } from "./ai-client";

type AiRoleplayScenario = typeof aiRoleplayScenarios.$inferSelect;

interface RoleplayTurnResult {
  customerReply: string;
  isFinished: boolean;
  score?: number;
  passed?: boolean;
  feedback?: {
    summary: string;
    strengths: string[];
    improvements: string[];
    scriptAdherence: string;
  };
}

export async function processRoleplayTurn(
  scenario: AiRoleplayScenario,
  history: AiRoleplayMessage[],
  newUserMessage: string
): Promise<RoleplayTurnResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  // `history` already includes the message the agent just sent (the caller appends it before
  // calling this), so it directly is the turn count — don't add 1 or every scenario ends one
  // turn early relative to its configured maxTurns.
  const turnCount = history.filter((m) => m.sender === "user_agent").length;
  const isFinalTurn = turnCount >= scenario.maxTurns;

  if (apiKey) {
    try {
      return await callModelRoleplay(scenario, history, newUserMessage, isFinalTurn, turnCount);
    } catch (err) {
      console.error("Failed to call the AI model, falling back to contextual engine:", err);
    }
  }

  // Realistic contextual engine — runs out-of-the-box, no API key required.
  return simulateContextualReply(scenario, history, isFinalTurn);
}

const ROLEPLAY_SCHEMA = {
  type: "object",
  description: "The in-character customer reply for this turn, and — only on the final turn — the trainee's performance evaluation.",
  properties: {
      customerReply: {
        type: "string",
        description: "Natural, conversational reply from the customer (1 to 3 sentences, first person, staying in character). If this is the last turn, wrap up how the call ends.",
      },
      isFinished: { type: "boolean" },
      feedback: {
        type: "object",
        description: "Only included on the final turn — omit entirely otherwise.",
        properties: {
          summary: { type: "string", description: "Executive summary of the agent's performance, 2 sentences." },
          score: { type: "number", description: "0-100." },
          passed: { type: "boolean" },
          strengths: { type: "array", items: { type: "string" } },
          improvements: { type: "array", items: { type: "string" } },
          scriptAdherence: { type: "string", description: "Assessment of adherence to the official scripts and the 'I don't know' rule." },
        },
        required: ["summary", "score", "passed", "strengths", "improvements", "scriptAdherence"],
      },
  },
  required: ["customerReply", "isFinished"],
};

// Runtime-validated counterpart to ROLEPLAY_SCHEMA — OpenRouter's prompt-only JSON contract gives
// no structural guarantee the way Anthropic's tool-use did, so a response missing a required field
// must throw here (not surface as `undefined` to the trainee) so the caller's try/catch falls back
// to simulateContextualReply instead of silently recording a bogus pass/fail.
const roleplayResultSchema = z.object({
  customerReply: z.string().min(1),
  isFinished: z.boolean(),
  feedback: z
    .object({
      summary: z.string(),
      score: z.number(),
      passed: z.boolean(),
      strengths: z.array(z.string()),
      improvements: z.array(z.string()),
      scriptAdherence: z.string(),
    })
    .optional(),
});

async function callModelRoleplay(
  scenario: AiRoleplayScenario,
  history: AiRoleplayMessage[],
  newUserMessage: string,
  isFinalTurn: boolean,
  turnCount: number
): Promise<RoleplayTurnResult> {
  // `history` already ends with the message the agent just sent, so exclude it from the
  // transcript and quote it separately — otherwise it appears twice in the prompt.
  const conversationHistory = history
    .slice(0, -1)
    .map((m) => `${m.sender === "ai_customer" ? "CUSTOMER" : "AGENT"}: ${m.text}`)
    .join("\n");

  const prompt = `CONVERSATION SO FAR:
${conversationHistory}
AGENT (trainee's latest reply): ${newUserMessage}

CURRENT TURN: ${turnCount} of ${scenario.maxTurns}.
Is this the last turn?: ${isFinalTurn ? "YES — include the feedback evaluation" : "NO — omit feedback"}`;

  const system = `You are voice-acting a customer in a customer-service training simulation.
CHARACTER: ${scenario.customerPersona}
CUSTOMER INSTRUCTIONS: ${scenario.systemPrompt}
COMPANY GRADING CRITERIA: ${scenario.rubricPrompt}`;

  const generated = await callModelForJson<unknown>({ system, prompt, schema: ROLEPLAY_SCHEMA, maxTokens: 1024 });
  const parsed = roleplayResultSchema.parse(generated);

  return {
    customerReply: parsed.customerReply,
    isFinished: Boolean(parsed.isFinished || isFinalTurn),
    score: parsed.feedback?.score,
    passed: parsed.feedback ? parsed.feedback.score >= scenario.passingScore : undefined,
    feedback: parsed.feedback,
  };
}

function simulateContextualReply(
  scenario: AiRoleplayScenario,
  history: AiRoleplayMessage[],
  isFinalTurn: boolean
): RoleplayTurnResult {
  const userMessages = history.filter((m) => m.sender === "user_agent");
  const userTurns = userMessages.length;
  // Signals are computed over everything the agent has said so far in the call, not just the
  // latest message — a script used in turn 1 still counts at the final-turn scorecard instead
  // of being scored as "never happened."
  const allText = userMessages.map((m) => m.text).join(" ").toLowerCase();

  const hasGreeting = allText.includes("dream team") || allText.includes("thank you for calling") || allText.includes("this is");
  const hasEmpathy = allText.includes("understand") || allText.includes("sorry") || allText.includes("apolog") || allText.includes("help you");
  const hasAddress = allText.includes("address") || allText.includes("phone number") || allText.includes("your number");
  const hasScriptDontKnow = allText.includes("don't want to guess") || allText.includes("estimator") || allText.includes("inspect") || allText.includes("on-site") || allText.includes("exact quote") || allText.includes("accurate quote");
  const guessedPrice = allText.includes("$") || allText.includes("dollars") || (allText.includes("cost") && (allText.includes("hundred") || allText.includes("thousand") || allText.includes("500")));
  const mentionsEmergency = allText.includes("emergency") || allText.includes("today") || allText.includes("right away") || allText.includes("crew");

  let customerReply = "";

  if (userTurns === 1) {
    if (guessedPrice) {
      customerReply = "You're telling me a price without even seeing my roof?! Look, I just want to know if someone can come today to stop this leak, or I'm calling another company.";
    } else if (hasEmpathy || hasGreeting) {
      customerReply = "Yes, please — I'm at 4210 Whispering Pines Dr. The water started coming in about half an hour ago. Can you send someone today?";
    } else {
      customerReply = "Look, don't waste my time. Are you coming today or not? Water is dripping right onto my furniture.";
    }
  } else if (userTurns === 2) {
    if (hasAddress || mentionsEmergency) {
      customerReply = "Okay, my phone number is 407-555-0192. But be honest with me — how much is this visit and the repair going to cost?";
    } else if (hasScriptDontKnow) {
      customerReply = "That makes sense, having the estimator look at it first. What time exactly should I expect them?";
    } else {
      customerReply = "I still don't know when you're actually coming. Do you even have a crew available today, Saturday?";
    }
  } else if (userTurns >= 3 && !isFinalTurn) {
    if (hasScriptDontKnow || mentionsEmergency) {
      customerReply = "Okay, that makes me feel a lot better knowing someone's coming out today to inspect it. Can you text me a confirmation?";
    } else {
      customerReply = "Understood. Please confirm the arrival window and the name of the person coming out.";
    }
  } else {
    customerReply = "Great, I just got the confirmation text. I'll be watching for the technician. Thank you so much for the quick help!";
  }

  let score = 65;
  const strengths: string[] = [];
  const improvements: string[] = [];

  if (hasGreeting) {
    score += 10;
    strengths.push("Professional opening using the company name.");
  } else {
    improvements.push("Remember to always use the official greeting: 'Thank you for calling Dream Team Roofing, this is [Your Name].'");
  }

  if (hasEmpathy) {
    score += 10;
    strengths.push("Empathetic handling of the customer's distress and urgency.");
  } else {
    improvements.push("Show more empathy up front ('I understand your concern, we'll get this taken care of right away').");
  }

  if (hasScriptDontKnow) {
    score += 15;
    strengths.push("Great application of the \"I don't know\" rule: didn't invent a price and pushed for the estimator visit.");
  } else if (guessedPrice) {
    score -= 20;
    improvements.push("Danger: an attempt to quote pricing over the phone was detected. Never guess a cost before the technical inspection.");
  } else {
    improvements.push("Remember to explain that the formal quote comes from the estimator on site.");
  }

  if (mentionsEmergency || hasAddress) {
    score += 10;
    strengths.push("Captured and confirmed key details (address, same-day urgency).");
  }

  score = Math.min(100, Math.max(40, score));
  const passed = score >= scenario.passingScore;

  const feedback = isFinalTurn
    ? {
        summary: passed
          ? "You showed strong command of the call, calmed the customer down, and booked the emergency to DTR standards."
          : "You completed the call, but there were significant gaps around the 'I don't know' script or capturing the emergency details.",
        score,
        passed,
        strengths: strengths.length ? strengths : ["Kept the conversation moving."],
        improvements: improvements.length ? improvements : ["Keep practicing to improve response times."],
        scriptAdherence: hasScriptDontKnow ? "Met the standard for deferring to the estimator." : "The recommended script was not used.",
      }
    : undefined;

  return {
    customerReply,
    isFinished: isFinalTurn,
    score,
    passed,
    feedback,
  };
}
