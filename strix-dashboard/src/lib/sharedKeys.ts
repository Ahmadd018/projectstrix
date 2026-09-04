// Shared (admin-provided) LLM API keys. The Super Admin stores a set of keys on
// the AppSettings singleton and toggles them on for everyone; each user opts in
// per provider (UserSettings.sharedKeyProviders). When opted in, the shared key
// overrides the user's own for that provider.
import { prisma } from "./prisma";
import { readApiKeys } from "./apiKeys";

export const APP_SETTINGS_ID = "singleton";

export function parseOptIn(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

// Merge a user's own keys with the shared keys they've opted into. Own keys are
// the base; opted-in shared providers override. Returns a plain provider→key map.
export async function getEffectiveApiKeys(
  userId: string,
  ownStored: string | null | undefined,
): Promise<Record<string, string>> {
  const own = readApiKeys(ownStored);

  const app = await prisma.appSettings.findUnique({ where: { id: APP_SETTINGS_ID } });
  if (!app || !app.sharedKeysEnabled || !app.sharedApiKeys) return own;

  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  const optIn = parseOptIn(settings?.sharedKeyProviders);
  if (optIn.length === 0) return own;

  const shared = readApiKeys(app.sharedApiKeys);
  const merged = { ...own };
  for (const provider of optIn) {
    if (shared[provider]) merged[provider] = shared[provider];
  }
  return merged;
}

// Which providers a shared key is available for (only when the feature is on).
export async function getSharedKeyAvailability(): Promise<{ enabled: boolean; available: string[] }> {
  const app = await prisma.appSettings.findUnique({ where: { id: APP_SETTINGS_ID } });
  if (!app || !app.sharedKeysEnabled || !app.sharedApiKeys) return { enabled: false, available: [] };
  const shared = readApiKeys(app.sharedApiKeys);
  return { enabled: true, available: Object.keys(shared).filter((p) => shared[p]) };
}
