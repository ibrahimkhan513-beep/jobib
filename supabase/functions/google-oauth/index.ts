// Supabase Edge Function: google-oauth
//
// Handles the Google OAuth flow shared by Google Sheets sync + Gmail parser.
// One consent screen, two scopes — exactly as planned in the build doc.
//
// Flow:
//   1. Frontend calls this function with action="start" to get the Google
//      consent URL, opens it in a popup/new tab.
//   2. Google redirects to GOOGLE_REDIRECT_URI (this same function,
//      action="callback") with a ?code=... param.
//   3. This function exchanges the code for access+refresh tokens and
//      stores them in integration_configs.config (server-side only —
//      the frontend never sees the raw tokens).
//
// Required secrets:
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI
//
// Required scopes requested:
//   https://www.googleapis.com/auth/spreadsheets
//   https://www.googleapis.com/auth/gmail.readonly
//
// Deploy: supabase functions deploy google-oauth

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
const GOOGLE_REDIRECT_URI = Deno.env.get("GOOGLE_REDIRECT_URI")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/gmail.readonly"];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || (await req.json().catch(() => ({})))?.action;

  try {
    // --- Step 1: build the consent URL for the frontend to redirect to ---
    if (action === "start") {
      const authHeader = req.headers.get("Authorization");
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        global: { headers: { Authorization: authHeader ?? "" } },
      });
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        return new Response(JSON.stringify({ error: "Not authenticated" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Pass the user id through `state` so the callback (which Google
      // calls directly, with no Supabase session attached) knows which
      // workspace to attach the tokens to.
      const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: GOOGLE_REDIRECT_URI,
        response_type: "code",
        scope: SCOPES.join(" "),
        access_type: "offline",
        prompt: "consent",
        state: userData.user.id,
      });
      return new Response(JSON.stringify({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Step 2: Google redirects here with ?code=...&state=<userId> ---
    if (action === "callback" || url.searchParams.get("code")) {
      const code = url.searchParams.get("code");
      const userId = url.searchParams.get("state");
      if (!code || !userId) {
        return new Response("Missing code or state", { status: 400 });
      }

      const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: GOOGLE_REDIRECT_URI,
          grant_type: "authorization_code",
        }),
      });
      const tokens = await tokenResp.json();
      if (!tokenResp.ok) {
        return new Response(`Token exchange failed: ${JSON.stringify(tokens)}`, { status: 502 });
      }

      // Identify the user's email for display purposes (not security-critical).
      let email = "connected";
      try {
        const profileResp = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        if (profileResp.ok) email = (await profileResp.json()).email ?? email;
      } catch {
        // non-fatal — email display is cosmetic only
      }

      const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const { data: profile } = await supabaseAdmin.from("profiles").select("workspace_id").eq("id", userId).maybeSingle();
      if (!profile) return new Response("No workspace found", { status: 400 });

      const tokenPayload = {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token, // only present on first consent; preserved across re-auths below
        expires_at: Date.now() + tokens.expires_in * 1000,
        email,
      };

      // Upsert for both integration types since they share one Google connection.
      for (const type of ["google_sheets", "gmail"] as const) {
        const { data: existingRow } = await supabaseAdmin
          .from("integration_configs")
          .select("config")
          .eq("workspace_id", profile.workspace_id)
          .eq("integration_type", type)
          .maybeSingle();

        const mergedConfig = {
          ...(existingRow?.config as object ?? {}),
          ...tokenPayload,
          // Don't overwrite a previously-issued refresh_token with `undefined`
          // if Google didn't re-issue one on this consent.
          refresh_token: tokens.refresh_token ?? (existingRow?.config as any)?.refresh_token,
        };

        await supabaseAdmin.from("integration_configs").upsert(
          { workspace_id: profile.workspace_id, integration_type: type, enabled: true, config: mergedConfig },
          { onConflict: "workspace_id,integration_type" },
        );
      }

      // Redirect back into the app's Integrations page.
      const appUrl = Deno.env.get("APP_URL") || "/";
      return new Response(null, { status: 302, headers: { Location: `${appUrl}/integrations?connected=google` } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
