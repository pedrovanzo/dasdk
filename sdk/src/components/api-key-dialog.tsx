"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PROVIDERS, getProvider, type ProviderId } from "@/lib/providers";
import { useApiKey } from "@/lib/use-api-key";

export function ApiKeyDialog() {
  const { credential, setCredential, clearCredential } = useApiKey();
  const [open, setOpen] = useState(false);
  const [providerId, setProviderId] = useState<ProviderId>(credential?.providerId ?? "google");
  const [apiKey, setApiKey] = useState(credential?.apiKey ?? "");

  const provider = getProvider(providerId);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setProviderId(credential?.providerId ?? "google");
      setApiKey(credential?.apiKey ?? "");
    }
  }

  function handleSave() {
    if (!apiKey.trim()) return;
    setCredential({ providerId, apiKey: apiKey.trim() });
    setOpen(false);
  }

  function handleClear() {
    clearCredential();
    setApiKey("");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button variant={credential ? "secondary" : "default"} size="sm" nativeButton>
            {credential
              ? `Connected: ${getProvider(credential.providerId)?.label}`
              : "Connect model key"}
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect your model key</DialogTitle>
          <DialogDescription>
            Stored only in this browser&apos;s local storage. Never sent anywhere except the
            request you trigger — this app has no server-held keys.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="provider">Provider</Label>
            <Select value={providerId} onValueChange={(value) => setProviderId(value as ProviderId)}>
              <SelectTrigger id="provider" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROVIDERS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="apiKey">API key</Label>
            <Input
              id="apiKey"
              type="password"
              placeholder={provider?.keyPlaceholder}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              autoComplete="off"
            />
            {provider && (
              <a
                href={provider.getKeyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                Get a free {provider.label} key
              </a>
            )}
          </div>
        </div>

        <DialogFooter>
          {credential && (
            <Button variant="ghost" nativeButton onClick={handleClear}>
              Disconnect
            </Button>
          )}
          <Button nativeButton onClick={handleSave} disabled={!apiKey.trim()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
