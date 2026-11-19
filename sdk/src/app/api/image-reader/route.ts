import { z } from "zod";
import { runImageReader } from "@/lib/image-reader";
import { backendSchema, assertBackendAllowed, BackendNotAllowedError } from "@/lib/model-backend";

const requestSchema = z.object({
  dataUrl: z.string().min(1),
  prompt: z.string().optional(),
  backend: backendSchema,
});

// Stateless: the image, prompt, and any provided key are used for this single
// call only, never logged or persisted anywhere.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const { dataUrl, prompt, backend } = parsed.data;

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

  try {
    const result = await runImageReader(backend, dataUrl, prompt);
    return new Response(JSON.stringify(result), { headers: { "content-type": "application/json" } });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Image analysis failed." }),
      { status: 502, headers: { "content-type": "application/json" } }
    );
  }
}
