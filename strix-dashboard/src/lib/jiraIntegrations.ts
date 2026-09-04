// Shared helpers for the multi-config Jira integration system.
// An integration is either a superadmin-"streamed" shared preset (shared=true,
// ownerId=null) or a user-created private config (ownerId=<user>). Users opt into
// shared presets via a UserJiraIntegration row ("accept"); they always have their
// own configs available.

// The primary "admin" account is the Super Admin (see users/[id] role route).
// Only it may create/share presets and manage shared API keys.
export function isSuperAdmin(session: { username?: string } | null): boolean {
  return !!session && session.username === "admin";
}

// Strip secrets before sending an integration to the browser. `enabled` reflects
// whether the requesting user has opted in (for shared presets).
export function safeIntegration(
  integration: any,
  opts: { enabled?: boolean; mine?: boolean } = {},
): any {
  const { authSecret, ...rest } = integration || {};
  return {
    id: rest.id,
    name: rest.name,
    deployment: rest.deployment,
    baseUrl: rest.baseUrl,
    authEmail: rest.authEmail || "",
    projectId: rest.projectId || "",
    issueTypeId: rest.issueTypeId || "",
    config: rest.config || null,
    shared: !!rest.shared,
    ownerId: rest.ownerId ?? null,
    hasSecret: !!authSecret,
    enabled: !!opts.enabled,
    mine: !!opts.mine,
  };
}

export type IntegrationAccess = { integration: any; error?: never } | { integration?: never; error: string; status: number };
