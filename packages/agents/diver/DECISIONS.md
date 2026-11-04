# Diver — decisions log

Captured from a /grilling session (2026-11-03/04), closing definition gap #1 ("first agent's goal") from `dasdk/DECISIONS.md`. Source of truth for Diver's shape; update as decisions change.

## What Diver is

An agent that checks whether an email is a real, legitimate communication from who it claims to be — catching spoofing/impersonation tricks like `staff@googIe.com` (capital I homoglyph) — by running a checklist of deterministic signals against free sources of truth, then narrating the result. Originates from a personal idea (sender/origin verification against trusted sources, free-sources-only) predating this project; chosen as dasdk's flagship real agent. Long-term, the underlying idea is viewed as a possible SaaS; this build is the free/open demo version, not the commercial one.

"Diver" is the agent name. "Dived" is the vocabulary for a positive result (e.g. "this content has been Dived") — UI copy only in v1, not a feature (see Scope boundaries).

## Input

- **Text only** in v1 — no screenshot/image/vision pipeline. Screenshot support is a later additive layer (OCR/extract → feed into the same pipeline), not part of v1.
- **Raw email source** (headers + body), not just a bare address — pasted into a single textarea. This is what unlocks real SPF/DKIM/DMARC/Received-chain analysis, not just domain-string tricks. Every major webmail exposes this for free ("Show original" in Gmail, "View message details" in Outlook, "All Headers" in Apple Mail) — no OAuth/API integration needed.
- UX: one textarea, one short "how to get this" hint/link per major provider. No file upload, no mailbox-connect integration in v1. (Mailbox-connect flagged as a plausible later premium/SaaS feature, not ruled out, just not v1.)

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

**Deterministic checks are ground truth; the LLM only narrates.** Each check/tool returns pass/warn/fail + evidence. The agent's job is to run all checks and produce one plain-language summary — it never overrides a tool result based on its own "judgment" of ambiguous signals. Keeps the tool auditable (a security-adjacent verdict needs to be explainable by evidence, not model vibes) and makes the harness's event log genuinely informative to watch (tool calls are the real work; the final LLM step is narration only).

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

`packages/agents/diver/` — all agents (real or demo/toy) live under `packages/agents/`, one subfolder per agent, so the convention stays memorable ("agents live in `packages/agents/`") rather than relying on remembering which top-level folder name belongs to which agent.
