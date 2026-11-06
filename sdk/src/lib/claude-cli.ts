import { execFile } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";
import path from "node:path";

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

/**
 * `claude-work` / `claude-personal` on this machine are shell *functions*
 * (defined in .zshrc), not real executables — execFile spawns processes
 * directly without a shell, so it can never resolve those names. Both just
 * run the same `claude` binary after pointing CLAUDE_CONFIG_DIR at a
 * different credentials directory, which is the part that's actually
 * reproducible here via execFile's `env` option.
 */
export const CLAUDE_ACCOUNTS = {
  work: { label: "Work (pdsantos)", configDir: path.join(os.homedir(), ".claude") },
  personal: { label: "Personal (pedro_vanzo)", configDir: path.join(os.homedir(), ".claude-personal") },
} as const;

export type ClaudeAccountId = keyof typeof CLAUDE_ACCOUNTS;

function envForAccount(account?: ClaudeAccountId): NodeJS.ProcessEnv {
  if (!account) return process.env;
  return { ...process.env, CLAUDE_CONFIG_DIR: CLAUDE_ACCOUNTS[account].configDir };
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

type ExecFileError = NodeJS.ErrnoException & {
  stdout?: string;
  stderr?: string;
  signal?: NodeJS.Signals | null;
  killed?: boolean;
};

/**
 * Node's default exec/execFile failure message is just the restated command
 * line ("Command failed: claude -p ...") — it says nothing about *why*. The
 * real reason (timeout vs. crash vs. missing binary, and the process's own
 * stderr) lives in separate fields on the error object that get dropped on
 * the floor unless we pull them out ourselves.
 */
function describeExecFileError(error: unknown): string {
  if (!(error instanceof Error)) return "claude CLI call failed for an unknown reason.";
  const e = error as ExecFileError;
  const parts: string[] = [];

  if (e.killed && e.signal === "SIGTERM") {
    parts.push("claude CLI call timed out (60s) and was killed.");
  } else if (e.killed) {
    parts.push(`claude CLI call was killed (signal ${e.signal}).`);
  } else if (e.code === "ENOENT") {
    parts.push("claude CLI binary not found on PATH.");
  } else if (typeof e.code === "number") {
    parts.push(`claude CLI exited with code ${e.code}.`);
  } else if (e.code) {
    parts.push(`claude CLI failed to start: ${e.code}.`);
  }

  if (e.stderr?.trim()) {
    parts.push(`stderr: ${e.stderr.trim().slice(0, 500)}`);
  }
  // Some CLIs print their real error to stdout instead of stderr on failure.
  if (e.stdout?.trim()) {
    parts.push(`stdout: ${e.stdout.trim().slice(0, 500)}`);
  }
  if (parts.length === 0) parts.push(e.message);

  const combined = parts.join(" ");
  if (/oauth session expired|failed to authenticate/i.test(combined)) {
    return (
      "Your local Claude Code session has expired. Run `claude` in a terminal " +
      `(or \`/login\` inside an existing session) to re-authenticate, then try again. (${combined})`
    );
  }
  return combined;
}

export async function callClaudeCli(
  prompt: string,
  system?: string,
  account?: ClaudeAccountId
): Promise<string> {
  const args = ["-p", prompt];
  if (system) args.push("--system-prompt", system);

  // execFile always opens a stdin pipe to the child but never closes it, so
  // `claude` sits waiting for input that will never arrive (it logs a "no
  // stdin data received" warning, then still hangs past that). Close our end
  // immediately so the child sees EOF right away instead of idling until the
  // timeout kills it.
  const execPromise = execFileAsync("claude", args, {
    timeout: 60_000,
    maxBuffer: 10 * 1024 * 1024,
    env: envForAccount(account),
  });
  execPromise.child.stdin?.end();

  try {
    const { stdout } = await execPromise;
    return stdout.trim();
  } catch (error) {
    throw new Error(describeExecFileError(error));
  }
}

/**
 * Finds a JSON object inside free-form text — this backend has no structured-output
 * enforcement, so the model may prepend/append prose around (or instead of) the JSON.
 * Prefers a ```json fence if present, otherwise scans for the first balanced {...}
 * object anywhere in the text. Returns null if nothing that looks like an object is found.
 */
export function extractJsonFromText(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();

  const start = text.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}
