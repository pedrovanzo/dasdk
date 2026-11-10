import { SAMPLE_EMAIL } from "../fixtures";
import type { CheckId } from "../session";
import type { CheckStatus, Verdict } from "../types";

export type DiverEvalCase = {
  id: string;
  description: string;
  rawEmail: string;
  expectedVerdict: Verdict;
  /** Only checks listed here are graded — omit a check if its result depends on live network state (e.g. link-mismatch resolving a real URL) and would make the suite flaky. */
  expectedChecks?: Partial<Record<CheckId, CheckStatus>>;
};

export const DIVER_EVAL_CASES: DiverEvalCase[] = [
  {
    id: "spoofed-google-sample",
    description: 'Classic spoofed-brand email (the app\'s own "try a spoofed sample" fixture): homoglyph domain, failed auth, reply-to redirect.',
    rawEmail: SAMPLE_EMAIL,
    expectedVerdict: "red",
    expectedChecks: {
      // "googIe.com" is one edit away from "google.com" (capital I for lowercase l) — close enough to
      // warn as a likely typosquat, not an exact confusable-character match, so this is "warn" not "fail".
      homoglyph: "warn",
      "auth-results": "fail",
      // checkReplyTo never returns "fail" — a From/Reply-To domain mismatch is its worst case, "warn".
      "reply-to": "warn",
      "brand-allowlist": "fail",
      // link-mismatch not graded: it resolves a real bit.ly URL over the network, which would make
      // this suite flaky. The verdict is "red" regardless of what it returns (auth-results and
      // brand-allowlist are already at "fail" severity, the worst possible).
    },
  },
  {
    id: "clean-legitimate-email",
    description: "Everything checks out: matching domains, fully-passing auth, no reply-to redirect, no body links.",
    rawEmail: `From: billing@acme-example.test
Authentication-Results: mx.example.com; spf=pass smtp.mailfrom=acme-example.test; dkim=pass header.d=acme-example.test; dmarc=pass
Subject: Your invoice is ready

Thanks for your business.`,
    expectedVerdict: "green",
    expectedChecks: {
      homoglyph: "pass",
      "auth-results": "pass",
      "reply-to": "pass",
      "brand-allowlist": "pass", // no display name in the From header — short-circuits to pass
      "link-mismatch": "pass", // no links in the body at all — short-circuits to pass, no network call
    },
  },
  {
    id: "missing-auth-headers",
    description: "No Authentication-Results header at all — common when a webmail export omits it. Should land on yellow (unknown isn't a hard failure), not red or green.",
    rawEmail: `From: person@example-personal.test
Subject: Hey

Just checking in.`,
    expectedVerdict: "yellow",
    expectedChecks: {
      homoglyph: "pass",
      "auth-results": "unknown",
      "reply-to": "pass", // no Reply-To header present
      "brand-allowlist": "pass",
      "link-mismatch": "pass",
    },
  },
  {
    id: "reply-to-mismatch-only",
    description: "Isolates the Reply-To check: everything else passes, only the Reply-To domain differs from From.",
    rawEmail: `From: person@example-other.test
Reply-To: person@different-domain.test
Authentication-Results: mx.example.com; spf=pass smtp.mailfrom=example-other.test; dkim=pass; dmarc=pass
Subject: Quick question

Hello there.`,
    expectedVerdict: "yellow",
    expectedChecks: {
      homoglyph: "pass",
      "auth-results": "pass",
      "reply-to": "warn",
      "brand-allowlist": "pass",
      "link-mismatch": "pass",
    },
  },
];
