import { lookup } from "node:dns/promises";
import type { CheckResult } from "../types.js";

const MAX_HOPS = 3;
const MAX_LINKS_CHECKED = 5;
const TIMEOUT_MS = 3000;

function isPrivateIp(ip: string, family: number): boolean {
  if (family === 4) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true; // link-local, covers the 169.254.169.254 cloud metadata endpoint
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    return false;
  }
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower.startsWith("fe80:") || lower.startsWith("fc") || lower.startsWith("fd")) {
    return true;
  }
  if (lower.startsWith("::ffff:")) {
    return isPrivateIp(lower.split(":").pop() ?? "", 4);
  }
  return false;
}

async function validateHost(hostname: string): Promise<{ ok: boolean; reason?: string }> {
  try {
    const { address, family } = await lookup(hostname);
    if (isPrivateIp(address, family)) {
      return { ok: false, reason: `resolves to a private/internal address (${address})` };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: "DNS resolution failed" };
  }
}

async function headWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { method: "HEAD", redirect: "manual", signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

type ResolveOutcome = { finalDomain: string | null; note: string };

/** Follows redirects manually, HEAD-only, validating every hop's resolved IP before connecting. */
export async function resolveLinkDomain(url: string): Promise<ResolveOutcome> {
  let current = url;
  for (let hop = 0; hop <= MAX_HOPS; hop++) {
    let parsed: URL;
    try {
      parsed = new URL(current);
    } catch {
      return { finalDomain: null, note: "invalid URL" };
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { finalDomain: null, note: `unsupported protocol ${parsed.protocol}` };
    }

    const validation = await validateHost(parsed.hostname);
    if (!validation.ok) {
      return { finalDomain: null, note: `blocked ${parsed.hostname}: ${validation.reason}` };
    }

    let response: Response;
    try {
      response = await headWithTimeout(current);
    } catch {
      return { finalDomain: null, note: `request to ${parsed.hostname} timed out or failed` };
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return { finalDomain: parsed.hostname, note: "redirect with no Location header" };
      current = new URL(location, current).toString();
      continue;
    }

    return { finalDomain: parsed.hostname, note: `resolved after ${hop} redirect(s)` };
  }
  return { finalDomain: null, note: "too many redirects" };
}

type ExtractedLink = { href: string; anchorText: string | null };

export function extractLinks(body: string): ExtractedLink[] {
  const links: ExtractedLink[] = [];
  const anchorRe = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gis;
  let match: RegExpExecArray | null;
  while ((match = anchorRe.exec(body)) !== null) {
    links.push({ href: match[1], anchorText: match[2].replace(/<[^>]+>/g, "").trim() });
  }
  if (links.length === 0) {
    const bareRe = /https?:\/\/\S+/gi;
    while ((match = bareRe.exec(body)) !== null) {
      links.push({ href: match[0], anchorText: null });
    }
  }
  return links.slice(0, MAX_LINKS_CHECKED);
}

function hostnameFromText(text: string | null): string | null {
  if (!text) return null;
  const match = text.match(/([a-z0-9-]+\.)+[a-z]{2,}/i);
  return match ? match[0].toLowerCase() : null;
}

export async function checkLinkMismatch(body: string): Promise<CheckResult> {
  const links = extractLinks(body);
  if (links.length === 0) {
    return {
      id: "link-mismatch",
      label: "Body link-domain mismatch",
      status: "pass",
      evidence: "No links found in the body.",
    };
  }

  const findings: string[] = [];
  let worstIsFail = false;
  let worstIsWarn = false;

  for (const link of links) {
    const { finalDomain, note } = await resolveLinkDomain(link.href);
    if (!finalDomain) {
      findings.push(`${link.href}: could not verify (${note}).`);
      worstIsWarn = true;
      continue;
    }

    const claimedDomain = hostnameFromText(link.anchorText);
    if (claimedDomain && claimedDomain !== finalDomain && !finalDomain.endsWith(`.${claimedDomain}`)) {
      findings.push(
        `Link text mentions "${claimedDomain}" but actually points to "${finalDomain}" (${note}).`
      );
      worstIsFail = true;
    } else {
      findings.push(`${link.href} → ${finalDomain} (${note}).`);
    }
  }

  return {
    id: "link-mismatch",
    label: "Body link-domain mismatch",
    status: worstIsFail ? "fail" : worstIsWarn ? "warn" : "pass",
    evidence: findings.join(" "),
  };
}
