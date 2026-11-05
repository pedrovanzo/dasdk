import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * Dev-only backend: rides the developer's own logged-in Claude Code session
 * instead of an API key. Never offered to public visitors — gated off whenever
 * NODE_ENV is "production" (how the deployed Vercel app always runs), checked
 * both here and again before this module's functions are called from a route.
 */
export function isClaudeCliBackendEnabled(): boolean {
  return process.env.NODE_ENV !== "production";
}

let cachedInstalled: boolean | null = null;

/** Actually probes for a working `claude` binary (cheap `--version` call, not `-p`). Cached for the process lifetime. */
export async function isClaudeCliInstalled(): Promise<boolean> {
  if (cachedInstalled !== null) return cachedInstalled;
  try {
    await execFileAsync("claude", ["--version"], { timeout: 5_000 });
    cachedInstalled = true;
  } catch {
    cachedInstalled = false;
  }
  return cachedInstalled;
}

export async function callClaudeCli(prompt: string, system?: string): Promise<string> {
  const args = ["-p", prompt];
  if (system) args.push("--system-prompt", system);
  const { stdout } = await execFileAsync("claude", args, {
    timeout: 60_000,
    maxBuffer: 10 * 1024 * 1024,
  });
  return stdout.trim();
}

/** Strips a ```json ... ``` fence if the model wrapped its JSON output in one. */
export function extractJsonFromText(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return fenced ? fenced[1].trim() : text.trim();
}
