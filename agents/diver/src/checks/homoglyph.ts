import brands from "../data/brands.json" with { type: "json" };
import type { CheckResult } from "../types";

/** Visually-confusable characters folded to their most common Latin look-alike. */
const CONFUSABLES: Record<string, string> = {
  // Cyrillic look-alikes
  а: "a",
  е: "e",
  о: "o",
  р: "p",
  с: "c",
  х: "x",
  у: "y",
  і: "i",
  ј: "j",
  ѕ: "s",
  // Greek look-alikes
  α: "a",
  ο: "o",
  ρ: "p",
  // ASCII tricks
  "1": "l",
  "0": "o",
};

function foldConfusables(input: string): string {
  return Array.from(input)
    .map((ch) => CONFUSABLES[ch] ?? ch)
    .join("")
    .replace(/rn/g, "m");
}

function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

export function checkHomoglyph(senderDomain: string | null): CheckResult {
  if (!senderDomain) {
    return {
      id: "homoglyph",
      label: "Homoglyph / typosquat check",
      status: "unknown",
      evidence: "No sender domain found to check.",
    };
  }

  if (senderDomain.startsWith("xn--") || senderDomain.includes(".xn--")) {
    return {
      id: "homoglyph",
      label: "Homoglyph / typosquat check",
      status: "fail",
      evidence: `Sender domain "${senderDomain}" uses punycode (xn--), which legitimate brand domains practically never need — common IDN-homoglyph attack pattern.`,
    };
  }

  if (brands.some((brand) => brand.domain === senderDomain)) {
    return {
      id: "homoglyph",
      label: "Homoglyph / typosquat check",
      status: "pass",
      evidence: `"${senderDomain}" is itself a recognized official domain.`,
    };
  }

  const folded = foldConfusables(senderDomain);

  for (const brand of brands) {
    if (folded === brand.domain) {
      return {
        id: "homoglyph",
        label: "Homoglyph / typosquat check",
        status: "fail",
        evidence: `Sender domain "${senderDomain}" visually mimics "${brand.domain}" (${brand.name}) using confusable characters.`,
      };
    }

    const distance = levenshtein(senderDomain, brand.domain);
    if (distance > 0 && distance <= 2 && Math.abs(senderDomain.length - brand.domain.length) <= 2) {
      return {
        id: "homoglyph",
        label: "Homoglyph / typosquat check",
        status: "warn",
        evidence: `Sender domain "${senderDomain}" is very close to "${brand.domain}" (${brand.name}) — possible typosquat (edit distance ${distance}).`,
      };
    }
  }

  return {
    id: "homoglyph",
    label: "Homoglyph / typosquat check",
    status: "pass",
    evidence: `No match or near-match against known brand domains for "${senderDomain}".`,
  };
}
