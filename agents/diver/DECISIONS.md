# Diver — decisions log

Captured from a /grilling session (2026-11-03/04), closing definition gap #1 ("first agent's goal") from `dasdk/DECISIONS.md`. Source of truth for Diver's shape; update as decisions change.

## What Diver is

An agent that checks whether an email is a real, legitimate communication from who it claims to be — catching spoofing/impersonation tricks like `staff@googIe.com` (capital I homoglyph) — by running a checklist of deterministic signals against free sources of truth, then narrating the result. Originates from a personal idea (sender/origin verification against trusted sources, free-sources-only) predating this project; chosen as dasdk's flagship real agent. Long-term, the underlying idea is viewed as a possible SaaS; this build is the free/open demo version, not the commercial one.

"Diver" is the agent name. "Dived" is the vocabulary for a positive result (e.g. "this content has been Dived") — UI copy only in v1, not a feature (see Scope boundaries).

## Input

- **Raw email source** (headers + body) remains the richest input and is what unlocks real SPF/DKIM/DMARC/Received-chain analysis. Every major webmail exposes this for free ("Show original" in Gmail, "View message details" in Outlook, "All Headers" in Apple Mail) — no OAuth/API integration needed.
- **Superseded:** v1 originally scoped input to "text only, full headers only." Revised (2026-11-05) once Diver got a real agent loop (see "Agent session mode" below) — now also accepts a bare email address, a bare URL, short free text, or an **image** (screenshot of an email/message/webpage). Mailbox-connect integration is still not in scope, flagged as a plausible later premium/SaaS feature.

## Two modes

- **Quick check** — the original, always-on deterministic path. Always runs all 5 checks against full raw email source, no model required at all. Unchanged by the agent-session work below; kept specifically because "a proper agent" doesn't mean the free, keyless, fully-auditable path should go away.
- **Agent session** — the new agentic path (below). Requires a model backend (provider key or the dev-only Claude Code CLI bridge). Accepts any of the four input shapes.

## Checklist (v1 scope)

All deterministic, free, no external signup required:

1. **Homoglyph/typosquat detection** — flags lookalike domains (`googIe.com`, punycode tricks) against the known-brand list below. Pure algorithm.
2. **SPF/DKIM/DMARC verification** — parse `Authentication-Results` from pasted headers (or re-verify via DNS TXT lookups).
3. **Reply-To vs. From mismatch** — header parsing only.
4. **Known-brand allowlist match** — compare claimed sender against a static curated list (~50-100 commonly-impersonated brands), shipped as a JSON file in the repo.
5. **Body link-domain mismatch** — see "Link check" below.

**Deferred, not v1:** WHOIS/domain-age lookup (free tiers are flaky), third-party threat-intel blocklists like Google Safe Browsing/PhishTank (require their own API key/signup — conflicts with the zero-extra-key principle). Both are legitimate SaaS-later upgrades.

### Known-brand list + web-search fallback

Static list is small and will miss brands. When a claimed brand isn't found in the local list, the agent falls back to **native provider web search** (Gemini grounding-with-Google-Search, Anthropic's web-search tool, OpenAI's web-search tool) — reuses the model key the user already provided, no second "bring your own key" field. Not all providers support this; the agent must flag when the active provider lacks search capability and name the providers that do (Gemini, Claude, OpenAI) rather than silently degrading.

### Link check — safe redirect resolution

Chosen over both "static-only" (too weak — misses cloaked/shortened links) and "full fetch" (SSRF risk):

- `HEAD` requests only — body is never downloaded, so no content-rendering/XSS/zip-bomb exposure.
- Before connecting to any hop, resolve the hostname and reject private/internal/loopback/link-local IP ranges, explicitly including `169.254.169.254` (cloud metadata endpoint — classic SSRF target).
- Redirects followed manually (not auto-followed by the HTTP client), re-validating each hop's IP the same way, capped at ~3 hops.
- Hard ~3s timeout per hop. Any timeout/error/block reports "couldn't verify" for that check rather than failing open or closed silently.
- Only the final resolved domain is reported back and compared against the link's visible anchor text — response content is never surfaced.

## Agent role

**Deterministic checks are ground truth; models only plan and narrate, never grade.** Each check returns pass/warn/fail + evidence, and no model call ever overrides a check result. This held from v1 and still holds after the agent-session upgrade below — what changed is how many model calls happen and what they're responsible for.

## Agent session mode (added 2026-11-05)

v1's "LLM narrates a fixed checklist" was judged not to qualify as "a proper agent" — there was no decision being made, just narration bolted onto an always-identical pipeline. Revised architecture, two model calls around a deterministic core, not one model call wrapping it:

1. **Planner** (one model call) — looks at the input (text or image) and decides two things: what structured fields it can extract (sender domain, display name, reply-to domain, auth headers, body/links) and which checks have enough data to be worth running. It does not run checks and does not grade anything.
2. **Deterministic execution** (no model) — the server runs exactly the checks the Planner selected, using the exact same check functions as Quick check. Single dispatch table (`agents/diver/src/session.ts`) shared by both modes, so there's one source of truth for what each check does regardless of which mode invoked it.
3. **Narrator** (one model call, same role as v1) — summarizes the plan + results in plain language. Still can't override anything.

**Tiered extraction, to avoid unnecessary model calls:** if the input is plain text and deterministically looks like full email headers (`From:` line + a blank line), the Planner step is skipped entirely — extraction uses the existing deterministic parser (`extractFieldsFromRawEmail`), and `checksToRun` is just "every check that has supporting data." The Planner model call only happens for the genuinely ambiguous cases: a bare address, a bare URL, short free text, or an image. This keeps the well-handled case (today's only case) exactly as fast/free/auditable as before, and spends a real model call only where real judgment is needed.

**Two backends, one interface.** Both the Planner and Narrator go through `completeText`/`runPlanner` in `sdk`, dispatched to either:
- **A real provider** (Gemini/Anthropic/OpenAI, user's own key) — Planner uses `generateObject` with a Zod schema (structured output, supports multimodal messages for image input directly — no separate OCR step). Narrator uses `generateText`.
- **Claude Code CLI (dev-only, never public)** — bridges the pattern already used in `~/Desktop/prompt-eval` (`child_process.execFile("claude", ["-p", prompt, "--system-prompt", system])`, no persistent session, one-shot completion). Since the CLI has no structured function-calling over a pipe, the Planner prompt asks for raw JSON text and the server parses/validates it with the same Zod schema. Gated two ways: the UI only shows this option when `NEXT_PUBLIC_ENABLE_CLAUDE_CLI_BACKEND=true` is set (never set on the deployed Vercel app), and the route itself rejects the backend with a 403 whenever `NODE_ENV === "production"` — so even a direct POST can't reach it on the public deployment. **Known gap:** image input isn't supported on this backend yet (returns a clear error rather than failing silently); untested end-to-end in the environment this was built in (subprocess invocation was deliberately not exercised during that session, to avoid spawning a nested Claude Code session) — first real test is on the developer's own machine.

**Inspector visibility:** the Planner's decision (which checks it picked + a one-sentence reason) renders as its own "Plan" card before the check results, so an agent session is inspectable step-by-step rather than a single opaque response — consistent with the harness's "watch the agent work" positioning.

## Output format (v1 shape, expected to be refined after first build)

Single rolled-up **traffic-light verdict** (green/yellow/red, worst-case-of-all-checks) with a collapsible per-check breakdown underneath showing evidence for each. Rejected: numeric trust score (false precision, hard to justify); per-check-list-only with no rollup (weaker demo, pushes final judgment onto the user).

## Data handling

**Stateless, zero retention.** Pasted email content is sent to the user's chosen model provider for processing (per that provider's own data policy) and nowhere else — Diver itself never logs or persists pasted content, not even for debugging. Request/response live only in-memory for that single call. Sidesteps LGPD retention/consent questions for the showcase phase. Opt-in scan-history is a plausible later SaaS feature, not v1.

## Abuse protection

Checks #2-5 above (SPF/DKIM/DMARC, reply-to, allowlist, link-resolve) need **no API key at all** to run — the link-check specifically is a free network primitive (resolve-this-redirect-chain-for-me) that could be abused as an open SSRF-probe/scanner against arbitrary targets if left unprotected. **Basic per-IP rate limiting** on the public endpoint (Vercel KV free tier or an in-memory coarse limiter — no new infra/database) closes this cheaply.

## Scope boundaries (explicitly not in v1)

- No shareable "Dived" badge/certificate, no public verification link, no export. A real badge implies a verifiable/signed persistent claim (otherwise anyone can fake a "Dived ✓" screenshot) — a half-built trust/signing system isn't worth it for a demo. "Dived" stays UI vocabulary only. Flagged as a genuinely valuable future SaaS feature.
- English-only UI and agent output in v1 (broadest reach for the international-recruiter audience this repo is partly aimed at). A PT-BR toggle is a cheap post-v1 addition, not ruled out.
- No screenshot/image input, no mailbox-connect integration, no WHOIS, no third-party threat-intel feeds — all noted above as plausible later additions, not v1.

## Folder structure

`agents/diver/` — all agents (real or demo/toy) live under `agents/`, one subfolder per agent, so the convention stays memorable ("agents live in `agents/`") rather than relying on remembering which top-level folder name belongs to which agent.
