import { generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { runDiverChecklist } from "diver";
import { z } from "zod";
import type { ProviderId } from "@/lib/providers";

const requestSchema = z.object({
  rawEmail: z.string().min(1),
  narrate: z
    .object({
      providerId: z.enum(["google", "anthropic", "openai"] satisfies ProviderId[]),
      apiKey: z.string().min(1),
      model: z.string().min(1),
    })
    .optional(),
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

const NARRATION_SYSTEM = `You are Diver, an email spoofing checker. You are given the results of a
fixed checklist that already ran deterministically — you never override, re-grade, or second-guess
those results. Your only job is to summarize them in 2-4 plain-language sentences for a non-technical
reader: what the overall verdict means, and which specific checks drove it. Do not invent checks that
aren't in the list.`;

// Stateless: the pasted email and any provided key are used for this single
// call only, never logged or persisted anywhere.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const { rawEmail, narrate } = parsed.data;
  const result = await runDiverChecklist(rawEmail);

  let narration: string | null = null;
  if (narrate) {
    try {
      const { text } = await generateText({
        model: resolveModel(narrate.providerId, narrate.apiKey, narrate.model),
        system: NARRATION_SYSTEM,
        prompt: JSON.stringify(result),
      });
      narration = text;
    } catch (error) {
      narration = `Narration failed: ${error instanceof Error ? error.message : "unknown error"}`;
    }
  }

  return new Response(JSON.stringify({ ...result, narration }), {
    headers: { "content-type": "application/json" },
  });
}
