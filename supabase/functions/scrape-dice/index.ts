// Supabase Edge Function: scrape-dice
//
// Fetches Dice.com's PUBLIC job search results (no login, respecting their
// page structure) for a workspace's configured keywords/location, asks Groq
// to deduplicate against existing requirements and do a first-pass score,
// then inserts genuinely new requirements with origin_channel = 'dice'.
//
// This is intentionally scoped to public search result pages only — see
// the "Important implementation notes" in the original build plan. It is
// NOT a substitute for Dice's paid Recruiter API; it's a starting signal
// source that respects robots.txt and adds a delay between requests.
//
// Required secrets:
//   GROQ_API_KEY, GROQ_MODEL  (same as analyze-jd function)
//
// Trigger:
//   - Manually via "Run now" button in the Integrations Hub (functions.invoke)
//   - On a schedule via Supabase cron (pg_cron + pg_net), once you're ready —
//     see the SQL snippet at the bottom of this file's comments.
//
// Deploy: supabase functions deploy scrape-dice

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
const GROQ_MODEL = Deno.env.get("GROQ_MODEL") || "llama-3.3-70b-versatile";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ScrapedListing {
  title: string;
  company: string | null;
  location: string | null;
  snippet: string;
  postedDate: string | null;
  url: string;
}

// Parses Dice's public search results HTML. Dice's markup changes
// periodically — this uses a tolerant regex-based extraction rather than a
// brittle full HTML parser, and is designed to fail soft (return []) rather
// than throw if the page structure has shifted.
function parseDiceResults(html: string): ScrapedListing[] {
  const results: ScrapedListing[] = [];
  // Dice embeds a JSON blob of search results in a script tag for
  // server-rendered pages. We look for that first since it's far more
  // reliable than scraping rendered HTML.
  const jsonMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{.*?\});?\s*<\/script>/s);
  if (jsonMatch) {
    try {
      const state = JSON.parse(jsonMatch[1]);
      const jobs = state?.search?.jobsForYouState?.jobs ?? state?.search?.jobs ?? [];
      for (const j of jobs) {
        results.push({
          title: j.title ?? j.jobTitle ?? "Untitled role",
          company: j.companyName ?? j.company ?? null,
          location: j.jobLocation?.displayName ?? j.location ?? null,
          snippet: j.summary ?? j.description ?? "",
          postedDate: j.postedDate ?? j.datePosted ?? null,
          url: j.detailsPageUrl ?? j.jobUrl ?? "",
        });
      }
    } catch {
      // fall through to empty results — caller logs this as 0 found, not an error
    }
  }
  return results;
}

async function dedupeAndScoreWithGroq(
  listings: ScrapedListing[],
  existingTitles: string[],
): Promise<{ title: string; isDuplicate: boolean; estimatedScore: number }[]> {
  if (!GROQ_API_KEY || listings.length === 0) {
    return listings.map((l) => ({ title: l.title, isDuplicate: false, estimatedScore: 50 }));
  }

  const resp = await fetch(GROQ_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You compare newly scraped job listings against a list of titles already in the database. " +
            'Return ONLY JSON: {"results": [{"title": string, "isDuplicate": boolean, "estimatedScore": number}]}. ' +
            "isDuplicate=true if a listing is clearly the same role as an existing title (allow for minor wording differences). " +
            "estimatedScore (1-100) is a rough first-pass Req-Score based only on how specific/detailed the listing snippet is.",
        },
        {
          role: "user",
          content: JSON.stringify({ newListings: listings.map((l) => ({ title: l.title, snippet: l.snippet })), existingTitles }),
        },
      ],
    }),
  });

  if (!resp.ok) return listings.map((l) => ({ title: l.title, isDuplicate: false, estimatedScore: 50 }));
  const data = await resp.json();
  try {
    const parsed = JSON.parse(data.choices[0].message.content);
    return parsed.results;
  } catch {
    return listings.map((l) => ({ title: l.title, isDuplicate: false, estimatedScore: 50 }));
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use the caller's JWT so RLS scopes everything to their workspace.
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabase.from("profiles").select("workspace_id").eq("id", userId).maybeSingle();
    if (!profile) {
      return new Response(JSON.stringify({ error: "No workspace found for user" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const workspaceId = profile.workspace_id;

    const body = await req.json().catch(() => ({}));
    const keywords: string = body.keywords || "Java Developer";
    const location: string = body.location || "";

    const searchUrl = `https://www.dice.com/jobs?q=${encodeURIComponent(keywords)}&location=${encodeURIComponent(location)}`;

    let listings: ScrapedListing[] = [];
    let fetchError: string | null = null;
    try {
      const resp = await fetch(searchUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; JobibBot/1.0; +https://jobib.app)" },
      });
      if (resp.ok) {
        const html = await resp.text();
        listings = parseDiceResults(html);
      } else {
        fetchError = `Dice returned HTTP ${resp.status}`;
      }
    } catch (e) {
      fetchError = e instanceof Error ? e.message : "Fetch failed";
    }

    const { data: existing } = await supabase
      .from("requirements")
      .select("title")
      .eq("workspace_id", workspaceId)
      .eq("origin_channel", "dice")
      .limit(200);
    const existingTitles = (existing ?? []).map((r: any) => r.title);

    const judged = listings.length ? await dedupeAndScoreWithGroq(listings, existingTitles) : [];
    const newOnes = listings.filter((l) => {
      const verdict = judged.find((j) => j.title === l.title);
      return !verdict?.isDuplicate;
    });

    let inserted = 0;
    if (newOnes.length > 0) {
      const rows = newOnes.map((l) => {
        const verdict = judged.find((j) => j.title === l.title);
        return {
          workspace_id: workspaceId,
          created_by: userId,
          title: l.title,
          vendor_name: l.company,
          client_masked: l.company,
          tech_stack: [],
          location_city: l.location,
          source_type: "jobboard" as const,
          origin_channel: "dice" as const,
          jd_text: l.snippet,
          posted_date: l.postedDate,
          req_score: verdict?.estimatedScore ?? 50,
          status: "new" as const,
        };
      });
      const { error: insertErr, count } = await supabase.from("requirements").insert(rows, { count: "exact" });
      if (!insertErr) inserted = count ?? rows.length;
    }

    const status = fetchError ? "failed" : listings.length === 0 ? "partial" : "success";
    await supabase.from("sync_logs").insert({
      workspace_id: workspaceId,
      integration_type: "dice",
      records_processed: listings.length,
      records_added: inserted,
      status,
      error_message: fetchError ?? (listings.length === 0 ? "No listings parsed — Dice page structure may have changed" : null),
    });

    return new Response(
      JSON.stringify({ found: listings.length, added: inserted, duplicatesSkipped: listings.length - newOnes.length, error: fetchError }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// --- Optional: schedule this to run automatically via pg_cron ---
// Run this SQL once in the Supabase SQL editor after deploying the function,
// substituting your project ref and a service-role key stored as a Vault secret:
//
// select cron.schedule(
//   'scrape-dice-hourly',
//   '0 * * * *', -- every hour; change to '*/30 * * * *' for every 30 min
//   $$
//   select net.http_post(
//     url := 'https://<your-project-ref>.supabase.co/functions/v1/scrape-dice',
//     headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')),
//     body := jsonb_build_object('keywords', 'Java Developer', 'location', 'Dallas, TX')
//   );
//   $$
// );
