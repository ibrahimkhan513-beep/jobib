// Supabase Edge Function: analyze-jd
//
// Takes a job description (and optionally a consultant profile) and calls
// the Groq API (OpenAI-compatible chat completions) to return:
//   1. Extracted required skills + domain + seniority
//   2. Tailored resume bullets in XYZ format (only if a consultant is passed)
//   3. An AI-based ghost-job verdict (separate from the structural heuristic
//      in src/lib/scoring.ts — this one reads the JD's actual language)
//
// Required secrets (set via `supabase secrets set`, never hardcoded):
//   GROQ_API_KEY   — from console.groq.com
//   GROQ_MODEL     — e.g. "llama-3.3-70b-versatile" (defaults below if unset)
//
// Deploy: supabase functions deploy analyze-jd
// Invoke from frontend: supabase.functions.invoke("analyze-jd", { body: {...} })

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
const GROQ_MODEL = Deno.env.get("GROQ_MODEL") || "llama-3.3-70b-versatile";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ConsultantProfile {
  full_name?: string;
  tech_stack?: string[];
  years_experience?: number;
  last_project_title?: string;
  last_client_type?: string;
  last_project_duration?: string;
}

interface RequestBody {
  jd_text: string;
  consultant?: ConsultantProfile;
}

const SYSTEM_PROMPT = `You are a senior US IT staffing analyst. You will be given a job description, and optionally a bench consultant's profile. Respond with ONLY a single valid JSON object — no markdown fences, no preamble, no explanation text before or after. The JSON must match exactly this shape:

{
  "must_have_skills": string[],   // top 5 required technical skills, most important first
  "nice_to_have_skills": string[],  // up to 3 secondary/preferred skills, [] if none mentioned
  "domain": string,               // e.g. "Financial Services", "Healthcare", "Retail", "General IT" if unclear
  "seniority": string,            // e.g. "Senior (8+ yrs)", "Mid-level", "Lead/Architect"
  "pain_points": string[],        // up to 3 business problems this role is meant to solve, inferred from the JD
  "tailored_bullets": [
    { "original": string, "tailored": string }
    // 3 bullets, only meaningful if a consultant profile was provided.
    // "tailored" must follow XYZ format: Accomplished [X] as measured by [Y], by doing [Z].
    // Use the consultant's real last_project_title / tech_stack / years_experience as raw material.
    // If no consultant profile is provided, return an empty array.
  ],
  "ghost_job": {
    "is_ghost": boolean,        // true if this looks like a resume-harvesting / fake posting
    "confidence": number,       // 0-100
    "reasons": string[]         // up to 3 short reasons, e.g. "No specific tools or environment named"
  }
}

Ghost-job signals to look for in the JD text itself: generic boilerplate with no real tooling/environment named, no mention of team size or actual project context, suspiciously broad skill list with no priority, language clearly copy-pasted from a template. A well-written JD with specific tools, a named environment, and clear scope should NOT be flagged.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!GROQ_API_KEY) {
      return new Response(
        JSON.stringify({ error: "GROQ_API_KEY is not configured on the server. Set it with: supabase secrets set GROQ_API_KEY=your_key" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body: RequestBody = await req.json();
    if (!body.jd_text || !body.jd_text.trim()) {
      return new Response(JSON.stringify({ error: "jd_text is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userContent = body.consultant
      ? `JOB DESCRIPTION:\n${body.jd_text}\n\nCONSULTANT PROFILE:\n${JSON.stringify(body.consultant)}`
      : `JOB DESCRIPTION:\n${body.jd_text}\n\n(No consultant profile provided — return tailored_bullets as an empty array.)`;

    const groqResp = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!groqResp.ok) {
      const errText = await groqResp.text();
      return new Response(
        JSON.stringify({ error: `Groq API error (${groqResp.status})`, details: errText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const groqData = await groqResp.json();
    const rawContent = groqData?.choices?.[0]?.message?.content;
    if (!rawContent) {
      return new Response(JSON.stringify({ error: "Groq returned no content" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let parsed;
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      return new Response(
        JSON.stringify({ error: "Groq response was not valid JSON", raw: rawContent }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
