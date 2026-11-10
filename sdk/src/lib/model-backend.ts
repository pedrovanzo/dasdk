import { generateText, streamText } from "ai";
import { z } from "zod";
import { resolveModel } from "@/lib/resolve-model";
import { callClaudeCli, callClaudeCliStreaming, isClaudeCliBackendEnabled, CLAUDE_ACCOUNTS, type ClaudeAccountId } from "@/lib/claude-cli";
import type { ProviderId } from "@/lib/providers";
import { fromCliResult, type CallUsage } from "@/lib/usage";

const claudeAccountIds = Object.keys(CLAUDE_ACCOUNTS) as [ClaudeAccountId, ...ClaudeAccountId[]];

export const backendSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("provider"),
    providerId: z.enum(["google", "anthropic", "openai"] satisfies ProviderId[]),
    apiKey: z.string().min(1),
    model: z.string().min(1),
  }),
  z.object({ type: z.literal("claude-cli"), account: z.enum(claudeAccountIds) }),
]);

export type Backend = z.infer<typeof backendSchema>;

export function assertBackendAllowed(backend: Backend) {
  if (backend.type === "claude-cli" && !isClaudeCliBackendEnabled()) {
    throw new BackendNotAllowedError();
  }
}

export class BackendNotAllowedError extends Error {
  constructor() {
    super("The Claude Code CLI backend is disabled in this environment.");
  }
}

export type TextResult = { text: string; usage?: CallUsage };

/**
 * `allowedTools` is required, not defaulted, for the claude-cli backend — forces every caller to
 * state what this specific call actually needs (most callers need none; a tool-using agent states
 * exactly which ones) rather than silently inheriting whatever a given machine's own Claude Code
 * settings happen to auto-allow. Ignored for the provider backend.
 */
export async function completeText(
  backend: Backend,
  system: string,
  prompt: string,
  allowedTools: string = ""
): Promise<TextResult> {
  if (backend.type === "claude-cli") {
    const result = await callClaudeCli(prompt, system, backend.account, allowedTools);
    return { text: result.text, usage: fromCliResult(result) };
  }
  const { text, usage } = await generateText({
    model: resolveModel(backend.providerId, backend.apiKey, backend.model),
    system,
    prompt,
  });
  return { text, usage: { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, totalTokens: usage.totalTokens } };
}

/** Same as completeText, but forwards text chunks to onDelta as they arrive instead of waiting for the full response. */
export async function streamNarration(
  backend: Backend,
  system: string,
  prompt: string,
  onDelta: (chunk: string) => void,
  allowedTools: string = ""
): Promise<TextResult> {
  if (backend.type === "claude-cli") {
    const result = await callClaudeCliStreaming(prompt, system, backend.account, onDelta, allowedTools);
    return { text: result.text, usage: fromCliResult(result) };
  }
  const result = streamText({
    model: resolveModel(backend.providerId, backend.apiKey, backend.model),
    system,
    prompt,
  });
  let fullText = "";
  for await (const chunk of result.textStream) {
    fullText += chunk;
    onDelta(chunk);
  }
  const usage = await result.usage;
  return { text: fullText, usage: { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, totalTokens: usage.totalTokens } };
}
