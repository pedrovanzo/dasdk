import { z } from "zod";
import {
  extractFieldsFromRawEmail,
  applicableChecks,
  runSelectedChecks,
  computeVerdict,
  looksLikeFullEmailSource,
  type ExtractedFields,
  type CheckId,
} from "diver";
import { runPlanner, inputSchema } from "@/lib/diver-planner";
import { backendSchema, completeText, assertBackendAllowed, BackendNotAllowedError } from "@/lib/model-backend";

const requestSchema = z.object({
  input: inputSchema,
  backend: backendSchema,
});

const NARRATION_SYSTEM = `You are Diver, a sender/origin verification agent. You are given the plan a \
planning step already made (which checks it chose to run and why) and the deterministic results of \
running exactly those checks. You never override, re-grade, or second-guess those results, and you \
never invent checks that aren't in the list. Summarize in 2-4 plain-language sentences: what was \
checked, what wasn't (and why), and what the overall verdict means for a non-technical reader.`;

// Stateless: the input and any provided key are used for this single call
// only, never logged or persisted anywhere.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const { input, backend } = parsed.data;

  try {
    assertBackendAllowed(backend);
  } catch (error) {
    if (error instanceof BackendNotAllowedError) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 403,
        headers: { "content-type": "application/json" },
      });
    }
    throw error;
  }

  let plan: { extracted: ExtractedFields; checksToRun: CheckId[]; reasoning: string };

  if (input.kind === "text" && looksLikeFullEmailSource(input.text)) {
    const extracted = extractFieldsFromRawEmail(input.text);
    plan = {
      extracted,
      checksToRun: applicableChecks(extracted),
      reasoning: "Full email headers were detected — ran every check that had supporting data, no model needed to decide.",
    };
  } else {
    try {
      plan = await runPlanner(input, backend);
    } catch (error) {
      return new Response(
        JSON.stringify({ error: error instanceof Error ? error.message : "Planning failed." }),
        { status: 502, headers: { "content-type": "application/json" } }
      );
    }
  }

  const checks = await runSelectedChecks(plan.extracted, plan.checksToRun);
  const verdict = computeVerdict(checks);

  let narration: string | null = null;
  try {
    narration = await completeText(
      backend,
      NARRATION_SYSTEM,
      JSON.stringify({ plan: { checksToRun: plan.checksToRun, reasoning: plan.reasoning }, verdict, checks })
    );
  } catch (error) {
    narration = `Narration failed: ${error instanceof Error ? error.message : "unknown error"}`;
  }

  return new Response(JSON.stringify({ plan, verdict, checks, narration }), {
    headers: { "content-type": "application/json" },
  });
}
