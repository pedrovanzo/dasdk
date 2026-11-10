import { runDiverEvals } from "diver/evals";

// No request body: Quick check's deterministic checklist needs no model backend or API key, so
// neither does grading it. Stateless, same as every other route here — nothing persisted.
export async function POST() {
  const results = await runDiverEvals();
  return new Response(JSON.stringify({ results }), {
    headers: { "content-type": "application/json" },
  });
}
