import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import type { ProviderId } from "@/lib/providers";

export function resolveModel(providerId: ProviderId, apiKey: string, model: string) {
  switch (providerId) {
    case "google":
      return createGoogleGenerativeAI({ apiKey })(model);
    case "anthropic":
      return createAnthropic({ apiKey })(model);
    case "openai":
      return createOpenAI({ apiKey })(model);
  }
}
