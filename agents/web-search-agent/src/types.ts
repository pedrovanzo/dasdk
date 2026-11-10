export type ProviderId = "google" | "anthropic" | "openai";

/** Providers known to support native web search as of this writing — kept in sync with providers.ts in sdk. */
export const SEARCH_CAPABLE_PROVIDERS = ["Google Gemini", "Anthropic Claude", "OpenAI"];

/** Small, fixed step budget for the tool-use loop — this is a toy/demo agent, not an open-ended researcher. */
export const STEP_COUNT = 5;
