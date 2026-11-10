"use client";

import { useEffect, useState } from "react";
import { useApiKey } from "@/lib/use-api-key";
import { DEFAULT_MODELS } from "@/lib/providers";

export type ClaudeAccount = { id: string; label: string };

// Client-safe mirror of the `Backend` type in sdk/src/lib/model-backend.ts — that file imports
// node:child_process (via claude-cli.ts) and can't be imported from "use client" code.
export type ModelBackend =
  | { type: "provider"; providerId: "google" | "anthropic" | "openai"; apiKey: string; model: string }
  | { type: "claude-cli"; account?: string };

/**
 * Shared "which model backend to use" state: provider key (via the connected credential) or the
 * local Claude Code CLI dev-bridge (detected via /api/claude-cli-status, never available in
 * production). Originally built inline in Diver's agent session; componentized so every agent gets
 * the same backend choice instead of each reimplementing it.
 */
export function useModelBackend() {
  const { credential } = useApiKey();
  const [claudeCliStatus, setClaudeCliStatus] = useState<"checking" | "available" | "unavailable">("checking");
  const [claudeAccounts, setClaudeAccounts] = useState<ClaudeAccount[]>([]);
  const [claudeAccountId, setClaudeAccountId] = useState<string | null>(null);
  const [backendChoice, setBackendChoice] = useState<"claude-cli" | "provider" | null>(null);

  useEffect(() => {
    fetch("/api/claude-cli-status")
      .then((res) => res.json())
      .then((data: { available: boolean; accounts: ClaudeAccount[] }) => {
        setClaudeCliStatus(data.available ? "available" : "unavailable");
        setClaudeAccounts(data.accounts);
        setClaudeAccountId((current) => current ?? data.accounts[0]?.id ?? null);
      })
      .catch(() => setClaudeCliStatus("unavailable"));
  }, []);

  const claudeCliAvailable = claudeCliStatus === "available";
  const effectiveBackend = backendChoice ?? (claudeCliAvailable ? "claude-cli" : credential ? "provider" : null);
  const backendReady =
    effectiveBackend === "claude-cli" ? claudeCliAvailable : effectiveBackend === "provider" ? Boolean(credential) : false;

  const backend: ModelBackend | null =
    effectiveBackend === "claude-cli"
      ? { type: "claude-cli", account: claudeAccountId ?? undefined }
      : effectiveBackend === "provider" && credential
        ? { type: "provider", providerId: credential.providerId, apiKey: credential.apiKey, model: DEFAULT_MODELS[credential.providerId] }
        : null;

  return {
    credential,
    claudeCliStatus,
    claudeCliAvailable,
    claudeAccounts,
    claudeAccountId,
    setClaudeAccountId,
    backendChoice,
    setBackendChoice,
    effectiveBackend,
    backendReady,
    backend,
  };
}

export type UseModelBackendResult = ReturnType<typeof useModelBackend>;
