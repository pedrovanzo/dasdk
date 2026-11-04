"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { ProviderId } from "@/lib/providers";

export type Credential = {
  providerId: ProviderId;
  apiKey: string;
};

const STORAGE_KEY = "dasdk.credential";
const CHANGE_EVENT = "dasdk:credential-change";

let cachedRaw: string | null = null;
let cachedCredential: Credential | null = null;

function getSnapshot(): Credential | null {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === cachedRaw) return cachedCredential;
  cachedRaw = raw;
  try {
    cachedCredential = raw ? (JSON.parse(raw) as Credential) : null;
  } catch {
    cachedCredential = null;
  }
  return cachedCredential;
}

function getServerSnapshot(): Credential | null {
  return null;
}

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

/**
 * Never sent anywhere but the per-request proxy call the user triggers.
 * Lives only in this browser's localStorage — no server, no cookies.
 */
export function useApiKey() {
  const credential = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setCredential = useCallback((next: Credential) => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  const clearCredential = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return { credential, setCredential, clearCredential };
}
