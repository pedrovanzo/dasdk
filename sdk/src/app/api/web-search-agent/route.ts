import { streamText, isStepCount } from "ai";
import { z } from "zod";
import { resolveModel } from "@/lib/resolve-model";
import { getNativeSearchTool, SYSTEM_PROMPT, CLAUDE_CLI_SYSTEM_PROMPT, STEP_COUNT, SEARCH_CAPABLE_PROVIDERS } from "web-search-agent";
import { backendSchema, assertBackendAllowed, BackendNotAllowedError, streamNarration } from "@/lib/model-backend";

const requestSchema = z.object({
  backend: backendSchema,
  question: z.string().min(1),
});

const encoder = new TextEncoder();

function sse(event: Record<string, unknown>): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
}

// Stateless proxy: the user's key/CLI choice and question are used for this
// single call only, never logged or persisted anywhere.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const { backend, question } = parsed.data;

  try {
    assertBackendAllowed(backend);
  } catch (error) {
    if (error instanceof BackendNotAllowedError) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 403,
        headers: { "content-type": "application/json" },
      });
    }
    throw error;
  }

  if (backend.type === "provider") {
    const result = streamText({
      model: resolveModel(backend.providerId, backend.apiKey, backend.model),
      system: SYSTEM_PROMPT,
      prompt: question,
      tools: getNativeSearchTool(backend.providerId),
      stopWhen: isStepCount(STEP_COUNT),
    });

    // Headers are already committed by the time any model-call error surfaces (the first byte of a
    // real streaming response can't wait for the whole call to succeed), so failures — including a
    // model that doesn't actually support tool-call-based web search — arrive as an `error` part
    // inside the stream rather than a different HTTP status. onError turns that into a message that
    // names which providers are known to support native search, instead of a raw SDK error string.
    return result.toUIMessageStreamResponse({
      sendSources: true,
      messageMetadata: ({ part }) =>
        part.type === "finish"
          ? {
              usage: {
                inputTokens: part.totalUsage.inputTokens,
                outputTokens: part.totalUsage.outputTokens,
                cachedTokens: part.totalUsage.inputTokenDetails.cacheReadTokens,
                totalTokens: part.totalUsage.totalTokens,
              },
            }
          : undefined,
      onError: (error) => {
        const message = error instanceof Error ? error.message : "Model call failed.";
        return `${message} Native web search is supported by: ${SEARCH_CAPABLE_PROVIDERS.join(", ")}. If your selected model doesn't support tool-calling or web search, try a different model from one of those providers.`;
      },
    });
  }

  // Claude CLI backend: there's no AI-SDK tool-calling interface for this backend, but `claude -p`
  // already includes WebSearch/WebFetch as standard built-in tools — it searches the web on its own
  // as part of answering, via its own internal agent loop. We don't get a structured tool-call trace
  // back the way the provider path does (known, documented limitation, not a bug) — only the final
  // answer text streams through. Hand-built as the same wire format `toUIMessageStreamResponse` above
  // produces (SSE `data: <UIMessageChunk>` lines, terminated by `data: [DONE]`) so the client's single
  // rendering path (readUIMessageStream) works unchanged regardless of which backend answered.
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(sse({ type: "start" }));
      controller.enqueue(sse({ type: "text-start", id: "0" }));
      try {
        const { usage } = await streamNarration(
          backend,
          CLAUDE_CLI_SYSTEM_PROMPT,
          question,
          (chunk) => controller.enqueue(sse({ type: "text-delta", id: "0", delta: chunk })),
          "WebSearch,WebFetch"
        );
        controller.enqueue(sse({ type: "text-end", id: "0" }));
        controller.enqueue(sse({ type: "finish", messageMetadata: { usage } }));
      } catch (error) {
        controller.enqueue(
          sse({ type: "error", errorText: error instanceof Error ? error.message : "Model call failed." })
        );
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache", connection: "keep-alive" },
  });
}
