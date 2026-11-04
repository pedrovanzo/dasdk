import brands from "../data/brands.json" with { type: "json" };
import type { CheckResult } from "../types.js";

export type BrandLookupResult = { domain: string } | null;
export type BrandLookup = (claimedBrandName: string) => Promise<BrandLookupResult>;

/** Providers known to support native web search as of this writing — kept in sync with providers.ts in sdk. */
export const SEARCH_CAPABLE_PROVIDERS = ["Google Gemini", "Anthropic Claude", "OpenAI"];

function findLocalBrand(displayName: string) {
  const lower = displayName.toLowerCase();
  return brands.find((brand) => lower.includes(brand.name.toLowerCase())) ?? null;
}

export async function checkBrandAllowlist(
  displayName: string | null,
  senderDomain: string | null,
  lookupFallback?: BrandLookup
): Promise<CheckResult> {
  if (!displayName) {
    return {
      id: "brand-allowlist",
      label: "Known-brand allowlist",
      status: "pass",
      evidence: "No display name claiming to be a known brand.",
    };
  }

  const local = findLocalBrand(displayName);
  if (local) {
    return compareClaim(displayName, local.name, local.domain, senderDomain, "local list");
  }

  if (!lookupFallback) {
    return {
      id: "brand-allowlist",
      label: "Known-brand allowlist",
      status: "unknown",
      evidence: `"${displayName}" isn't in the local brand list, and the active provider doesn't support native web search for a fallback lookup. Providers with native search: ${SEARCH_CAPABLE_PROVIDERS.join(", ")}.`,
    };
  }

  const found = await lookupFallback(displayName);
  if (!found) {
    return {
      id: "brand-allowlist",
      label: "Known-brand allowlist",
      status: "unknown",
      evidence: `"${displayName}" isn't in the local brand list, and a web search couldn't confirm an official domain for it.`,
    };
  }

  return compareClaim(displayName, displayName, found.domain, senderDomain, "web search");
}

function compareClaim(
  displayName: string,
  brandLabel: string,
  officialDomain: string,
  senderDomain: string | null,
  source: string
): CheckResult {
  if (!senderDomain) {
    return {
      id: "brand-allowlist",
      label: "Known-brand allowlist",
      status: "unknown",
      evidence: "No sender domain found to compare against the claimed brand.",
    };
  }

  if (senderDomain === officialDomain || senderDomain.endsWith(`.${officialDomain}`)) {
    return {
      id: "brand-allowlist",
      label: "Known-brand allowlist",
      status: "pass",
      evidence: `Display name claims "${brandLabel}" and sender domain "${senderDomain}" matches its official domain (via ${source}).`,
    };
  }

  return {
    id: "brand-allowlist",
    label: "Known-brand allowlist",
    status: "fail",
    evidence: `Display name "${displayName}" claims to be "${brandLabel}", but sender domain "${senderDomain}" does not match its official domain "${officialDomain}" (via ${source}).`,
  };
}
