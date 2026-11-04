import { streamText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import type { ProviderId } from "@/lib/providers";

const requestSchema = z.object({
  providerId: z.enum(["google", "anthropic", "openai"] satisfies ProviderId[]),
  apiKey: z.string().min(1),
  model: z.string().min(1),
  prompt: z.string().min(1),
  system: z.string().optional(),
});

function resolveModel(providerId: ProviderId, apiKey: string, model: string) {
  switch (providerId) {
    case "google":
      return createGoogleGenerativeAI({ apiKey })(model);
    case "anthropic":
      return createAnthropic({ apiKey })(model);
    case "openai":
      return createOpenAI({ apiKey })(model);
  }
}

// Stateless proxy: the user's key and the request body are used for this
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

  const { providerId, apiKey, model, prompt, system } = parsed.data;

  const result = streamText({
    model: resolveModel(providerId, apiKey, model),
    system,
    prompt,
  });

  return result.toUIMessageStreamResponse({
    onError: (error) => (error instanceof Error ? error.message : "Model call failed."),
  });
}
