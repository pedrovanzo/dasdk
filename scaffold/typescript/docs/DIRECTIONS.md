# Example directions

Three non-functional sketches. Pick one and adapt it, or ignore all three and write your own spec using the checklist in `../AGENTS.md`.

## web-search-agent

A classic multi-step tool-use loop: one web-search tool, the model searches and synthesizes an answer to a question across several steps (Vercel AI SDK / Pocock style — `stopWhen: isStepCount(n)` rather than a hand-rolled loop). Good fit when the task genuinely needs iterative lookups before an answer is possible.

## joke-maker

Takes freeform text input that can specify theme, length, etc. The model first extracts those as structured parameters, then a separate step generates the joke from them. Mirrors Diver's "extract structured fields, then a deterministic/generative step" pattern rather than a tool-use loop — tool calling is optional here, not required.

## document-mapper

Local-only — real filesystem access, so this direction will never run on the deployed app. A tool-calling loop (grep/read/summarize tools) that finds or summarizes files on the local filesystem from a raw text query. Two explicit design constraints: it must bound its own search cost (cap steps/tool calls — don't let it wander unboundedly burning tokens), and it must log every run's tool-call action trail to a local file, one fresh timestamped log file per run (not per individual LLM call within a run).
