import "server-only";

// OpenRouter exposes an OpenAI-compatible /chat/completions endpoint in front of many providers,
// including several free models — used instead of calling Anthropic directly so the AI roleplay
// simulator and knowledge chat can run on a free API key. Model is overridable via env because
// OpenRouter's free lineup rotates — check https://openrouter.ai/models?max_price=0 if this one
// disappears (confirmed working 2026-09: clean JSON output, doesn't burn its token budget on
// hidden reasoning tokens the way most other current free models do).
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "nex-agi/nex-n2.5-pro:free";

function apiKey() {
  return process.env.OPENROUTER_API_KEY;
}

async function chatCompletion(params: { system: string; prompt: string; maxTokens: number; jsonMode: boolean }) {
  const key = apiKey();
  if (!key) throw new Error("OPENROUTER_API_KEY is not set");

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "https://dreamteamroofingfl.com",
      "X-Title": "DTR Training Center",
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      max_tokens: params.maxTokens,
      messages: [
        { role: "system", content: params.system },
        { role: "user", content: params.prompt },
      ],
      ...(params.jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!response.ok) throw new Error(`OpenRouter API error: ${response.status} ${response.statusText} — ${await response.text()}`);

  const data = await response.json();
  const choice = data.choices?.[0];
  const text: string | undefined = choice?.message?.content;
  if (!text) throw new Error("OpenRouter response had no message content");
  return { text, truncated: choice?.finish_reason === "length" };
}

/**
 * Extracts the first balanced {...} object from free-form text — a fallback for models that wrap
 * JSON in markdown fences or add a stray sentence before/after it despite being asked not to.
 */
function extractJsonObject(text: string): string {
  const start = text.indexOf("{");
  if (start === -1) throw new Error(`No JSON object found in model response: ${text.slice(0, 200)}`);
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  throw new Error(`Unbalanced JSON object in model response: ${text.slice(0, 200)}`);
}

/** Thrown when the model's response was cut off (finish_reason: "length") before valid JSON could
 * be recovered from it — distinct from a malformed/schema-drifted-but-complete response, so a
 * caller retrying can react by raising maxTokens instead of just repeating the identical request. */
export class TruncatedResponseError extends Error {}

/**
 * Requests a single JSON object matching `schema` (a JSON-schema-shaped object, embedded in the
 * prompt as an instruction — not passed as a native "tool", since free OpenRouter models have
 * inconsistent function-calling support). Works across effectively any chat model.
 */
export async function callModelForJson<T>(params: { system: string; prompt: string; schema: Record<string, unknown>; maxTokens?: number }): Promise<T> {
  const prompt = `${params.prompt}\n\nRespond with ONLY a single valid JSON object — no markdown code fences, no commentary before or after — matching exactly this shape:\n${JSON.stringify(params.schema, null, 2)}`;

  const { text, truncated } = await chatCompletion({ system: params.system, prompt, maxTokens: params.maxTokens ?? 1024, jsonMode: true });
  try {
    return JSON.parse(text) as T;
  } catch {
    try {
      return JSON.parse(extractJsonObject(text)) as T;
    } catch (err) {
      if (truncated) throw new TruncatedResponseError(`Model response was cut off before valid JSON completed: ${text.slice(-200)}`);
      throw err;
    }
  }
}

/** Plain-text completion, for the knowledge chat's grounded answers (no structured output needed). */
export async function callModelForText(params: { system: string; prompt: string; maxTokens?: number }): Promise<string> {
  const { text } = await chatCompletion({ system: params.system, prompt: params.prompt, maxTokens: params.maxTokens ?? 512, jsonMode: false });
  return text;
}
