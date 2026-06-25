// Shared helper used by sync-to-sheets and parse-gmail.
// Resolves a workspace's stored Google OAuth token, transparently
// refreshing it via the refresh_token if the access_token has expired.
// Google access tokens last ~1 hour, so this runs on every invocation.

// deno-lint-ignore-file no-explicit-any
import { createClient } from "jsr:@supabase/supabase-js@2";

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

export async function getValidGoogleToken(
  supabaseAdmin: ReturnType<typeof createClient>,
  workspaceId: string,
  integrationType: "google_sheets" | "gmail",
): Promise<{ accessToken: string; email: string } | null> {
  const { data: row } = await supabaseAdmin
    .from("integration_configs")
    .select("config, enabled")
    .eq("workspace_id", workspaceId)
    .eq("integration_type", integrationType)
    .maybeSingle();

  const config = row?.config as any;
  if (!row?.enabled || !config?.refresh_token) return null;

  // Still valid for at least another 60s — reuse it.
  if (config.access_token && config.expires_at && config.expires_at > Date.now() + 60_000) {
    return { accessToken: config.access_token, email: config.email ?? "" };
  }

  // Expired (or about to expire) — refresh it.
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: config.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  if (!resp.ok) return null;
  const tokens = await resp.json();

  const newConfig = {
    ...config,
    access_token: tokens.access_token,
    expires_at: Date.now() + tokens.expires_in * 1000,
  };
  await supabaseAdmin
    .from("integration_configs")
    .update({ config: newConfig })
    .eq("workspace_id", workspaceId)
    .eq("integration_type", integrationType);

  return { accessToken: tokens.access_token, email: config.email ?? "" };
}
