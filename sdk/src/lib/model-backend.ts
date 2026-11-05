import { generateText } from "ai";
import { z } from "zod";
import { resolveModel } from "@/lib/resolve-model";
import { callClaudeCli, isClaudeCliBackendEnabled } from "@/lib/claude-cli";
import type { ProviderId } from "@/lib/providers";

export const backendSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("provider"),
    providerId: z.enum(["google", "anthropic", "openai"] satisfies ProviderId[]),
    apiKey: z.string().min(1),
    model: z.string().min(1),
  }),
  z.object({ type: z.literal("claude-cli") }),
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

export async function completeText(backend: Backend, system: string, prompt: string): Promise<string> {
  if (backend.type === "claude-cli") {
    return callClaudeCli(prompt, system);
  }
  const { text } = await generateText({
    model: resolveModel(backend.providerId, backend.apiKey, backend.model),
    system,
    prompt,
  });
  return text;
}
