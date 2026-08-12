import { encryptSecret, decryptSecret } from "./crypto";

// M-5: Centralized read/write of the per-user encrypted API-key blob.
// Handles both the new encrypted form and any pre-existing plaintext values.

// Providers the scan orchestrator knows how to resolve. Anything else is dropped.
export const KNOWN_PROVIDERS = [
  "openai",
  "anthropic",
  "gemini",
  "deepseek",
  "groq",
  "openrouter",
  "mistral",
  "cohere",
  "dashscope",
  "moonshot",
  "vertex_ai",
] as const;

const MAX_KEY_LENGTH = 512;

export function readApiKeys(stored: string | null | undefined): Record<string, string> {
  if (!stored) return {};
  try {
    const obj = JSON.parse(decryptSecret(stored));
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      return obj as Record<string, string>;
    }
  } catch {
    // corrupt payload or key mismatch → treat as no keys
  }
  return {};
}

export function serializeApiKeys(keys: Record<string, string>): string {
  return encryptSecret(JSON.stringify(keys));
}

// Validate + normalize a client-supplied key map (L-2): only known providers,
// only non-empty strings, and enforce a per-key length cap.
export function sanitizeApiKeyInput(body: unknown): { ok: true; keys: Record<string, string> } | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Body must be an object of provider → key" };
  }
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
    if (!(KNOWN_PROVIDERS as readonly string[]).includes(k)) continue;
    if (typeof v !== "string") continue;
    if (v.length > MAX_KEY_LENGTH) {
      return { ok: false, error: `API key for '${k}' exceeds ${MAX_KEY_LENGTH} characters` };
    }
    const trimmed = v.trim();
    if (trimmed.length > 0) clean[k] = trimmed;
  }
  return { ok: true, keys: clean };
}
