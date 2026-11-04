"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiKey } from "@/lib/use-api-key";
import { DEFAULT_MODELS } from "@/lib/providers";

type CheckStatus = "pass" | "warn" | "fail" | "unknown";
type CheckResult = { id: string; label: string; status: CheckStatus; evidence: string };
type Verdict = "green" | "yellow" | "red";
type DiverResponse = { verdict: Verdict; checks: CheckResult[]; narration: string | null };

const VERDICT_STYLES: Record<Verdict, string> = {
  green: "border-green-600/30 bg-green-600/10 text-green-700 dark:text-green-400",
  yellow: "border-yellow-600/30 bg-yellow-600/10 text-yellow-700 dark:text-yellow-400",
  red: "border-red-600/30 bg-red-600/10 text-red-700 dark:text-red-400",
};

const VERDICT_LABELS: Record<Verdict, string> = {
  green: "Dived — looks legitimate",
  yellow: "Caution — some signals are off",
  red: "Spoofed — do not trust this email",
};

const STATUS_BADGE_VARIANT: Record<CheckStatus, "default" | "secondary" | "destructive" | "outline"> = {
  pass: "secondary",
  warn: "outline",
  fail: "destructive",
  unknown: "outline",
};

const SAMPLE_EMAIL = `From: "Google Support" <staff@googIe.com>
Reply-To: scammer@totally-not-google.ru
Authentication-Results: mx.example.com; spf=fail smtp.mailfrom=googIe.com; dkim=none; dmarc=fail
Subject: Your account has been suspended

<p>Click <a href="http://bit.ly/fake-redirect">google.com/account</a> to verify your account.</p>`;

export function DiverInspector() {
  const { credential } = useApiKey();
  const [rawEmail, setRawEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DiverResponse | null>(null);

  async function handleRun() {
    if (!rawEmail.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/diver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawEmail,
          narrate: credential
            ? {
                providerId: credential.providerId,
                apiKey: credential.apiKey,
                model: DEFAULT_MODELS[credential.providerId],
              }
            : undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ? JSON.stringify(body.error) : `Request failed (${res.status})`);
      }
      setResult(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">What Diver does</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 text-sm text-muted-foreground">
          <p>
            You paste the <strong className="text-foreground">full raw source</strong> of a
            suspicious email — not just the message text. Diver checks it against SPF/DKIM/DMARC
            results, known-brand domains, and link-redirect targets, then gives you a
            green/yellow/red verdict with evidence for each check.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Step 1 — Get the raw email source</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
          <p>
            This is a &quot;view source&quot; / &quot;show original&quot; export — every major webmail client has
            one. It includes the hidden technical headers, not just what you see on screen.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong className="text-foreground">Gmail:</strong> open the email → click the ⋮
              menu (top right of the message) → <strong className="text-foreground">Show original</strong> → copy everything on that page.
            </li>
            <li>
              <strong className="text-foreground">Outlook:</strong> open the email → <strong className="text-foreground">...</strong> → <strong className="text-foreground">View message details</strong> (or File → Properties → Internet headers).
            </li>
            <li>
              <strong className="text-foreground">Apple Mail:</strong> open the email → View menu
              → Message → <strong className="text-foreground">All Headers</strong>.
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Step 2 — Paste it below and run the checklist</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Textarea
            value={rawEmail}
            onChange={(e) => setRawEmail(e.target.value)}
            placeholder="Paste the full raw email source here (headers + body)..."
            rows={10}
            className="font-mono text-xs"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button nativeButton onClick={handleRun} disabled={loading || !rawEmail.trim()}>
              {loading ? "Running..." : "Run checklist"}
            </Button>
            <Button nativeButton variant="outline" onClick={() => setRawEmail(SAMPLE_EMAIL)}>
              Or try a spoofed sample instead
            </Button>
            {!credential && (
              <span className="text-xs text-muted-foreground">
                Checks run without a key. Connect one above for a plain-language summary too.
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {result && (
        <div className="flex flex-col gap-4">
          <div className={`rounded-lg border px-4 py-3 font-medium ${VERDICT_STYLES[result.verdict]}`}>
            {VERDICT_LABELS[result.verdict]}
          </div>

          <div className="flex flex-col gap-2">
            {result.checks.map((check) => (
              <div key={check.id} className="flex flex-col gap-1 rounded-md border p-3">
                <div className="flex items-center gap-2">
                  <Badge variant={STATUS_BADGE_VARIANT[check.status]}>{check.status}</Badge>
                  <span className="font-medium">{check.label}</span>
                </div>
                <p className="text-sm text-muted-foreground">{check.evidence}</p>
              </div>
            ))}
          </div>

          {result.narration && (
            <div className="rounded-md border bg-muted/30 p-3 text-sm">{result.narration}</div>
          )}
        </div>
      )}
    </div>
  );
}
