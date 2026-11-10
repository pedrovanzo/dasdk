# Model backends

This is standard-pattern guidance only — generic Google ADK conventions, not a port of anything in this repo. There is no working Python agent here yet to point at (unlike the TypeScript flavor, which can cite real code in `agents/diver/`). Treat everything below as a sensible starting point to verify once a real build exists, not a proven mechanism.

## Auth

ADK-style agents typically authenticate to a Gemini model one of two ways:

- **Google AI Studio API key** — simplest path, a single key in an environment variable (conventionally `GOOGLE_API_KEY` or `GEMINI_API_KEY`), good for local dev and demos.
- **Vertex AI** — project/location-based auth via Application Default Credentials (`gcloud auth application-default login`, or a service account), used when the agent needs Vertex-only features or enterprise billing/quota.

Pick one per agent; don't build both unless the spec specifically asks for it.

## Agent/model configuration pattern

ADK's convention is to declare the model as configuration on the agent object itself (e.g. an `Agent(model="gemini-...", instruction=..., tools=[...])`-shaped constructor), rather than threading a client through call sites by hand. Tools are declared alongside the model on the same object, and the framework handles the call/response loop (including multi-step tool-use) internally.

## Real-world note: ADK's overhead for a single-shot agent (2026-11-09)

`agents/image-reader/` (the first Python agent actually built here) tried `google-adk` first, per this doc's own guidance — it installed cleanly and worked, but transitively pulled in ~45 packages (FastAPI, Uvicorn, Starlette, OpenTelemetry, Authlib, cryptography, watchdog...) for what's really one vision call with no server, no auth, and no multi-step loop. `google-adk` already bundles `google-genai` as its own Gemini transport, so for a genuinely single-shot agent, going straight to `google-genai` directly (wrapped in a thin ADK-flavored class — `model`/`instruction` on the object, one `.run(...)` entry point) gets the same auth/config conventions above with a much smaller footprint (~22 packages). **Reach for `google-adk` itself when the agent actually needs its runtime** (a real multi-step/multi-turn session, the built-in tool-use loop, session state) — not by default for every agent in this flavor.

## What this repo doesn't have yet

There's no dasdk-specific equivalent of the TypeScript flavor's CLI-subprocess bridge (`claude -p` shelling out to a local Claude Code session) — that pattern is Vercel-AI-SDK/TypeScript-specific and doesn't apply here. If a Python agent ever needs a comparable "ride my own logged-in session instead of a key" escape hatch, that would need its own investigation; nothing here should be assumed to already solve it.
