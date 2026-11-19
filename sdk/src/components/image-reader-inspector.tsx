"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useModelBackend } from "@/lib/use-model-backend";
import { ModelBackendPicker } from "@/components/model-backend-picker";
import { fileToDataUrl } from "@/lib/file-to-data-url";
import { UsageLine, type CallUsage } from "@/components/diver-shared";

type ImageReaderResult = { text: string; usage?: CallUsage };

export function ImageReaderInspector() {
  const model = useModelBackend();
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImageReaderResult | null>(null);

  async function setImageFromFile(file: File) {
    setImageDataUrl(await fileToDataUrl(file));
    setResult(null);
    setError(null);
  }

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await setImageFromFile(file);
  }

  // Lets a copied image (from a browser, a screenshot tool, wherever) be pasted directly
  // instead of needing to be saved to disk first. Scoped to while this inspector is mounted;
  // only intercepts the paste when clipboard data actually contains an image, so pasting text
  // into the prompt field above is unaffected.
  useEffect(() => {
    function handlePaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            void setImageFromFile(file);
          }
          return;
        }
      }
    }
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  async function handleAnalyze() {
    if (!imageDataUrl || !model.backendReady || !model.backend) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/image-reader", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl: imageDataUrl, prompt: prompt.trim() || undefined, backend: model.backend }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(typeof body?.error === "string" ? body.error : `Request failed (${res.status})`);
      }
      setResult(body as ImageReaderResult);
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
          <CardTitle className="text-base">Pick an image</CardTitle>
          <CardDescription>
            One model call describes the image and transcribes any visible text — the same
            single-shot vision call as the standalone Python package, reimplemented here against
            your connected model backend.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <input type="file" accept="image/*" onChange={handleImageChange} className="text-sm" />
            <span className="text-xs text-muted-foreground">
              Or paste an image (Cmd/Ctrl+V) anywhere on this page — copied from a browser, a
              screenshot tool, wherever.
            </span>
          </div>

          {imageDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- client-only preview of a locally picked file, not a network image.
            <img src={imageDataUrl} alt="Selected" className="h-32 w-32 rounded-md border object-cover" />
          )}

          <Input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Optional: ask a specific question instead of describe + extract text"
          />

          <ModelBackendPicker model={model} />

          <div className="flex flex-wrap items-center gap-2">
            <Button nativeButton onClick={handleAnalyze} disabled={loading || !imageDataUrl || !model.backendReady}>
              {loading ? "Analyzing..." : "Analyze image"}
            </Button>
          </div>
          {model.effectiveBackend === "claude-cli" && (
            <p className="text-xs text-muted-foreground">
              Using your local Claude Code session — since one-shot CLI calls can&apos;t carry image
              bytes directly, your image is written to a temp file and read via Claude&apos;s own Read
              tool (scoped to that one file only), then deleted. Expect a bit more latency than a
              direct provider-key call.
            </p>
          )}
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Analysis</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="whitespace-pre-wrap text-sm">{result.text}</p>
            <UsageLine usage={result.usage} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
