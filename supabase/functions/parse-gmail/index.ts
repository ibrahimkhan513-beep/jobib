// Supabase Edge Function: parse-gmail
//
// Reads unread Gmail messages matching a workspace's filter rule, asks Groq
// to extract a structured requirement from each (or mark it as not a
// requirement), inserts genuine ones with origin_channel = 'gmail', and
// labels processed emails so they aren't re-scanned.
//
// Required secrets: GROQ_API_KEY, GROQ_MODEL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
// Deploy: supabase functions deploy parse-gmail

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { getValidGoogleToken } from "../_shared/google-token.ts";

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
const GROQ_MODEL = Deno.env.get("GROQ_MODEL") || "llama-3.3-70b-versatile";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PROCESSED_LABEL = "Jobib-Processed";

function decodeBase64Url(s: string) {
  return atob(s.replace(/-/g, "+").replace(/_/g, "/"));
}

function extractPlainTextBody(payload: any): string {
  if (payload.mimeType === "text/plain" && payload.body?.data) return decodeBase64Url(payload.body.data);
  if (payload.parts) {
    for (const part of payload.parts) {
      const text = extractPlainTextBody(part);
      if (text) return text;
    }
  }
  return "";
}

async function extractRequirementWithGroq(emailBody: string, sender: string, subject: string) {
  if (!GROQ_API_KEY) return { is_requirement: false };
  const resp = await fetch(GROQ_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Extract job requirement details from this email if present. Return ONLY JSON matching: " +
            '{"is_requirement": boolean, "job_title": string, "tech_stack": string[], "location": string, ' +
            '"rate_min": number|null, "rate_max": number|null, "client_hints": string, ' +
            '"am_contact_name": string|null, "am_contact_phone": string|null}. ' +
            "Set is_requirement to false for newsletters, spam, marketing, or anything that isn't a specific job opening.",
        },
        { role: "user", content: `FROM: ${sender}\nSUBJECT: ${subject}\n\nBODY:\n${emailBody.slice(0, 6000)}` },
      ],
    }),
  });
  if (!resp.ok) return { is_requirement: false };
  try {
    return JSON.parse((await resp.json()).choices[0].message.content);
  } catch {
    return { is_requirement: false };
  }
}

async function gmailApi(path: string, accessToken: string, init?: RequestInit) {
  return fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
}

async function ensureProcessedLabel(accessToken: string): Promise<string | null> {
  const listResp = await gmailApi("labels", accessToken);
  if (listResp.ok) {
    const { labels } = await listResp.json();
    const existing = labels?.find((l: any) => l.name === PROCESSED_LABEL);
    if (existing) return existing.id;
  }
  const createResp = await gmailApi("labels", accessToken, {
    method: "POST",
    body: JSON.stringify({ name: PROCESSED_LABEL, labelListVisibility: "labelShow", messageListVisibility: "show" }),
  });
  if (createResp.ok) return (await createResp.json()).id;
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json();
    const workspaceId: string = body.workspace_id;
    if (!workspaceId) {
      return new Response(JSON.stringify({ error: "workspace_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const google = await getValidGoogleToken(supabaseAdmin, workspaceId, "gmail");
    if (!google) {
      return new Response(JSON.stringify({ error: "Gmail is not connected for this workspace" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: configRow } = await supabaseAdmin
      .from("integration_configs")
      .select("config")
      .eq("workspace_id", workspaceId)
      .eq("integration_type", "gmail")
      .maybeSingle();
    const filterRule: string = (configRow?.config as any)?.filter_rule || "is:unread -label:" + PROCESSED_LABEL;
    const fullQuery = filterRule.includes(PROCESSED_LABEL) ? filterRule : `${filterRule} -label:${PROCESSED_LABEL}`;

    const labelId = await ensureProcessedLabel(google.accessToken);

    const listResp = await gmailApi(`messages?q=${encodeURIComponent(fullQuery)}&maxResults=20`, google.accessToken);
    if (!listResp.ok) {
      await supabaseAdmin.from("sync_logs").insert({
        workspace_id: workspaceId, integration_type: "gmail", records_processed: 0, records_added: 0,
        status: "failed", error_message: `Gmail list failed: HTTP ${listResp.status}`,
      });
      return new Response(JSON.stringify({ error: "Gmail message list failed" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { messages = [] } = await listResp.json();

    let extracted = 0;
    let skipped = 0;
    const previews: any[] = [];

    for (const msg of messages) {
      const detailResp = await gmailApi(`messages/${msg.id}?format=full`, google.accessToken);
      if (!detailResp.ok) continue;
      const detail = await detailResp.json();
      const headers = detail.payload?.headers ?? [];
      const subject = headers.find((h: any) => h.name === "Subject")?.value ?? "(no subject)";
      const from = headers.find((h: any) => h.name === "From")?.value ?? "unknown";
      const bodyText = extractPlainTextBody(detail.payload) || detail.snippet || "";

      const result = await extractRequirementWithGroq(bodyText, from, subject);

      if (result.is_requirement) {
        await supabaseAdmin.from("requirements").insert({
          workspace_id: workspaceId,
          title: result.job_title || subject,
          vendor_name: from,
          client_masked: result.client_hints || null,
          tech_stack: result.tech_stack ?? [],
          location_city: result.location || null,
          rate_min: result.rate_min ?? null,
          rate_max: result.rate_max ?? null,
          source_type: "tier1",
          origin_channel: "gmail",
          jd_text: bodyText.slice(0, 5000),
          am_name: result.am_contact_name || null,
          am_phone: result.am_contact_phone || null,
          posted_date: new Date().toISOString().slice(0, 10),
          req_score: 50,
          status: "new",
        });
        extracted++;
        previews.push({ subject, from, extracted: result });
      } else {
        skipped++;
      }

      if (labelId) {
        await gmailApi(`messages/${msg.id}/modify`, google.accessToken, {
          method: "POST",
          body: JSON.stringify({ addLabelIds: [labelId] }),
        });
      }
    }

    await supabaseAdmin.from("sync_logs").insert({
      workspace_id: workspaceId,
      integration_type: "gmail",
      records_processed: messages.length,
      records_added: extracted,
      status: "success",
      error_message: null,
    });

    return new Response(
      JSON.stringify({ scanned: messages.length, extracted, skipped, previews: previews.slice(0, 5) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
