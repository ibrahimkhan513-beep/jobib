// Supabase Edge Function: sync-to-sheets
//
// Pushes requirement rows into a workspace's configured Google Sheet.
// Called either:
//   - Manually via "Run now" / "Sync Now" in the Integrations Hub
//   - From a Postgres trigger (via pg_net) on INSERT/UPDATE to `requirements`
//     — see the trigger SQL in the migration file for this sprint.
//
// Column layout (matches the build doc's mapping):
//   A Job Title, B Client/Vendor, C Tech Stack, D Location, E Rate,
//   F Source Type, G Req-Score, H AM Contact, I Posted Date, J Status,
//   K Origin Channel, L Requirement ID (hidden helper column used to find
//   the right row again on status updates — not in the original spec but
//   necessary to support "sync on status update" without duplicating rows)
//
// Required secrets: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
// Deploy: supabase functions deploy sync-to-sheets

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { getValidGoogleToken } from "../_shared/google-token.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const HEADER_ROW = [
  "Job Title", "Client/Vendor", "Tech Stack", "Location", "Rate",
  "Source Type", "Req-Score", "AM Contact", "Posted Date", "Status", "Origin Channel", "Requirement ID",
];

function reqToRow(r: any) {
  return [
    r.title, r.client_masked ?? r.vendor_name ?? "", (r.tech_stack ?? []).join(", "),
    [r.location_city, r.location_state].filter(Boolean).join(", "),
    r.rate_min && r.rate_max ? `$${r.rate_min}-${r.rate_max}/hr` : "",
    r.source_type, r.req_score, [r.am_name, r.am_phone].filter(Boolean).join(" / "),
    r.posted_date ?? "", r.status, r.origin_channel ?? "manual", r.id,
  ];
}

async function sheetsApi(path: string, accessToken: string, init?: RequestInit) {
  return fetch(`https://sheets.googleapis.com/v4/spreadsheets/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json();
    const workspaceId: string = body.workspace_id;
    const requirementIds: string[] | undefined = body.requirement_ids; // optional — sync just these rows

    if (!workspaceId) {
      return new Response(JSON.stringify({ error: "workspace_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const google = await getValidGoogleToken(supabaseAdmin, workspaceId, "google_sheets");
    if (!google) {
      return new Response(JSON.stringify({ error: "Google Sheets is not connected for this workspace" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- action: create-sheet — used by the "Create new" button in the UI ---
    if (body.action === "create-sheet") {
      const createResp = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
        method: "POST",
        headers: { Authorization: `Bearer ${google.accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          properties: { title: "Jobib — Requirements" },
          sheets: [{ properties: { title: "Sheet1" } }],
        }),
      });
      if (!createResp.ok) {
        return new Response(JSON.stringify({ error: "Failed to create sheet", details: await createResp.text() }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const created = await createResp.json();
      const { data: existingRow } = await supabaseAdmin
        .from("integration_configs")
        .select("config")
        .eq("workspace_id", workspaceId)
        .eq("integration_type", "google_sheets")
        .maybeSingle();
      await supabaseAdmin.from("integration_configs").upsert(
        {
          workspace_id: workspaceId,
          integration_type: "google_sheets",
          enabled: true,
          config: { ...(existingRow?.config as object ?? {}), sheet_id: created.spreadsheetId },
        },
        { onConflict: "workspace_id,integration_type" },
      );
      await sheetsApi(`${created.spreadsheetId}/values/Sheet1!A1:L1?valueInputOption=RAW`, google.accessToken, {
        method: "PUT",
        body: JSON.stringify({ values: [HEADER_ROW] }),
      });
      return new Response(
        JSON.stringify({ sheet_id: created.spreadsheetId, url: created.spreadsheetUrl }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: configRow } = await supabaseAdmin
      .from("integration_configs")
      .select("config")
      .eq("workspace_id", workspaceId)
      .eq("integration_type", "google_sheets")
      .maybeSingle();
    const sheetId = (configRow?.config as any)?.sheet_id;
    if (!sheetId) {
      return new Response(JSON.stringify({ error: "No sheet_id configured — create or link a sheet first" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let reqsQuery = supabaseAdmin.from("requirements").select("*").eq("workspace_id", workspaceId);
    if (requirementIds?.length) reqsQuery = reqsQuery.in("id", requirementIds);
    const { data: requirements, error: reqErr } = await reqsQuery;
    if (reqErr) throw reqErr;

    // Read existing sheet rows so we can update-in-place by Requirement ID
    // (column L) instead of always appending duplicates on status changes.
    const readResp = await sheetsApi(`${sheetId}/values/Sheet1!A1:L?majorDimension=ROWS`, google.accessToken);
    const existingData = readResp.ok ? await readResp.json() : { values: [] };
    const existingRows: string[][] = existingData.values ?? [];
    const idToRowIndex = new Map<string, number>();
    existingRows.forEach((row, i) => {
      if (i === 0) return; // header
      const id = row[11];
      if (id) idToRowIndex.set(id, i + 1); // 1-indexed for Sheets API
    });

    if (existingRows.length === 0) {
      await sheetsApi(`${sheetId}/values/Sheet1!A1:L1?valueInputOption=RAW`, google.accessToken, {
        method: "PUT",
        body: JSON.stringify({ values: [HEADER_ROW] }),
      });
    }

    const toAppend: any[][] = [];
    const updates: { range: string; values: any[][] }[] = [];

    for (const r of requirements ?? []) {
      const row = reqToRow(r);
      const existingRowNum = idToRowIndex.get(r.id);
      if (existingRowNum) {
        updates.push({ range: `Sheet1!A${existingRowNum}:L${existingRowNum}`, values: [row] });
      } else {
        toAppend.push(row);
      }
    }

    let syncFailed = false;
    if (toAppend.length > 0) {
      const appendResp = await sheetsApi(
        `${sheetId}/values/Sheet1!A1:L1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
        google.accessToken,
        { method: "POST", body: JSON.stringify({ values: toAppend }) },
      );
      if (!appendResp.ok) syncFailed = true;
    }
    if (updates.length > 0) {
      const batchResp = await sheetsApi(`${sheetId}/values:batchUpdate`, google.accessToken, {
        method: "POST",
        body: JSON.stringify({ valueInputOption: "RAW", data: updates }),
      });
      if (!batchResp.ok) syncFailed = true;
    }

    const syncedIds = (requirements ?? []).map((r: any) => r.id);
    if (syncedIds.length > 0) {
      await supabaseAdmin
        .from("requirements")
        .update({ sheet_sync_status: syncFailed ? "failed" : "synced" })
        .in("id", syncedIds);
    }

    await supabaseAdmin.from("sync_logs").insert({
      workspace_id: workspaceId,
      integration_type: "google_sheets",
      records_processed: requirements?.length ?? 0,
      records_added: toAppend.length,
      status: syncFailed ? "failed" : "success",
      error_message: syncFailed ? "Sheets API call failed — check token/permissions" : null,
    });

    return new Response(
      JSON.stringify({ appended: toAppend.length, updated: updates.length, failed: syncFailed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
