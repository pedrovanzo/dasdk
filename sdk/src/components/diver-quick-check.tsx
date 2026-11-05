"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
          <CardTitle className="text-base">Quick check</CardTitle>
          <CardDescription>
            Paste the full raw source of a suspicious email. Five deterministic checks run
            immediately, no key needed — connect one above for a plain-language summary too.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Collapsible>
            <CollapsibleTrigger className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground">
              How do I get the raw email source?
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 flex flex-col gap-2 text-sm text-muted-foreground">
              <p>
                This is a &quot;view source&quot; / &quot;show original&quot; export, not just the
                message text — it includes hidden technical headers.
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  <strong className="text-foreground">Gmail:</strong> open the email → ⋮ menu →{" "}
                  <strong className="text-foreground">Show original</strong> → copy everything.
                </li>
                <li>
                  <strong className="text-foreground">Outlook:</strong> open the email → <strong className="text-foreground">...</strong> →{" "}
                  <strong className="text-foreground">View message details</strong>.
                </li>
                <li>
                  <strong className="text-foreground">Apple Mail:</strong> View menu → Message →{" "}
                  <strong className="text-foreground">All Headers</strong>.
                </li>
              </ul>
            </CollapsibleContent>
          </Collapsible>

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
              Try a spoofed sample
            </Button>
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
