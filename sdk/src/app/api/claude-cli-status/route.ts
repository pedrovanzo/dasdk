import { connection } from "next/server";
import { isClaudeCliBackendEnabled, isClaudeCliInstalled, CLAUDE_ACCOUNTS } from "@/lib/claude-cli";

export async function GET() {
  await connection();
  const available = isClaudeCliBackendEnabled() && (await isClaudeCliInstalled());
  const accounts = Object.entries(CLAUDE_ACCOUNTS).map(([id, { label }]) => ({ id, label }));
  return new Response(JSON.stringify({ available, accounts }), {
    headers: { "content-type": "application/json" },
  });
}
