import type { JDAnalysisResult } from "./api";

const GROQ_STORAGE_KEY = "jobib_groq_api_key";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

export function getStoredGroqKey(): string {
  // 1. Check localStorage first (allows setting/changing directly in UI)
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(GROQ_STORAGE_KEY)?.trim();
      if (stored) return stored;
    } catch {
      // ignore
    }
  }

  // 2. Check .env via Vite (VITE_GROQ_API_KEY)
  try {
    const envKey = (import.meta as any).env?.VITE_GROQ_API_KEY;
    if (typeof envKey === "string" && envKey.trim()) {
      return envKey.trim();
    }
  } catch {
    // ignore
  }

  return "";
}

export function setStoredGroqKey(key: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(GROQ_STORAGE_KEY, key.trim());
  } catch (e) {
    console.error("Failed to save Groq API key to localStorage", e);
  }
}

export function clearStoredGroqKey(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(GROQ_STORAGE_KEY);
    cachedWorkingModel = null;
  } catch (e) {
    console.error("Failed to clear Groq API key", e);
  }
}

const SYSTEM_PROMPT = `You are an expert US IT technical staffing analyst and ATS resume optimization specialist.
You will be given a Job Description (JD) and optionally a Bench Consultant's real profile.
Analyze the JD deeply and synthesize high-converting content.

Respond ONLY with a valid single JSON object — NO markdown formatting, NO code fences, NO introductory text.
The JSON must follow this exact structure:

{
  "must_have_skills": string[],   // Top 5 essential technical skills, prioritized
  "nice_to_have_skills": string[], // Up to 4 secondary/preferred skills
  "domain": string,               // Business industry (e.g. "Banking & Financial Services", "Healthcare", "E-Commerce & Retail", "Telecom", or "Enterprise IT")
  "seniority": string,            // Target seniority level (e.g. "Senior Engineer (7-9 yrs)", "Lead / Architect (10+ yrs)")
  "pain_points": string[],        // 2-3 specific architectural or business pain points the client is hiring to solve
  "tailored_bullets": [
    {
      "original": string,         // Concise baseline summary of the candidate's experience
      "tailored": string          // High-impact bullet point following the Google/Harvard XYZ format: "Accomplished [X] as measured by [Y] by doing [Z]"
    }
  ],
  "ghost_job": {
    "is_ghost": boolean,          // True if this exhibits high probability of being a fake/harvesting posting
    "confidence": number,         // 0-100 score
    "reasons": string[]           // 1-3 concise observations explaining the verdict
  }
}

Tailored Bullets Guidelines:
- If a consultant profile is provided, generate 3-4 custom XYZ bullets blending their actual last project and skills with the target JD's core deliverables.
- Make the bullets realistic, quantifiable (e.g., latency, throughput, scale), and authoritative for US staffing Account Managers.
- If no consultant profile is provided, return "tailored_bullets" as an empty array [].
`;

// Known decommissioned or non-chat models that must NEVER be called
const DECOMMISSIONED_OR_UNSUPPORTED = new Set([
  "llama3-8b-8192",
  "llama3-70b-8192",
  "llama-3.1-70b-versatile",
]);

// Modern active models on Groq in priority order
export const FALLBACK_CANDIDATE_MODELS = [
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "meta-llama/llama-4-scout-17b-16e-instruct",
  "meta-llama/llama-4-maverick-17b-128e-instruct",
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "qwen/qwen3.6-27b",
  "qwen/qwen3.8-27b",
  "llama-3.3-70b-specdec",
  "llama-3.2-3b-preview",
  "llama-3.2-1b-preview",
  "groq/compound-mini",
  "groq/compound",
  "gemma2-9b-it",
  "mixtral-8x7b-32768",
];

export const CANDIDATE_MODELS = FALLBACK_CANDIDATE_MODELS;
export const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";

let cachedWorkingModel: string | null = null;

export async function getAvailableGroqModels(apiKey: string): Promise<string[]> {
  try {
    const res = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return [];

    const json = await res.json();
    const list: any[] = json?.data || [];

    const validModels = list
      .filter((m) => {
        if (!m || !m.id || typeof m.id !== "string") return false;
        const id = m.id.toLowerCase();
        if (m.active === false) return false;
        if (DECOMMISSIONED_OR_UNSUPPORTED.has(id)) return false;
        if (id.includes("guard") || id.includes("safeguard") || id.includes("moderation")) return false;
        if (id.includes("whisper") || id.includes("orpheus") || id.includes("tts")) return false;
        if (id.includes("rerank") || id.includes("embed")) return false;
        return true;
      })
      .map((m) => m.id);

    // Sort by priority
    return [...validModels].sort((a, b) => {
      const idxA = FALLBACK_CANDIDATE_MODELS.indexOf(a);
      const idxB = FALLBACK_CANDIDATE_MODELS.indexOf(b);
      const scoreA = idxA === -1 ? 999 : idxA;
      const scoreB = idxB === -1 ? 999 : idxB;
      return scoreA - scoreB;
    });
  } catch (err) {
    console.warn("Could not query Groq /v1/models directly:", err);
    return [];
  }
}

export async function detectBestGroqModel(apiKey: string): Promise<string> {
  if (cachedWorkingModel && !DECOMMISSIONED_OR_UNSUPPORTED.has(cachedWorkingModel)) {
    return cachedWorkingModel;
  }

  const available = await getAvailableGroqModels(apiKey);
  if (available.length > 0) {
    cachedWorkingModel = available[0];
    return available[0];
  }

  return FALLBACK_CANDIDATE_MODELS[0];
}

export function extractAndParseJson(rawText: string): any {
  let cleaned = rawText.trim();

  // Strip markdown code fences if present (e.g. ```json ... ```)
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "");
    const fenceIndex = cleaned.lastIndexOf("```");
    if (fenceIndex !== -1) {
      cleaned = cleaned.substring(0, fenceIndex);
    }
  }

  cleaned = cleaned.trim();
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace >= firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

  return JSON.parse(cleaned);
}

export async function callGroqAI(params: {
  jdText: string;
  consultant?: {
    full_name?: string | null;
    tech_stack?: string[] | null;
    years_experience?: number | null;
    last_project_title?: string | null;
    last_client_type?: string | null;
    last_project_duration?: string | null;
  } | null;
  apiKey?: string;
  model?: string;
}): Promise<JDAnalysisResult & { modelUsed?: string }> {
  const key = (params.apiKey || getStoredGroqKey()).trim();
  if (!key) {
    throw new Error("GROQ_API_KEY_REQUIRED");
  }

  const userContent = params.consultant
    ? `TARGET JOB DESCRIPTION:\n${params.jdText}\n\nCONSULTANT PROFILE:\n${JSON.stringify(
        {
          name: params.consultant.full_name,
          tech_stack: params.consultant.tech_stack,
          years_experience: params.consultant.years_experience,
          last_project: params.consultant.last_project_title,
          client_type: params.consultant.last_client_type,
          duration: params.consultant.last_project_duration,
        },
        null,
        2,
      )}`
    : `TARGET JOB DESCRIPTION:\n${params.jdText}\n\n(No consultant provided. Extract skills, domain, seniority, pain points, and ghost job verdict only)`;

  // Discover live models for this key
  const available = await getAvailableGroqModels(key);
  const pool = available.length > 0 ? available : FALLBACK_CANDIDATE_MODELS;

  // Build candidate order to try
  const modelsToTry: string[] = [];
  if (params.model && !DECOMMISSIONED_OR_UNSUPPORTED.has(params.model)) {
    modelsToTry.push(params.model);
  }
  if (cachedWorkingModel && !modelsToTry.includes(cachedWorkingModel) && !DECOMMISSIONED_OR_UNSUPPORTED.has(cachedWorkingModel)) {
    modelsToTry.push(cachedWorkingModel);
  }

  for (const m of pool) {
    if (!modelsToTry.includes(m) && !DECOMMISSIONED_OR_UNSUPPORTED.has(m)) {
      modelsToTry.push(m);
    }
  }

  let lastError = "";

  // Try up to top 5 valid models sequentially
  for (const modelName of modelsToTry.slice(0, 5)) {
    try {
      const bodyPayload = {
        model: modelName,
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
      };

      let response = await fetch(GROQ_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(bodyPayload),
      });

      if (!response.ok) {
        let errorDetail = `Groq API responded with status ${response.status}`;
        try {
          const errJson = await response.json();
          if (errJson?.error?.message) {
            errorDetail = errJson.error.message;
          }
        } catch {
          // ignore
        }

        if (response.status === 401) {
          throw new Error("Invalid Groq API Key. Please verify your key at console.groq.com/keys.");
        }
        if (response.status === 429) {
          throw new Error("Groq API rate limit exceeded. Please wait a few moments or try again.");
        }

        const lower = errorDetail.toLowerCase();

        // If json_object response_format is not supported on this model, retry once without it
        if (lower.includes("response_format") || lower.includes("json_object")) {
          const retryRes = await fetch(GROQ_URL, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${key}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: modelName,
              temperature: 0.3,
              messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: userContent },
              ],
            }),
          });
          if (retryRes.ok) {
            response = retryRes;
          }
        }

        if (!response.ok) {
          const isModelUnavailable =
            response.status === 404 ||
            lower.includes("does not exist") ||
            lower.includes("access") ||
            lower.includes("decommissioned") ||
            lower.includes("no longer supported") ||
            lower.includes("deprecated") ||
            lower.includes("not found") ||
            lower.includes("unsupported") ||
            lower.includes("unknown model") ||
            lower.includes("invalid model");

          if (isModelUnavailable) {
            console.warn(`Groq model '${modelName}' unavailable (${errorDetail}), trying next model...`);
            lastError = errorDetail;
            continue;
          }

          throw new Error(errorDetail);
        }
      }

      const data = await response.json();
      const rawText = data?.choices?.[0]?.message?.content;
      if (!rawText) {
        throw new Error("Empty response returned by Groq AI model.");
      }

      cachedWorkingModel = modelName;

      const parsed = extractAndParseJson(rawText);
      return {
        modelUsed: modelName,
        must_have_skills: Array.isArray(parsed.must_have_skills) ? parsed.must_have_skills : [],
        nice_to_have_skills: Array.isArray(parsed.nice_to_have_skills) ? parsed.nice_to_have_skills : [],
        domain: parsed.domain || "Enterprise IT",
        seniority: parsed.seniority || "Senior",
        pain_points: Array.isArray(parsed.pain_points) ? parsed.pain_points : [],
        tailored_bullets: Array.isArray(parsed.tailored_bullets) ? parsed.tailored_bullets : [],
        ghost_job: {
          is_ghost: Boolean(parsed.ghost_job?.is_ghost),
          confidence: Number(parsed.ghost_job?.confidence) || 75,
          reasons: Array.isArray(parsed.ghost_job?.reasons) ? parsed.ghost_job.reasons : ["Analysis completed"],
        },
      };
    } catch (err: any) {
      if (err.message?.includes("Invalid Groq API Key") || err.message?.includes("rate limit")) {
        throw err;
      }
      lastError = err.message || String(err);
      console.warn(`Groq model ${modelName} attempt error:`, lastError);
    }
  }

  throw new Error(lastError || "Could not generate with any available Groq model.");
}

export async function callGroqAIPitch(params: {
  consultant: any;
  requirement: any;
  payRate?: number;
  apiKey?: string;
}): Promise<{ bullets: string; fullEmail: string; modelUsed: string }> {
  const key = (params.apiKey || getStoredGroqKey()).trim();
  if (!key) {
    throw new Error("GROQ_API_KEY_REQUIRED");
  }

  const { consultant, requirement, payRate } = params;
  const prompt = `You are an elite US IT Staffing Account Executive.
Synthesize an irresistible submission pitch and executive email for this consultant submitted to the requirement.

CONSULTANT:
Name: ${consultant.full_name}
Years Experience: ${consultant.years_experience || 7}
Work Authorization: ${consultant.work_authorization || "US Citizen / Green Card / C2C Eligible"}
Core Tech Stack: ${(consultant.tech_stack ?? []).join(", ")}
Last Project Title: ${consultant.last_project_title || "Senior Software Engineer"}
Last Client Type: ${consultant.last_client_type || "Enterprise"}
Last Project Duration: ${consultant.last_project_duration || "18 months"}

REQUIREMENT:
Job Title: ${requirement.title}
Client: ${requirement.client_masked || requirement.vendor_name || "Direct Client"}
Location: ${[requirement.location_city, requirement.location_state].filter(Boolean).join(", ") || "Remote/Hybrid"}
Target Rate: $${requirement.rate_max || 85}/hr
Tech Stack Required: ${(requirement.tech_stack ?? []).join(", ")}
JD Summary: ${(requirement.jd_text || "").substring(0, 800)}
${payRate ? `Target Pay Rate: $${payRate}/hr` : ""}

Return a JSON object with:
{
  "bullets": "• 3 crisp bullet points highlighting XYZ accomplishments, project impact, and availability (string separated by newlines)",
  "fullEmail": "Professional, personalized email pitch to the Account Manager starting with greeting, candidate highlights, rate/availability, and interview readiness"
}`;

  const available = await getAvailableGroqModels(key);
  const pool = available.length > 0 ? available : FALLBACK_CANDIDATE_MODELS;

  const modelsToTry: string[] = [];
  if (cachedWorkingModel && !DECOMMISSIONED_OR_UNSUPPORTED.has(cachedWorkingModel)) {
    modelsToTry.push(cachedWorkingModel);
  }
  for (const m of pool) {
    if (!modelsToTry.includes(m) && !DECOMMISSIONED_OR_UNSUPPORTED.has(m)) {
      modelsToTry.push(m);
    }
  }

  let lastError = "";

  for (const modelName of modelsToTry.slice(0, 4)) {
    try {
      const response = await fetch(GROQ_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: modelName,
          temperature: 0.35,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: "You are a senior US IT staffing specialist. Respond ONLY with valid JSON with keys 'bullets' and 'fullEmail'.",
            },
            { role: "user", content: prompt },
          ],
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        lastError = errText;
        continue;
      }

      const data = await response.json();
      const rawText = data?.choices?.[0]?.message?.content;
      if (!rawText) continue;

      cachedWorkingModel = modelName;
      const parsed = extractAndParseJson(rawText);
      return {
        bullets: parsed.bullets || "",
        fullEmail: parsed.fullEmail || "",
        modelUsed: modelName,
      };
    } catch (e: any) {
      lastError = e.message || String(e);
    }
  }

  throw new Error(lastError || "Could not generate pitch with Groq AI");
}

