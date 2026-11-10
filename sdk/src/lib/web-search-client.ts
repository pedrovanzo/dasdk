"use client";

import { parseJsonEventStream, readUIMessageStream, uiMessageChunkSchema, isTextUIPart, type UIMessage, type UIMessageChunk } from "ai";
import type { CallUsage } from "@/components/diver-shared";
import type { ModelBackend } from "@/lib/use-model-backend";

export type WebSearchAgentMessage = UIMessage<{ usage?: CallUsage }>;

// A loosely-typed duck shape matching @ai-sdk/provider-utils' ParseResult<T> — avoided importing the
// real type since provider-utils isn't a direct dependency here, only a transitive one of `ai`.
type ParseResultLike<T> = { success: true; value: T } | { success: false; error: unknown };

/** Turns the route's SSE body into a plain stream of UIMessageChunks, ready for readUIMessageStream. */
function toChunkStream(body: ReadableStream<Uint8Array>): ReadableStream<UIMessageChunk> {
  const parsed: ReadableStream<ParseResultLike<UIMessageChunk>> = parseJsonEventStream({
    stream: body,
    schema: uiMessageChunkSchema,
  });
  return parsed.pipeThrough(
    new TransformStream<ParseResultLike<UIMessageChunk>, UIMessageChunk>({
      transform(chunk, controller) {
        if (chunk.success) controller.enqueue(chunk.value);
      },
    })
  );
}

/**
 * POSTs a question to /api/web-search-agent and consumes the full response stream. Shared between
 * the live inspector (which wants every incremental message via onMessage, to render the tool trace
 * as it happens) and the eval runner (which just awaits the final message and reads its answer text).
 */
export async function askWebSearchAgent(
  backend: ModelBackend,
  question: string,
  options?: { onMessage?: (message: WebSearchAgentMessage) => void; onError?: (error: unknown) => void }
): Promise<WebSearchAgentMessage | null> {
  const res = await fetch("/api/web-search-agent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ backend, question }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(typeof body?.error === "string" ? body.error : `Request failed (${res.status})`);
  }
  if (!res.body) throw new Error("No response stream.");

  const stream = readUIMessageStream<WebSearchAgentMessage>({
    stream: toChunkStream(res.body),
    onError: options?.onError ?? (() => {}),
  });

  let last: WebSearchAgentMessage | null = null;
  for await (const next of stream) {
    last = next;
    options?.onMessage?.(next);
  }
  return last;
}

export function extractAnswerText(message: WebSearchAgentMessage): string {
  return message.parts.filter(isTextUIPart).map((part) => part.text).join("\n\n");
}
