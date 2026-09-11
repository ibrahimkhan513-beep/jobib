import { supabase } from "@/integrations/supabase/client";

export interface SyncResult {
  synced: boolean;
  count: number;
  message: string;
}

/**
 * Automatically syncs requirements to the user's connected Google Sheet.
 * Checks both Google OAuth (Direct Sheets API v4) and Google Apps Script Webhook.
 */
export async function syncRequirementsToGoogleSheet(
  reqRows: Array<{
    title: string;
    vendor_name?: string | null;
    client_masked?: string | null;
    tech_stack?: string[] | null;
    location_city?: string | null;
    location_state?: string | null;
    rate_min?: number | null;
    rate_max?: number | null;
    source_type?: string | null;
    req_score?: number | null;
    status?: string | null;
    posted_date?: string | null;
    am_name?: string | null;
    am_phone?: string | null;
    am_email?: string | null;
  }>
): Promise<SyncResult> {
  if (!reqRows || reqRows.length === 0) {
    return { synced: false, count: 0, message: "No requirements to sync" };
  }

  try {
    const { data: me } = await supabase.auth.getUser();
    const userId = me.user?.id;
    const { data: profile } = await supabase
      .from("profiles")
      .select("workspace_id")
      .eq("id", userId!)
      .maybeSingle();

    if (!profile) {
      return { synced: false, count: 0, message: "No workspace found" };
    }

    // Fetch Google Sheets integration config
    const { data: configRow } = await supabase
      .from("integration_configs")
      .select("*")
      .eq("workspace_id", profile.workspace_id)
      .eq("integration_type", "google_sheets")
      .maybeSingle();

    const cfg = (configRow?.config ?? {}) as Record<string, any>;
    const isEnabled = configRow?.enabled ?? false;

    // 1. Direct Google Sheets API v4 (via user's OAuth access token)
    if (cfg.access_token && cfg.sheet_id) {
      const rows = reqRows.map((r) => [
        r.title,
        r.client_masked || r.vendor_name || "Direct Client",
        (r.tech_stack ?? []).join(", "),
        [r.location_city, r.location_state].filter(Boolean).join(", ") || "Remote/Unspecified",
        r.rate_max ? `$${r.rate_min ? `${r.rate_min}-$` : ""}${r.rate_max}/hr` : "Open",
        r.source_type || "tier1",
        r.req_score ?? 85,
        [r.am_name, r.am_phone, r.am_email].filter(Boolean).join(" / ") || "Recruiter Desk",
        r.posted_date || new Date().toISOString().slice(0, 10),
        r.status || "new",
      ]);

      const appendRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${cfg.sheet_id}/values/Sheet1!A1:append?valueInputOption=USER_ENTERED`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${cfg.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ values: rows }),
        }
      );

      if (appendRes.ok) {
        // Log sync activity
        await supabase.from("sync_logs").insert({
          workspace_id: profile.workspace_id,
          integration_type: "google_sheets",
          records_processed: reqRows.length,
          records_added: reqRows.length,
          status: "success",
        });

        return {
          synced: true,
          count: reqRows.length,
          message: `Auto-synced ${reqRows.length} jobs to Google Sheet!`,
        };
      }
    }

    // 2. Google Apps Script Webhook
    if (cfg.webhook_url && cfg.webhook_url.trim()) {
      const payload = {
        action: "sync_requirements",
        requirements: reqRows.map((r) => ({
          title: r.title,
          client: r.client_masked || r.vendor_name || "Direct Client",
          stack: (r.tech_stack ?? []).join(", "),
          location: [r.location_city, r.location_state].filter(Boolean).join(", "),
          rate: r.rate_max ? `$${r.rate_min ? `${r.rate_min}-$` : ""}${r.rate_max}/hr` : "",
          score: r.req_score ?? 85,
          source: r.source_type || "tier1",
          status: r.status || "new",
          date: r.posted_date || new Date().toISOString().slice(0, 10),
          contact: [r.am_name, r.am_phone, r.am_email].filter(Boolean).join(" / "),
        })),
      };

      await fetch(cfg.webhook_url.trim(), {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      await supabase.from("sync_logs").insert({
        workspace_id: profile.workspace_id,
        integration_type: "google_sheets",
        records_processed: reqRows.length,
        records_added: reqRows.length,
        status: "success",
      });

      return {
        synced: true,
        count: reqRows.length,
        message: `Auto-synced ${reqRows.length} jobs via Google Sheet Webhook!`,
      };
    }

    // 3. Fallback / Edge function invoke
    try {
      await supabase.functions.invoke("sync-to-sheets", {
        body: { workspace_id: profile.workspace_id },
      });
    } catch {
      // ignore
    }

    return {
      synced: false,
      count: reqRows.length,
      message: "Requirements saved to database. Google Sheets not connected yet.",
    };
  } catch (err: any) {
    console.warn("Auto-sync error:", err);
    return {
      synced: false,
      count: 0,
      message: err.message || "Auto-sync to Google Sheet encountered an issue.",
    };
  }
}
