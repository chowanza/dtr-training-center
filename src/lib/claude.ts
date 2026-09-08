import "server-only";

const CLAUDE_MODEL = "claude-sonnet-5";
const ANTHROPIC_VERSION = "2023-06-01";

interface ClaudeTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

/**
 * Calls Claude with a forced tool call so the response is guaranteed-shape JSON (Claude has no
 * `responseMimeType: json` flag like Gemini — tool use with tool_choice is the reliable
 * structured-output mechanism). Returns the tool call's `input` object, typed as T by the caller.
 */
export async function callClaudeForJson<T>(params: { system: string; prompt: string; tool: ClaudeTool; maxTokens?: number }): Promise<T> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: params.maxTokens ?? 1024,
      system: params.system,
      messages: [{ role: "user", content: params.prompt }],
      tools: [params.tool],
      tool_choice: { type: "tool", name: params.tool.name },
    }),
  });
  if (!response.ok) throw new Error(`Claude API error: ${response.status} ${response.statusText} — ${await response.text()}`);

  const data = await response.json();
  const toolUse = data.content?.find((block: { type: string }) => block.type === "tool_use");
  if (!toolUse) throw new Error("Claude response had no tool_use block");
  return toolUse.input as T;
}

/** Plain-text completion, for the knowledge chat's grounded answers (no structured output needed). */
export async function callClaudeForText(params: { system: string; prompt: string; maxTokens?: number }): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: params.maxTokens ?? 512,
      system: params.system,
      messages: [{ role: "user", content: params.prompt }],
    }),
  });
  if (!response.ok) throw new Error(`Claude API error: ${response.status} ${response.statusText} — ${await response.text()}`);

  const data = await response.json();
  const textBlock = data.content?.find((block: { type: string }) => block.type === "text");
  return textBlock?.text ?? "";
}
