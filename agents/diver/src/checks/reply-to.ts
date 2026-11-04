import type { CheckResult } from "../types";

export function checkReplyTo(fromDomain: string | null, replyToDomain: string | null): CheckResult {
  if (!replyToDomain) {
    return {
      id: "reply-to",
      label: "Reply-To mismatch",
      status: "pass",
      evidence: "No Reply-To header present — replies would go to the From address.",
    };
  }

  if (!fromDomain) {
    return {
      id: "reply-to",
      label: "Reply-To mismatch",
      status: "unknown",
      evidence: "Could not determine the From domain to compare against Reply-To.",
    };
  }

  if (fromDomain === replyToDomain) {
    return {
      id: "reply-to",
      label: "Reply-To mismatch",
      status: "pass",
      evidence: `Reply-To domain matches From domain (${fromDomain}).`,
    };
  }

  return {
    id: "reply-to",
    label: "Reply-To mismatch",
    status: "warn",
    evidence: `From domain is "${fromDomain}" but replies are redirected to "${replyToDomain}" — common in spoofing attempts.`,
  };
}
