import { execFile, spawn } from "node:child_process";
import { writeFile, mkdir, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
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

export type ClaudeCliUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens?: number;
  cacheCreationInputTokens?: number;
};

export type ClaudeCliResult = {
  text: string;
  usage?: ClaudeCliUsage;
  costUsd?: number;
};

function parseCliUsage(usage: Record<string, unknown> | undefined): ClaudeCliUsage | undefined {
  if (!usage) return undefined;
  return {
    inputTokens: Number(usage.input_tokens ?? 0),
    outputTokens: Number(usage.output_tokens ?? 0),
    cacheReadInputTokens: usage.cache_read_input_tokens !== undefined ? Number(usage.cache_read_input_tokens) : undefined,
    cacheCreationInputTokens:
      usage.cache_creation_input_tokens !== undefined ? Number(usage.cache_creation_input_tokens) : undefined,
  };
}

/** Parses the single JSON object `--output-format json` prints to stdout on exit. */
function parseCliJsonResult(stdout: string): ClaudeCliResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout.trim());
  } catch {
    // Shouldn't normally happen with --output-format json, but don't lose the output if it does.
    return { text: stdout.trim() };
  }
  const obj = parsed as Record<string, unknown>;
  if (obj.is_error) {
    throw new Error(typeof obj.result === "string" ? obj.result : "claude CLI reported an error.");
  }
  return {
    text: typeof obj.result === "string" ? obj.result : stdout.trim(),
    usage: parseCliUsage(obj.usage as Record<string, unknown> | undefined),
    costUsd: typeof obj.total_cost_usd === "number" ? obj.total_cost_usd : undefined,
  };
}

export async function callClaudeCli(
  prompt: string,
  system: string | undefined,
  account: ClaudeAccountId | undefined,
  // Required, not optional with a default: forces every call site to state what this call
  // actually needs, rather than silently inheriting whatever a given machine's own Claude Code
  // settings happen to auto-allow. "" denies all tools (confirmed empirically — Claude Code does
  // not fall back to interactive-approval-equivalent defaults in one-shot `-p` mode).
  allowedTools: string,
  // Grants file-tool (Read/Edit/etc.) access to a directory outside the default sandbox,
  // which is the project's own working directory tree — this is a *separate* permission
  // layer from `allowedTools`. Confirmed empirically: `--allowedTools Read` alone still
  // denies reading a file outside that tree (e.g. a temp file), the model gets a permission
  // error it has no way to self-resolve in non-interactive `-p` mode, and only `--add-dir`
  // actually grants the directory. See `callClaudeCliWithImage` for the real use case.
  addDir?: string
): Promise<ClaudeCliResult> {
  // --output-format json (instead of the default "text") wraps the answer in
  // a JSON envelope that also carries token usage and USD cost — otherwise
  // there's no way to report either back to the UI.
  const args = ["-p", prompt, "--output-format", "json", "--allowedTools", allowedTools];
  if (system) args.push("--system-prompt", system);
  if (addDir) args.push("--add-dir", addDir);

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
    return parseCliJsonResult(stdout);
  } catch (error) {
    throw new Error(describeExecFileError(error));
  }
}

/**
 * Streaming variant for the Narrator call. `execFile` only resolves once the
 * whole child process exits and buffers all of stdout, so it can't surface
 * incremental text — this uses `spawn` directly and parses
 * `--output-format stream-json` (requires `--verbose`), forwarding each
 * assistant text delta to `onDelta` as it arrives. Final text + usage/cost
 * come from the terminal `"result"` event, same envelope as the non-streaming
 * JSON mode.
 */
export async function callClaudeCliStreaming(
  prompt: string,
  system: string | undefined,
  account: ClaudeAccountId | undefined,
  onDelta: (chunk: string) => void,
  // See callClaudeCli's allowedTools doc comment — same reasoning, required not optional.
  allowedTools: string
): Promise<ClaudeCliResult> {
  const args = [
    "-p",
    prompt,
    "--output-format",
    "stream-json",
    "--include-partial-messages",
    "--verbose",
    "--allowedTools",
    allowedTools,
  ];
  if (system) args.push("--system-prompt", system);

  return new Promise<ClaudeCliResult>((resolve, reject) => {
    const child = spawn("claude", args, { env: envForAccount(account) });
    child.stdin.end();

    let buffer = "";
    let stderr = "";
    let result: ClaudeCliResult | null = null;
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, 60_000);

    function handleLine(line: string) {
      if (!line.trim()) return;
      let event: Record<string, unknown>;
      try {
        event = JSON.parse(line);
      } catch {
        return;
      }
      if (event.type === "stream_event") {
        const streamEvent = event.event as Record<string, unknown> | undefined;
        if (streamEvent?.type === "content_block_delta") {
          const delta = streamEvent.delta as Record<string, unknown> | undefined;
          if (delta?.type === "text_delta" && typeof delta.text === "string") {
            onDelta(delta.text);
          }
        }
      } else if (event.type === "result") {
        if (event.is_error) {
          stderr += typeof event.result === "string" ? event.result : "claude CLI reported an error.";
          return;
        }
        result = {
          text: typeof event.result === "string" ? event.result : "",
          usage: parseCliUsage(event.usage as Record<string, unknown> | undefined),
          costUsd: typeof event.total_cost_usd === "number" ? event.total_cost_usd : undefined,
        };
      }
    }

    child.stdout.on("data", (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) handleLine(line);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(new Error(describeExecFileError(Object.assign(error, { stderr }))));
    });

    child.on("close", (code, signal) => {
      clearTimeout(timer);
      if (buffer.trim()) handleLine(buffer);
      if (timedOut) {
        reject(new Error("claude CLI call timed out (60s) and was killed."));
        return;
      }
      if (result) {
        resolve(result);
        return;
      }
      reject(
        new Error(
          describeExecFileError(Object.assign(new Error(`claude CLI exited with code ${code}`), { code, signal, stderr }))
        )
      );
    });
  });
}

// Extensions Claude Code's own `Read` tool is expected to recognize as an image, matching
// the Python image-reader package's SUPPORTED_MIME_TYPES.
const IMAGE_MIME_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

function parseDataUrl(dataUrl: string): { mimeType: string; buffer: Buffer } {
  const match = dataUrl.match(/^data:([^;]+);base64,([\s\S]+)$/);
  if (!match) throw new Error("Expected a base64 image data URL (data:<mime-type>;base64,<data>).");
  return { mimeType: match[1], buffer: Buffer.from(match[2], "base64") };
}

/**
 * Lets a one-shot `claude -p` call "see" an image. `-p` mode has no flag or message
 * envelope for attaching binary content directly — `callClaudeCli` above only ever sends a
 * plain text prompt — but Claude Code's own `Read` tool already knows how to open an image
 * file and feed it to the model multimodally (the same mechanism that turns a pasted image
 * into `[Image #1]` in an interactive session).
 *
 * Two separate permission layers have to be granted for this, not one: `Read` must be in
 * `allowedTools` (the tool itself), *and* the directory holding the file must be passed via
 * `--add-dir` (file tools are sandboxed to the project's own working directory tree by
 * default — an unscoped `Read(<path>)` specifier in `allowedTools` does **not** grant this;
 * confirmed the hard way, a first attempt at exactly that left the model unable to open the
 * file and no way to self-resolve it in non-interactive mode). So this writes the image into
 * a freshly created, uniquely-named temp *directory* (not loose in the shared system temp
 * dir — keeps the `--add-dir` grant scoped to just this one call's file, not all of
 * `os.tmpdir()`), grants that one directory, instructs the model to read the file, then
 * removes the whole directory afterward regardless of outcome.
 */
export async function callClaudeCliWithImage(
  prompt: string,
  system: string | undefined,
  account: ClaudeAccountId | undefined,
  dataUrl: string
): Promise<ClaudeCliResult> {
  const { mimeType, buffer } = parseDataUrl(dataUrl);
  const extension = IMAGE_MIME_EXTENSIONS[mimeType];
  if (!extension) {
    const supported = Object.keys(IMAGE_MIME_EXTENSIONS).join(", ");
    throw new Error(`Unsupported image type for the Claude CLI backend: ${mimeType}. Supported: ${supported}`);
  }

  const tempDir = path.join(os.tmpdir(), `dasdk-image-reader-${randomUUID()}`);
  const tempPath = path.join(tempDir, `image.${extension}`);
  await mkdir(tempDir, { recursive: true });
  await writeFile(tempPath, buffer);

  try {
    const effectivePrompt = `Use the Read tool to open the image file at ${tempPath}, then respond to the following:\n\n${prompt}`;
    return await callClaudeCli(effectivePrompt, system, account, "Read", tempDir);
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
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
