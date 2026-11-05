import { connection } from "next/server";
import { isClaudeCliBackendEnabled, isClaudeCliInstalled } from "@/lib/claude-cli";

export async function GET() {
  await connection();
  const available = isClaudeCliBackendEnabled() && (await isClaudeCliInstalled());
  return new Response(JSON.stringify({ available }), {
    headers: { "content-type": "application/json" },
  });
}
