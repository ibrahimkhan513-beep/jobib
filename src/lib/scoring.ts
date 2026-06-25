// Shared Req-Score + Ghost-Job scoring logic.
// Used by the Add Requirement form (to store a real score) and the
// requirement detail drawer (to show the breakdown for any requirement,
// including ones synced in from Dice/Gmail later).

export interface ScoringInput {
  source_type: "direct" | "tier1" | "jobboard";
  rate_max: number | null;
  jd_text: string | null;
  am_name: string | null;
  am_phone: string | null;
  posted_date: string | null;
  tech_stack?: string[];
}

export interface ScoreCriterion {
  label: string;
  weight: number;
  value: string;
  raw: number;
}

export interface MarketRate {
  stack: string;
  rate_min: number;
  rate_max: number;
}

// Fallback used only when no matching market rate row exists yet for this
// requirement's tech stack (e.g. workspace hasn't configured rates in
// Settings). $85/hr is a reasonable blended median across common bench-sales
// stacks (Java, Salesforce, AWS, Python) and keeps scoring functional
// out of the box.
const FALLBACK_MEDIAN_RATE = 85;

function resolveMarketMedian(techStack: string[] | undefined, marketRates: MarketRate[] | undefined): number {
  if (!marketRates?.length || !techStack?.length) return FALLBACK_MEDIAN_RATE;
  const match = marketRates.find((m) => techStack.some((t) => t.toLowerCase() === m.stack.toLowerCase()));
  if (!match) return FALLBACK_MEDIAN_RATE;
  return (match.rate_min + match.rate_max) / 2;
}

export function scoreRequirement(
  input: ScoringInput,
  marketRates?: MarketRate[],
): { criteria: ScoreCriterion[]; total: number } {
  const sourceRaw = input.source_type === "direct" ? 100 : input.source_type === "tier1" ? 75 : 40;
  const sourceLabel = input.source_type === "direct" ? "Direct" : input.source_type === "tier1" ? "Tier-1" : "Job Board";

  const marketMedian = resolveMarketMedian(input.tech_stack, marketRates);
  const rateMax = input.rate_max ?? 0;
  const rateRaw = rateMax >= marketMedian * 1.05 ? 100 : rateMax >= marketMedian * 0.9 ? 75 : rateMax > 0 ? 40 : 20;
  const rateLabel = rateMax >= marketMedian * 1.05 ? "Above market" : rateMax >= marketMedian * 0.9 ? "At market" : rateMax > 0 ? "Below market" : "Not specified";

  const jdLen = (input.jd_text ?? "").trim().length;
  const exclusivityRaw = jdLen > 400 ? 90 : jdLen > 150 ? 65 : jdLen > 0 ? 35 : 20;
  const exclusivityLabel = jdLen > 400 ? "Detailed JD" : jdLen > 150 ? "Brief JD" : jdLen > 0 ? "Sparse JD" : "No JD text";

  const hasContact = Boolean(input.am_name || input.am_phone);
  const responsivenessRaw = input.am_phone ? 90 : input.am_name ? 60 : 20;
  const responsivenessLabel = input.am_phone ? "AM phone on file" : input.am_name ? "AM name only" : "No contact info";

  const daysOld = input.posted_date
    ? Math.floor((Date.now() - new Date(input.posted_date).getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const timelineRaw = daysOld === null ? 70 : daysOld <= 10 ? 90 : daysOld <= 30 ? 55 : 20;
  const timelineLabel = daysOld === null ? "Not specified" : daysOld <= 10 ? "Immediate" : daysOld <= 30 ? "Aging" : "Future pipeline";

  const criteria: ScoreCriterion[] = [
    { label: "Source Type", weight: 30, value: sourceLabel, raw: sourceRaw },
    { label: "Rate Alignment", weight: 20, value: rateLabel, raw: rateRaw },
    { label: "Exclusivity", weight: 20, value: exclusivityLabel, raw: exclusivityRaw },
    { label: "Responsiveness", weight: 20, value: responsivenessLabel, raw: responsivenessRaw },
    { label: "Timeline", weight: 10, value: timelineLabel, raw: timelineRaw },
  ];

  const total = Math.round(criteria.reduce((sum, c) => sum + (c.raw * c.weight) / 100, 0));
  return { criteria, total };
}

export interface GhostCheckResult {
  isGhost: boolean;
  reasons: string[];
}

// Heuristic ghost-job detection (Sprint 2 — runs on data already in the form).
// This is NOT the AI-based detector; that comes in Sprint 3 via Groq and
// looks at JD language patterns. This pass only checks the structural
// red flags called out in the original strategy doc: age, missing contact,
// and generic/templated JD length.
export function checkGhostJob(input: ScoringInput): GhostCheckResult {
  const reasons: string[] = [];

  const daysOld = input.posted_date
    ? Math.floor((Date.now() - new Date(input.posted_date).getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  if (daysOld > 30) reasons.push("Posted >30 days with no update");

  if (!input.am_name && !input.am_phone) reasons.push("No AM contact info — email-only lead");

  const jdLen = (input.jd_text ?? "").trim().length;
  if (jdLen > 0 && jdLen < 150) reasons.push("JD is unusually short / generic-looking");

  return { isGhost: reasons.length >= 2, reasons };
}
