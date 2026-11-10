import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import type { ToolSet } from "ai";
import { STEP_COUNT, type ProviderId } from "./types";

/**
 * Returns the single native web-search tool for the given provider, as a `tools` record ready to
 * pass straight into `streamText`. These are provider-executed tools (the provider runs the actual
 * search server-side) — no API key is needed to construct them, only to make the model call itself.
 *
 * Exact exports used (checked against installed versions):
 * - `@ai-sdk/anthropic`: `anthropic.tools.webSearch_20260318(...)` (newest dated version)
 * - `@ai-sdk/google`: `google.tools.googleSearch({})`
 * - `@ai-sdk/openai`: `openai.tools.webSearch({})` (`webSearchPreview` is deprecated)
 */
export function getNativeSearchTool(providerId: ProviderId): ToolSet {
  switch (providerId) {
    case "anthropic":
      // maxUses bounds how many searches Claude can issue in one call, on top of the step budget.
      return { web_search: anthropic.tools.webSearch_20260318({ maxUses: STEP_COUNT }) };
    case "google":
      // Google requires this exact key — see the factory's own doc comment ("Must have name 'google_search'").
      return { google_search: google.tools.googleSearch({}) };
    case "openai":
      return { web_search: openai.tools.webSearch({}) };
  }
}
