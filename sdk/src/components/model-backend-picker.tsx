"use client";

import { ApiKeyDialog } from "@/components/api-key-dialog";
import type { UseModelBackendResult } from "@/lib/use-model-backend";

/** Presentational radio group for choosing between the Claude Code CLI subscription and a connected provider key. Pair with `useModelBackend()`. */
export function ModelBackendPicker({ model }: { model: UseModelBackendResult }) {
  const {
    credential,
    claudeCliStatus,
    claudeCliAvailable,
    claudeAccounts,
    claudeAccountId,
    setClaudeAccountId,
    effectiveBackend,
    setBackendChoice,
  } = model;

  return (
    <div className="flex flex-col gap-1.5 rounded-md border p-3 text-sm">
      <span className="font-medium">Model backend</span>
      {claudeCliStatus === "checking" && (
        <span className="text-muted-foreground">Checking for a local Claude Code session...</span>
      )}
      {claudeCliStatus !== "checking" && (
        <div className="flex flex-col gap-1">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="backend"
              disabled={!claudeCliAvailable}
              checked={effectiveBackend === "claude-cli"}
              onChange={() => setBackendChoice("claude-cli")}
            />
            <span className={claudeCliAvailable ? "" : "text-muted-foreground"}>
              My Claude Code subscription {claudeCliAvailable ? "(detected)" : "(not detected locally)"}
            </span>
          </label>
          {effectiveBackend === "claude-cli" && claudeAccounts.length > 1 && (
            <div className="ml-6 flex flex-col gap-1 border-l pl-3">
              {claudeAccounts.map((account) => (
                <label key={account.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="claude-account"
                    checked={claudeAccountId === account.id}
                    onChange={() => setClaudeAccountId(account.id)}
                  />
                  <span>{account.label}</span>
                </label>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="backend"
                disabled={!credential}
                checked={effectiveBackend === "provider"}
                onChange={() => setBackendChoice("provider")}
              />
              <span className={credential ? "" : "text-muted-foreground"}>
                Connected provider key {credential ? `(${credential.providerId})` : "(none connected)"}
              </span>
            </label>
            <ApiKeyDialog />
          </div>
        </div>
      )}
      {claudeCliStatus === "unavailable" && !credential && (
        <span className="text-xs text-muted-foreground">
          No local Claude Code session found and no key connected — connect one above, or run{" "}
          <code>claude</code> locally and make sure you&apos;re logged in.
        </span>
      )}
    </div>
  );
}
