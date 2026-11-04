import type { ParsedEmail } from "./types";

/**
 * Parses raw email source (RFC 5322 headers + body) as pasted from
 * "Show original" / "View message details" / "All Headers" in a webmail client.
 */
export function parseRawEmail(raw: string): ParsedEmail {
  const normalized = raw.replace(/\r\n/g, "\n");
  const splitIndex = normalized.indexOf("\n\n");
  const headerBlock = splitIndex === -1 ? normalized : normalized.slice(0, splitIndex);
  const body = splitIndex === -1 ? "" : normalized.slice(splitIndex + 2);

  // Unfold continuation lines (lines starting with whitespace belong to the previous header).
  const unfolded: string[] = [];
  for (const line of headerBlock.split("\n")) {
    if (/^[ \t]/.test(line) && unfolded.length > 0) {
      unfolded[unfolded.length - 1] += " " + line.trim();
    } else if (line.trim() !== "") {
      unfolded.push(line);
    }
  }

  const headers = new Map<string, string[]>();
  for (const line of unfolded) {
    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;
    const name = line.slice(0, colonIndex).trim().toLowerCase();
    const value = line.slice(colonIndex + 1).trim();
    const existing = headers.get(name);
    if (existing) {
      existing.push(value);
    } else {
      headers.set(name, [value]);
    }
  }

  return { headers, body };
}

export function getHeader(email: ParsedEmail, name: string): string | undefined {
  return email.headers.get(name.toLowerCase())?.[0];
}

export function getAllHeaders(email: ParsedEmail, name: string): string[] {
  return email.headers.get(name.toLowerCase()) ?? [];
}

/** Extracts the bare email address from a header value like `"Name" <user@domain.com>`. */
export function extractEmailAddress(headerValue: string | undefined): string | null {
  if (!headerValue) return null;
  const angleMatch = headerValue.match(/<([^>]+)>/);
  const candidate = angleMatch ? angleMatch[1] : headerValue.trim();
  const emailMatch = candidate.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  return emailMatch ? candidate.toLowerCase() : null;
}

export function extractDomain(email: string | null): string | null {
  if (!email) return null;
  const at = email.lastIndexOf("@");
  return at === -1 ? null : email.slice(at + 1).toLowerCase();
}
