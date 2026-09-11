import type { JDAnalysisResult } from "./api";

const GROQ_STORAGE_KEY = "jobib_groq_api_key";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
export const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";

export function getStoredGroqKey(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(GROQ_STORAGE_KEY)?.trim() || "";
  } catch {
    return "";
  }
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
}): Promise<JDAnalysisResult> {
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

  const response = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: params.model || DEFAULT_GROQ_MODEL,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
    }),
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
    throw new Error(errorDetail);
  }

  const data = await response.json();
  const rawText = data?.choices?.[0]?.message?.content;
  if (!rawText) {
    throw new Error("Empty response returned by Groq AI model.");
  }

  try {
    const parsed = JSON.parse(rawText);
    return {
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
  } catch (parseErr) {
    console.error("Failed to parse Groq response as JSON:", rawText, parseErr);
    throw new Error("Groq AI response could not be parsed as valid JSON.");
  }
}
