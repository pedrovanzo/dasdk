import { extractFieldsFromRawEmail, runSelectedChecks, CHECK_IDS } from "./session";
import { computeVerdict } from "./verdict";
import type { DiverResult } from "./types";
import type { BrandLookup } from "./checks/brand-allowlist";

/** The original, always-on deterministic path: runs all 5 checks against full raw email source. */
export async function runDiverChecklist(
  rawEmail: string,
  options?: { brandLookup?: BrandLookup }
): Promise<DiverResult> {
  const fields = extractFieldsFromRawEmail(rawEmail);
  const checks = await runSelectedChecks(fields, [...CHECK_IDS], options);
  return { verdict: computeVerdict(checks), checks };
}

export * from "./types";
export * from "./session";
export { computeVerdict } from "./verdict";
export { parseRawEmail, extractEmailAddress, extractDomain, looksLikeFullEmailSource } from "./parse-email";
export { SEARCH_CAPABLE_PROVIDERS } from "./checks/brand-allowlist";
export type { BrandLookup } from "./checks/brand-allowlist";
