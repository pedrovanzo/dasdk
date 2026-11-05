import { checkHomoglyph } from "./checks/homoglyph";
import { checkAuthResults } from "./checks/auth-results";
import { checkReplyTo } from "./checks/reply-to";
import { checkBrandAllowlist, type BrandLookup } from "./checks/brand-allowlist";
import { checkLinkMismatch } from "./checks/link-redirect";
import {
  parseRawEmail,
  getHeader,
  getAllHeaders,
  extractEmailAddress,
  extractDomain,
  extractDisplayName,
} from "./parse-email";
import type { CheckResult } from "./types";

export const CHECK_IDS = [
  "homoglyph",
  "auth-results",
  "reply-to",
  "brand-allowlist",
  "link-mismatch",
] as const;

export type CheckId = (typeof CHECK_IDS)[number];

/** Describes each check for the Planner prompt — what it needs, in plain language. */
export const CHECK_CATALOG: Record<CheckId, { label: string; requires: string }> = {
  homoglyph: {
    label: "Homoglyph / typosquat check",
    requires: "a sender domain",
  },
  "auth-results": {
    label: "SPF / DKIM / DMARC verification",
    requires: "raw email headers (Authentication-Results)",
  },
  "reply-to": {
    label: "Reply-To mismatch",
    requires: "raw email headers (From + Reply-To)",
  },
  "brand-allowlist": {
    label: "Known-brand allowlist",
    requires: "a claimed display name and a sender domain",
  },
  "link-mismatch": {
    label: "Body link-domain mismatch",
    requires: "a message body or a URL to check",
  },
};

/** Normalized fields every check reads from, regardless of how the input was extracted. */
export type ExtractedFields = {
  senderDomain: string | null;
  displayName: string | null;
  replyToDomain: string | null;
  authResultsHeaders: string[];
  body: string | null;
};

export const EMPTY_EXTRACTED_FIELDS: ExtractedFields = {
  senderDomain: null,
  displayName: null,
  replyToDomain: null,
  authResultsHeaders: [],
  body: null,
};

/** Deterministic extraction for input that's confirmed to be full raw email source — no model needed. */
export function extractFieldsFromRawEmail(rawEmail: string): ExtractedFields {
  const parsed = parseRawEmail(rawEmail);
  const fromHeader = getHeader(parsed, "from");
  const replyToHeader = getHeader(parsed, "reply-to");

  return {
    senderDomain: extractDomain(extractEmailAddress(fromHeader)),
    displayName: extractDisplayName(fromHeader),
    replyToDomain: extractDomain(extractEmailAddress(replyToHeader)),
    authResultsHeaders: getAllHeaders(parsed, "authentication-results"),
    body: parsed.body,
  };
}

/** Which checks have enough data to actually run, given what was extracted. */
export function applicableChecks(fields: ExtractedFields): CheckId[] {
  const applicable: CheckId[] = [];
  if (fields.senderDomain) applicable.push("homoglyph");
  if (fields.authResultsHeaders.length > 0) applicable.push("auth-results");
  if (fields.senderDomain || fields.replyToDomain) applicable.push("reply-to");
  if (fields.displayName && fields.senderDomain) applicable.push("brand-allowlist");
  if (fields.body) applicable.push("link-mismatch");
  return applicable;
}

type DispatchOptions = { brandLookup?: BrandLookup };

const CHECK_DISPATCH: Record<
  CheckId,
  (fields: ExtractedFields, options?: DispatchOptions) => CheckResult | Promise<CheckResult>
> = {
  homoglyph: (fields) => checkHomoglyph(fields.senderDomain),
  "auth-results": (fields) => checkAuthResults(fields.authResultsHeaders),
  "reply-to": (fields) => checkReplyTo(fields.senderDomain, fields.replyToDomain),
  "brand-allowlist": (fields, options) =>
    checkBrandAllowlist(fields.displayName, fields.senderDomain, options?.brandLookup),
  "link-mismatch": (fields) => checkLinkMismatch(fields.body ?? ""),
};

export async function runSelectedChecks(
  fields: ExtractedFields,
  checksToRun: CheckId[],
  options?: DispatchOptions
): Promise<CheckResult[]> {
  const unique = Array.from(new Set(checksToRun)).filter((id): id is CheckId =>
    (CHECK_IDS as readonly string[]).includes(id)
  );
  return Promise.all(unique.map((id) => CHECK_DISPATCH[id](fields, options)));
}
