import { generateText } from "ai";
import { resolveModel } from "@/lib/resolve-model";
import { callClaudeCliWithImage } from "@/lib/claude-cli";
import type { Backend } from "@/lib/model-backend";
import { fromCliResult, type CallUsage } from "@/lib/usage";

export const DEFAULT_PROMPT = "Describe this image and extract any text in it.";

// Same instruction as `agents/image-reader`'s Python `DEFAULT_INSTRUCTION`, kept in sync
// by hand so the two implementations produce the same output shape.
const INSTRUCTION = `You are an image-reading assistant. Given an image, respond with two clearly \
labeled sections:

## Description
A concise, factual description of what the image shows.

## Extracted text
Any text visible in the image, transcribed verbatim, preserving line breaks where meaningful. If \
there is no visible text, write exactly: No text detected.`;

export type ImageReaderResult = { text: string; usage?: CallUsage };

/**
 * Browser-facing counterpart to the standalone `agents/image-reader` Python package: same
 * single-shot vision call (one instruction, one image, one answer), reimplemented here
 * against the Vercel AI SDK's provider-key backend instead of `google-genai` directly, so
 * it can run live in `sdk` without shelling out to Python. The Python package is not
 * invoked by this — it remains the separate, standalone/local-CLI implementation.
 */
export async function runImageReader(backend: Backend, dataUrl: string, prompt?: string): Promise<ImageReaderResult> {
  const effectivePrompt = prompt?.trim() || DEFAULT_PROMPT;

  if (backend.type === "claude-cli") {
    // See `callClaudeCliWithImage`'s doc comment — this goes through a temp file + the
    // Read tool, not a direct multimodal call, since `-p` mode has no other attachment path.
    const result = await callClaudeCliWithImage(effectivePrompt, INSTRUCTION, backend.account, dataUrl);
    return { text: result.text, usage: fromCliResult(result) };
  }

  const { text, usage } = await generateText({
    model: resolveModel(backend.providerId, backend.apiKey, backend.model),
    system: INSTRUCTION,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: effectivePrompt },
          { type: "image", image: dataUrl },
        ],
      },
    ],
  });

  return {
    text,
    usage: { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, totalTokens: usage.totalTokens },
  };
}
