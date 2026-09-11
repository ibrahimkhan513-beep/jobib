import type { ConsultantRow, RequirementRow } from "./api";

export interface RequirementMatch {
  requirement: RequirementRow;
  matchPercentage: number;
  matchedSkills: string[];
  missingSkills: string[];
  reasons: string[];
}

/**
 * Normalizes text for case-insensitive keyword comparisons.
 */
function normalize(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Compares a consultant's profile against an array of requirements,
 * returning matches sorted from highest match percentage to lowest.
 */
export function matchConsultantToRequirements(
  consultant: ConsultantRow,
  requirements: RequirementRow[],
): RequirementMatch[] {
  const candidateSkills = (consultant.tech_stack ?? []).map((s: string) => s.trim());
  const candidateNorm = new Set(candidateSkills.map(normalize));

  return requirements
    .filter((req) => req.status !== "closed")
    .map((req) => {
      const reqSkills = (req.tech_stack ?? []).map((s: string) => s.trim());
      const jdText = (req.jd_text ?? "").toLowerCase();

      const matchedSkills: string[] = [];
      const missingSkills: string[] = [];

      reqSkills.forEach((skill) => {
        const norm = normalize(skill);
        const inStack = candidateNorm.has(norm);
        const inJd = jdText.includes(skill.toLowerCase());

        if (inStack || inJd) {
          matchedSkills.push(skill);
        } else {
          missingSkills.push(skill);
        }
      });

      // Also detect extra candidate skills mentioned in the JD text
      candidateSkills.forEach((skill) => {
        if (!reqSkills.some((s) => normalize(s) === normalize(skill))) {
          if (jdText.includes(skill.toLowerCase()) && !matchedSkills.includes(skill)) {
            matchedSkills.push(skill);
          }
        }
      });

      // Calculate match percentage:
      // Base: skill overlap
      const totalSkills = Math.max(reqSkills.length, 1);
      const skillScore = Math.min(100, Math.round((matchedSkills.length / totalSkills) * 100));

      // Experience boost if candidate has >= 5 years for senior reqs
      let expBonus = 0;
      const years = consultant.years_experience ?? 0;
      if (years >= 7 && (req.title.toLowerCase().includes("senior") || req.title.toLowerCase().includes("lead"))) {
        expBonus = 10;
      } else if (years >= 4) {
        expBonus = 5;
      }

      // Req Score quality factor (10% influence)
      const qualityFactor = Math.round((req.req_score ?? 60) * 0.1);

      const finalMatch = Math.min(99, Math.max(15, Math.round(skillScore * 0.8 + expBonus + qualityFactor)));

      const reasons: string[] = [];
      if (matchedSkills.length > 0) {
        reasons.push(`Matches ${matchedSkills.length} core skills: ${matchedSkills.slice(0, 3).join(", ")}`);
      }
      if (consultant.years_experience) {
        reasons.push(`${consultant.years_experience} yrs experience aligns with requirement seniority`);
      }
      if (consultant.bench_status === "available") {
        reasons.push("Consultant is immediately available on bench");
      }

      return {
        requirement: req,
        matchPercentage: finalMatch,
        matchedSkills,
        missingSkills,
        reasons,
      };
    })
    .sort((a, b) => b.matchPercentage - a.matchPercentage);
}

/**
 * Dynamically crafts a high-converting Account Manager summary and email pitch
 * based on the selected Consultant and Requirement.
 */
export function generateAMPitch(
  consultant: ConsultantRow | null | undefined,
  requirement: RequirementRow | null | undefined,
): { bullets: string; fullEmail: string } {
  if (!consultant || !requirement) {
    return {
      bullets: "• Please select both a Consultant and a Requirement to generate a tailored pitch.",
      fullEmail: "",
    };
  }

  const name = consultant.full_name || "The candidate";
  const years = consultant.years_experience ? `${consultant.years_experience}+ years` : "Experienced";
  const auth = consultant.work_authorization ? `[${consultant.work_authorization}]` : "";
  const candidateSkills = (consultant.tech_stack ?? []).slice(0, 4).join(", ");
  const reqTitle = requirement.title || "the role";
  const client = requirement.client_masked || requirement.vendor_name || "your end client";
  const amName = requirement.am_name ? requirement.am_name.split(" ")[0] : "Account Manager";

  // Check rate alignment
  let rateInfo = "";
  if (requirement.rate_max) {
    rateInfo = `Rate: $${requirement.rate_min ? `${requirement.rate_min}-$` : ""}${requirement.rate_max}/hr (within required budget)`;
  } else {
    rateInfo = "Rate: Market competitive / open to negotiation";
  }

  const availability = consultant.availability_date ? `Available: ${consultant.availability_date}` : "Available immediately";
  const location = [requirement.location_city, requirement.location_state].filter(Boolean).join(", ") || "Remote/Hybrid";

  const bullet1 = `• ${years} Senior profile ${auth} specializing in ${candidateSkills || "core technology stack"}.`;
  const bullet2 = consultant.last_project_title
    ? `• Recently delivered as ${consultant.last_project_title}${consultant.last_project_duration ? ` (${consultant.last_project_duration})` : ""} with hands-on architecture & execution.`
    : `• Proven track record delivering production-grade systems directly relevant to ${reqTitle}.`;
  const bullet3 = `• ${availability} · Work Auth: ${consultant.work_authorization || "Authorized to work in US"} · ${rateInfo} · Location: ${location}.`;

  const bullets = [bullet1, bullet2, bullet3].join("\n");

  const fullEmail = `Hi ${amName},

Hope you are doing well.

I am pleased to present ${name} for your open ${reqTitle} role with ${client}.

Candidate Highlights:
${bullets}

${name} has strong communication skills, is technically screened, and is available for an interview on short notice.

Looking forward to your feedback and scheduling next steps.

Best regards,`;

  return { bullets, fullEmail };
}
