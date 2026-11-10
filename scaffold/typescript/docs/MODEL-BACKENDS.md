# Model backends

A TypeScript agent in this repo talks to a model through one of two backends. Both are proven working in `agents/diver/`; neither is Diver-specific — reuse the pattern, not the business logic.

## 1. Provider API key backend

The end user supplies their own key (Gemini / Anthropic / OpenAI) via `sdk`'s existing key-storage UI. Your server route:

1. Resolves a model with `sdk`'s `resolveModel(providerId, apiKey, model)` helper (`sdk/src/lib/resolve-model.ts`) — it wraps `@ai-sdk/google` / `@ai-sdk/anthropic` / `@ai-sdk/openai`.
2. Calls `generateText` / `generateObject` / `streamText` / `streamObject` from the `ai` package with that resolved model.

Project-wide rule: **no server-held API keys, ever.** The key always comes from the request, sourced from the user's own stored key.

## 2. Local Claude Code CLI dev-bridge

A dev-only backend that shells out to the developer's own logged-in `claude` CLI subscription instead of a key, via `node:child_process`:

- `execFile` with `--output-format json` for a blocking call — returns a JSON envelope with `result`, `usage`, `total_cost_usd`.
- `spawn` with `--output-format stream-json --include-partial-messages --verbose` for token-by-token streaming — parse `content_block_delta` events for text, and the terminal `result` event for final text/usage/cost.

Supports multiple named accounts via `CLAUDE_CONFIG_DIR` env swapping (e.g. a `work` / `personal` map, each pointing at a different credentials directory).

**Must always be gated off in production.** A status-probe endpoint (cheap `claude --version` check, cached) lets the UI detect availability, but the route itself must *also* independently check `NODE_ENV !== "production"` before using this backend — never rely on the UI alone, and never offer it to public visitors.

Known characteristics, documented honestly rather than worked around:
- **No native structured-output enforcement.** Ask for a literal JSON shape in the prompt and parse leniently — prefer a fenced \`\`\`json block if present, otherwise scan for the first balanced `{...}` object in the text.
- **No image input support** on this backend.
- **Output can be affected by org-level admin policy** tied to the logged-in account. This is an accepted characteristic of riding someone's real subscription, not a bug fixable from the app.
