export type ProviderId = "google" | "anthropic" | "openai";

export type ProviderDefinition = {
  id: ProviderId;
  label: string;
  keyPlaceholder: string;
  getKeyUrl: string;
  supportsNativeSearch: boolean;
};

export const PROVIDERS: ProviderDefinition[] = [
  {
    id: "google",
    label: "Google (Gemini)",
    keyPlaceholder: "AIza...",
    getKeyUrl: "https://aistudio.google.com/apikey",
    supportsNativeSearch: true,
  },
  {
    id: "anthropic",
    label: "Anthropic (Claude)",
    keyPlaceholder: "sk-ant-...",
    getKeyUrl: "https://console.anthropic.com/settings/keys",
    supportsNativeSearch: true,
  },
  {
    id: "openai",
    label: "OpenAI",
    keyPlaceholder: "sk-...",
    getKeyUrl: "https://platform.openai.com/api-keys",
    supportsNativeSearch: true,
  },
];

export function getProvider(id: ProviderId) {
  return PROVIDERS.find((provider) => provider.id === id);
}
