import type { ParsedEmail } from "./types";

/**
 * Decodes quoted-printable text byte-by-byte through a Buffer (not per-character
 * String.fromCharCode) so multi-byte UTF-8 sequences reassemble correctly instead
 * of becoming mojibake.
 */
function decodeQuotedPrintable(input: string): string {
  const withoutSoftBreaks = input.replace(/=\n/g, "");
  const bytes: number[] = [];
  for (let i = 0; i < withoutSoftBreaks.length; i++) {
    const hex = withoutSoftBreaks.slice(i + 1, i + 3);
    if (withoutSoftBreaks[i] === "=" && /^[0-9A-Fa-f]{2}$/.test(hex)) {
      bytes.push(parseInt(hex, 16));
      i += 2;
    } else {
      bytes.push(withoutSoftBreaks.charCodeAt(i) & 0xff);
    }
  }
  return Buffer.from(bytes).toString("utf-8");
}

/**
 * Parses raw email source (RFC 5322 headers + body) as pasted from
 * "Show original" / "View message details" / "All Headers" in a webmail client.
 *
 * Only decodes a top-level `Content-Transfer-Encoding: quoted-printable` — real
 * multipart MIME messages (per-part boundaries/encodings) aren't parsed; this
 * covers the common single-part export case.
 */
export function parseRawEmail(raw: string): ParsedEmail {
  const normalized = raw.replace(/\r\n/g, "\n");
  const splitIndex = normalized.indexOf("\n\n");
  const headerBlock = splitIndex === -1 ? normalized : normalized.slice(0, splitIndex);
  let body = splitIndex === -1 ? "" : normalized.slice(splitIndex + 2);

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

  const transferEncoding = headers.get("content-transfer-encoding")?.[0]?.toLowerCase();
  if (transferEncoding?.includes("quoted-printable")) {
    body = decodeQuotedPrintable(body);
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

/** Extracts the display name from a header value like `"Name" <user@domain.com>`. */
export function extractDisplayName(headerValue: string | undefined): string | null {
  if (!headerValue) return null;
  const match = headerValue.match(/^"?([^"<]*)"?\s*<[^>]+>$/);
  const name = match ? match[1].trim() : null;
  return name && name.length > 0 ? name : null;
}

/** True if text looks like it contains real RFC 5322 headers (From: + a blank line), not just a bare address or URL. */
export function looksLikeFullEmailSource(text: string): boolean {
  return /^from\s*:/im.test(text) && /\n\s*\n/.test(text);
}
