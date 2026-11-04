import { parseRawEmail, getHeader, getAllHeaders, extractEmailAddress, extractDomain } from "./parse-email";
import { checkHomoglyph } from "./checks/homoglyph";
import { checkAuthResults } from "./checks/auth-results";
import { checkReplyTo } from "./checks/reply-to";
import { checkBrandAllowlist, type BrandLookup } from "./checks/brand-allowlist";
import { checkLinkMismatch } from "./checks/link-redirect";
import type { DiverResult, Verdict, CheckStatus, CheckResult } from "./types";

const STATUS_SEVERITY: Record<CheckStatus, number> = { fail: 3, warn: 2, unknown: 1, pass: 0 };

function computeVerdict(checks: CheckResult[]): Verdict {
  const worst = Math.max(...checks.map((c) => STATUS_SEVERITY[c.status]));
  if (worst >= 3) return "red";
  if (worst >= 1) return "yellow";
  return "green";
}

function extractDisplayName(fromHeader: string | undefined): string | null {
  if (!fromHeader) return null;
  const match = fromHeader.match(/^"?([^"<]*)"?\s*<[^>]+>$/);
  const name = match ? match[1].trim() : null;
  return name && name.length > 0 ? name : null;
}

export async function runDiverChecklist(
  rawEmail: string,
  options?: { brandLookup?: BrandLookup }
): Promise<DiverResult> {
  const parsed = parseRawEmail(rawEmail);
  const fromHeader = getHeader(parsed, "from");
  const replyToHeader = getHeader(parsed, "reply-to");
  const authResultsHeaders = getAllHeaders(parsed, "authentication-results");

  const fromDomain = extractDomain(extractEmailAddress(fromHeader));
  const replyToDomain = extractDomain(extractEmailAddress(replyToHeader));
  const displayName = extractDisplayName(fromHeader);

  const checks = await Promise.all([
    Promise.resolve(checkHomoglyph(fromDomain)),
    Promise.resolve(checkAuthResults(authResultsHeaders)),
    Promise.resolve(checkReplyTo(fromDomain, replyToDomain)),
    checkBrandAllowlist(displayName, fromDomain, options?.brandLookup),
    checkLinkMismatch(parsed.body),
  ]);

  return { verdict: computeVerdict(checks), checks };
}

export * from "./types";
export { parseRawEmail, extractEmailAddress, extractDomain } from "./parse-email";
export { SEARCH_CAPABLE_PROVIDERS } from "./checks/brand-allowlist";
export type { BrandLookup } from "./checks/brand-allowlist";
