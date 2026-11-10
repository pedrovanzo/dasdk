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
import { backendSchema, streamNarration, assertBackendAllowed, BackendNotAllowedError } from "@/lib/model-backend";
import { addUsage, type CallUsage } from "@/lib/usage";

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
  let plannerUsage: CallUsage | undefined;

  if (input.kind === "text" && looksLikeFullEmailSource(input.text)) {
    const extracted = extractFieldsFromRawEmail(input.text);
    plan = {
      extracted,
      checksToRun: applicableChecks(extracted),
      reasoning: "Full email headers were detected — ran every check that had supporting data, no model needed to decide.",
    };
  } else {
    try {
      const { usage, ...plannerPlan } = await runPlanner(input, backend);
      plan = plannerPlan;
      plannerUsage = usage;
    } catch (error) {
      return new Response(
        JSON.stringify({ error: error instanceof Error ? error.message : "Planning failed." }),
        { status: 502, headers: { "content-type": "application/json" } }
      );
    }
  }

  const checks = await runSelectedChecks(plan.extracted, plan.checksToRun);
  const verdict = computeVerdict(checks);

  // Plan + checks are already fully resolved at this point (no model call left that
  // could still fail with a different HTTP status), so it's safe to commit to a 200
  // streaming response now: the client sees the plan/verdict/checks immediately instead
  // of waiting for the narrator, then watches the narration text stream in as it's
  // generated instead of waiting for the whole paragraph.
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      function send(event: Record<string, unknown>) {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      }

      send({ type: "result", plan, verdict, checks });

      let narratorUsage: CallUsage | undefined;
      try {
        const { usage } = await streamNarration(
          backend,
          NARRATION_SYSTEM,
          JSON.stringify({ plan: { checksToRun: plan.checksToRun, reasoning: plan.reasoning }, verdict, checks }),
          (chunk) => send({ type: "narration-delta", text: chunk })
        );
        narratorUsage = usage;
      } catch (error) {
        send({
          type: "narration-delta",
          text: `Narration failed: ${error instanceof Error ? error.message : "unknown error"}`,
        });
      }

      send({ type: "done", usage: addUsage(plannerUsage, narratorUsage) });
      controller.close();
    },
  });

  return new Response(stream, { headers: { "content-type": "application/x-ndjson" } });
}
