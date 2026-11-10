import type { ClaudeCliResult } from "@/lib/claude-cli";

export type CallUsage = {
  inputTokens?: number;
  outputTokens?: number;
  // Cache-write + cache-read tokens (CLI backend only — these are billed and
  // absent from inputTokens/outputTokens, which only cover the uncached
  // portion of the Anthropic usage payload). Can dwarf the other two fields,
  // e.g. when org/local hooks inject a large fixed context into every call.
  cachedTokens?: number;
  totalTokens?: number;
  costUsd?: number;
};

export function addUsage(a: CallUsage | undefined, b: CallUsage | undefined): CallUsage | undefined {
  if (!a && !b) return undefined;
  const inputTokens = (a?.inputTokens ?? 0) + (b?.inputTokens ?? 0);
  const outputTokens = (a?.outputTokens ?? 0) + (b?.outputTokens ?? 0);
  const cachedTokens = (a?.cachedTokens ?? 0) + (b?.cachedTokens ?? 0);
  const costUsd = a?.costUsd !== undefined || b?.costUsd !== undefined ? (a?.costUsd ?? 0) + (b?.costUsd ?? 0) : undefined;
  return { inputTokens, outputTokens, cachedTokens, totalTokens: inputTokens + outputTokens + cachedTokens, costUsd };
}

export function fromCliResult(result: ClaudeCliResult): CallUsage | undefined {
  if (!result.usage && result.costUsd === undefined) return undefined;
  const u = result.usage;
  const cachedTokens = u ? (u.cacheReadInputTokens ?? 0) + (u.cacheCreationInputTokens ?? 0) : undefined;
  return {
    inputTokens: u?.inputTokens,
    outputTokens: u?.outputTokens,
    cachedTokens,
    totalTokens: u ? u.inputTokens + u.outputTokens + (cachedTokens ?? 0) : undefined,
    costUsd: result.costUsd,
  };
}
