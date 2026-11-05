"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiKey } from "@/lib/use-api-key";
import { DEFAULT_MODELS } from "@/lib/providers";
import { VerdictBanner, CheckResultsList, Narration, SAMPLE_EMAIL, type Verdict, type CheckResult } from "@/components/diver-shared";

type DiverResponse = { verdict: Verdict; checks: CheckResult[]; narration: string | null };

export function DiverQuickCheck() {
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
          <CardTitle className="text-base">What this does</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 text-sm text-muted-foreground">
          <p>
            You paste the <strong className="text-foreground">full raw source</strong> of a
            suspicious email — not just the message text. Every one of the five checks always runs,
            deterministically, no model involved unless you want a plain-language summary too.
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
          <VerdictBanner verdict={result.verdict} />
          <CheckResultsList checks={result.checks} />
          <Narration text={result.narration} />
        </div>
      )}
    </div>
  );
}
