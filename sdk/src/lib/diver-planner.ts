import { generateObject } from "ai";
import { z } from "zod";
import { CHECK_IDS, CHECK_CATALOG, EMPTY_EXTRACTED_FIELDS, type ExtractedFields, type CheckId } from "diver";
import { resolveModel } from "@/lib/resolve-model";
import { callClaudeCli, callClaudeCliWithImage, extractJsonFromText } from "@/lib/claude-cli";
import type { Backend } from "@/lib/model-backend";
import { fromCliResult, type CallUsage } from "@/lib/usage";

export const inputSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("text"), text: z.string().min(1) }),
  z.object({ kind: z.literal("image"), dataUrl: z.string().min(1) }),
]);

export type DiverInput = z.infer<typeof inputSchema>;

const plannerSchema = z.object({
  extracted: z.object({
    senderDomain: z.string().nullable(),
    displayName: z.string().nullable(),
    replyToDomain: z.string().nullable(),
    authResultsHeaders: z.array(z.string()),
    body: z.string().nullable(),
  }),
  checksToRun: z.array(z.enum(CHECK_IDS as unknown as [CheckId, ...CheckId[]])),
  reasoning: z.string(),
});

export type PlannerOutput = {
  extracted: ExtractedFields;
  checksToRun: CheckId[];
  reasoning: string;
  usage?: CallUsage;
};

const CHECKLIST_DESCRIPTION = CHECK_IDS.map(
  (id) => `- ${id}: ${CHECK_CATALOG[id].label} — needs ${CHECK_CATALOG[id].requires}.`
).join("\n");

const PLANNER_SYSTEM = `You are the planning step of Diver, a sender/origin verification tool. You never \
render a verdict and you never run checks yourself — a separate deterministic step does that using only \
the fields you extract. Your job: look at the input (text, or an image of an email/message/webpage), \
extract whatever structured fields you can, and decide which of the following checks have enough data \
to be worth running:

${CHECKLIST_DESCRIPTION}

Only include a check in checksToRun if the fields you extracted actually support it (e.g. don't include \
auth-results if you found no authentication headers). Set any field you can't determine to null. Keep \
"reasoning" to one short sentence explaining your choice of checks.`;

// The provider path enforces this shape programmatically via generateObject's schema — the CLI path has
// no such enforcement, it's plain text prompting, so the exact shape has to be spelled out literally or
// the model invents its own (observed: it flattened fields to the top level instead of nesting them
// under "extracted").
const CLI_JSON_SHAPE = `Respond with ONLY a JSON object matching exactly this shape — these exact keys, \
nothing added or renamed:

{
  "extracted": {
    "senderDomain": string or null,
    "displayName": string or null,
    "replyToDomain": string or null,
    "authResultsHeaders": array of strings (empty if none),
    "body": string or null
  },
  "checksToRun": array of strings, only from ${JSON.stringify(CHECK_IDS)},
  "reasoning": string
}

No markdown fences, no extra commentary, no other top-level keys.`;

function buildPlannerPrompt(input: DiverInput): string {
  if (input.kind === "image") {
    return "The attached image shows a message, email, or webpage to check. Extract whatever sender/domain/link information is visible.";
  }
  return `Input to check:\n\n${input.text}`;
}

function normalize(raw: z.infer<typeof plannerSchema>, usage?: CallUsage): PlannerOutput {
  return {
    extracted: { ...EMPTY_EXTRACTED_FIELDS, ...raw.extracted },
    checksToRun: raw.checksToRun,
    reasoning: raw.reasoning,
    usage,
  };
}

export async function runPlanner(input: DiverInput, backend: Backend): Promise<PlannerOutput> {
  if (backend.type === "claude-cli") {
    const plannerSystem = `${PLANNER_SYSTEM}\n\n${CLI_JSON_SHAPE}`;
    // Image input goes through a temp file + Claude's own Read tool (see
    // `callClaudeCliWithImage`'s doc comment) — `-p` mode has no other way to attach binary
    // content. Text input needs no tool access at all, so it stays on the plain call with
    // every tool denied.
    const cliResult =
      input.kind === "image"
        ? await callClaudeCliWithImage(buildPlannerPrompt(input), plannerSystem, backend.account, input.dataUrl)
        : await callClaudeCli(buildPlannerPrompt(input), plannerSystem, backend.account, "");
    const jsonText = extractJsonFromText(cliResult.text);
    if (jsonText === null) {
      throw new Error(
        "The local Claude Code session responded with free-form text instead of the expected JSON " +
          "(this can happen on accounts with organization-level policies that affect how Claude Code " +
          `behaves, which no prompt here can override). Raw response: ${cliResult.text.slice(0, 300)}`
      );
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      throw new Error(`Planner (Claude CLI) didn't return valid JSON: ${cliResult.text.slice(0, 300)}`);
    }
    const result = plannerSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(`Planner (Claude CLI) JSON didn't match the expected shape: ${result.error.message}`);
    }
    return normalize(result.data, fromCliResult(cliResult));
  }

  const model = resolveModel(backend.providerId, backend.apiKey, backend.model);
  const content: Array<{ type: "text"; text: string } | { type: "image"; image: string }> = [
    { type: "text", text: buildPlannerPrompt(input) },
  ];
  if (input.kind === "image") {
    content.push({ type: "image", image: input.dataUrl });
  }

  const { object, usage } = await generateObject({
    model,
    schema: plannerSchema,
    system: PLANNER_SYSTEM,
    messages: [{ role: "user", content }],
  });

  return normalize(object, { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, totalTokens: usage.totalTokens });
}
