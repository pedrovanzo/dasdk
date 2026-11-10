# web-search-agent

Toy/demo agent, TypeScript flavor (Vercel AI SDK). Searches the web and reports back — modeled on Matt Pocock's AI Hero web-search-agent pattern (`streamText` + a Zod-defined tool + a step limit). Exists to prove the TypeScript scaffold flavor produces a real, runnable agent, and to populate the deployed harness demo.

Status: built. Core logic (system prompt, step budget, per-provider native search tool
selection) lives in `src/`; the Next.js wiring (route + inspector UI) lives in `sdk/`
(`sdk/src/app/api/web-search-agent/route.ts`, `sdk/src/components/web-search-agent-inspector.tsx`).

Two backends, same as Diver: a connected provider key (real tool-calling native search, with a
live search-trace UI), or a local Claude Code CLI subscription (`claude -p` already ships
WebSearch/WebFetch as built-in tools — no separate search mechanism needed, just explicit
`--allowedTools` to actually grant them; no search-trace UI for this path, only the final answer).

See `dasdk/DECISIONS.md` → "Claude Code CLI subscription backend — componentized across all
browser-wired agents".
