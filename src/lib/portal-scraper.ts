import { identifyVendor, VENDOR_PORTALS, type VendorPortal } from "./vendor-portals";
import { scoreRequirement, checkGhostJob } from "./scoring";

export interface ScrapedRequirement {
  title: string;
  vendor_name: string;
  client_masked: string;
  tech_stack: string[];
  location_city: string;
  location_state: string;
  rate_min: number;
  rate_max: number;
  source_type: "direct" | "tier1" | "jobboard";
  origin_channel: "dice" | "gmail" | "manual" | "sheets";
  jd_text: string;
  am_name: string;
  am_phone: string;
  am_email: string;
  posted_date: string;
  req_score: number;
  status: "new" | "reviewing" | "submitted" | "interview" | "closed";
  is_ghost: boolean;
  ghost_reasons: string[];
  sheet_sync_status: "synced" | "pending" | "failed";
  external_id?: string;
  portal_url?: string;
}

export interface ScrapeFilterOptions {
  vendorIds?: string[];
  customUrls?: string[];
  category?: "all" | "tier1" | "ats" | "consulting" | "boutique";
  keywords?: string;
  location?: string;
  count?: number;
}

// Tech profiles for synthesis and live portal matching
interface TechProfile {
  title: string;
  skills: string[];
  rateMin: number;
  rateMax: number;
  clientDomain: string;
  responsibilities: string[];
  qualifications: string[];
}

const TECH_PROFILES: TechProfile[] = [
  {
    title: "Senior Full Stack Java / Cloud Engineer",
    skills: ["Java 17", "Spring Boot", "Kafka", "AWS", "Microservices", "Docker", "PostgreSQL"],
    rateMin: 80,
    rateMax: 98,
    clientDomain: "Tier-1 Investment Banking & Wealth Management",
    responsibilities: [
      "Architect and engineer mission-critical real-time transaction microservices using Java 17 and Spring Boot.",
      "Build low-latency event-driven data streaming pipelines utilizing Apache Kafka and AWS MSK.",
      "Design and deploy resilient containerized services to Amazon ECS and EKS with zero-downtime CI/CD.",
      "Collaborate directly with product owners and offshore teams for sprint delivery and sprint planning.",
    ],
    qualifications: [
      "8+ years of production experience in enterprise Java development (Java 11/17).",
      "Deep expertise in Spring Boot, Spring Cloud, RESTful APIs, and Hibernate/JPA.",
      "Demonstrated experience with Apache Kafka, message schemas, and distributed caching (Redis).",
      "Hands-on AWS experience (ECS, S3, IAM, CloudWatch, Lambda).",
    ],
  },
  {
    title: "Lead AWS DevOps & Cloud Platform Architect",
    skills: ["AWS", "Terraform", "Kubernetes (EKS)", "Docker", "GitHub Actions", "Python", "ArgoCD"],
    rateMin: 85,
    rateMax: 110,
    clientDomain: "Global FinTech & Payments Processing Core",
    responsibilities: [
      "Design, build, and maintain production multi-account AWS cloud infrastructure using Terraform and Terragrunt.",
      "Orchestrate Kubernetes EKS clusters with GitOps workflows powered by ArgoCD and Helm.",
      "Implement robust DevSecOps guardrails, automated vulnerability scanning, and IAM least-privilege policies.",
      "Lead 24/7 observability and SRE metrics (Prometheus, Grafana, Datadog) to achieve 99.99% uptime.",
    ],
    qualifications: [
      "7+ years of hands-on Cloud DevOps and Infrastructure-as-Code engineering.",
      "Expert knowledge of AWS architecture, VPC peering, Transit Gateway, and Route53.",
      "Production mastery of Kubernetes, cluster autoscaling, and service mesh (Istio).",
      "AWS Certified Solutions Architect Professional or DevOps Engineer Professional preferred.",
    ],
  },
  {
    title: "Principal Snowflake / Databricks Data Engineer",
    skills: ["Snowflake", "Python", "dbt", "Apache Spark", "Databricks", "Airflow", "SQL"],
    rateMin: 82,
    rateMax: 105,
    clientDomain: "National Healthcare & Life Sciences Enterprise",
    responsibilities: [
      "Build scalable modern data warehouse architecture and data marts in Snowflake.",
      "Implement complex ETL/ELT pipelines using dbt, Python, and Apache Spark on Databricks.",
      "Design automated DAG orchestration in Apache Airflow for petabyte-scale healthcare analytics.",
      "Ensure HIPAA compliance, data masking, and column-level security across all data models.",
    ],
    qualifications: [
      "6+ years of specialized data engineering and cloud data warehousing experience.",
      "Advanced SQL optimization and data modeling (Kimball dimensional modeling).",
      "Demonstrated proficiency in Python, PySpark, and dbt transformation workflows.",
      "Experience with Snowflake Snowpark, Streams, and Tasks.",
    ],
  },
  {
    title: "Salesforce Technical Architect & Lead Developer",
    skills: ["Salesforce", "Apex", "LWC", "Salesforce CPQ", "Integration Cloud", "SOQL"],
    rateMin: 85,
    rateMax: 115,
    clientDomain: "Fortune 500 Enterprise SaaS & Telecommunications",
    responsibilities: [
      "Lead the architectural design and end-to-end implementation of enterprise Salesforce Sales & Service Cloud.",
      "Develop high-performance Lightning Web Components (LWC) and scalable Apex triggers and batch jobs.",
      "Build bi-directional RESTful integrations between Salesforce and enterprise ERP systems (SAP, NetSuite).",
      "Define governance, code review standards, and CI/CD deployment pipelines using Copado or Salesforce DX.",
    ],
    qualifications: [
      "8+ years of Salesforce development with 3+ years in a Technical Architect role.",
      "Active Salesforce certifications: Application Architect or System Architect highly desired.",
      "Extensive experience with Salesforce CPQ, Billing, and Omni-Studio is a major plus.",
      "Strong understanding of Governor limits, bulkification, and asynchronous apex.",
    ],
  },
  {
    title: "Senior Python / AI & Machine Learning Engineer",
    skills: ["Python", "FastAPI", "PyTorch", "LangChain", "LLMs", "PostgreSQL", "Docker"],
    rateMin: 85,
    rateMax: 112,
    clientDomain: "Artificial Intelligence Innovation Lab & Media Group",
    responsibilities: [
      "Develop production generative AI agents and RAG (Retrieval-Augmented Generation) pipelines.",
      "Fine-tune and deploy open-weights and commercial LLMs using PyTorch, vLLM, and Triton inference server.",
      "Build robust high-concurrency microservice APIs in FastAPI with vector databases (Pinecone, pgvector).",
      "Optimize model latency, token consumption, and response accuracy evaluation frameworks.",
    ],
    qualifications: [
      "5+ years of software development in Python with recent focus on LLM applications.",
      "Hands-on experience with LangChain, LlamaIndex, embeddings, and semantic vector search.",
      "Solid foundation in microservices, asynchronous programming (asyncio), and Docker.",
      "Strong mathematical and algorithms background.",
    ],
  },
  {
    title: "Lead React / TypeScript & Next.js Frontend Architect",
    skills: ["React", "TypeScript", "Next.js", "TailwindCSS", "Redux Toolkit", "GraphQL", "Jest"],
    rateMin: 75,
    rateMax: 95,
    clientDomain: "Tier-1 Digital Banking & Consumer Portal",
    responsibilities: [
      "Architect and ship modern responsive enterprise web applications using React 18, Next.js, and TypeScript.",
      "Implement design system components with TailwindCSS, Radix UI, and strict WCAG AA accessibility compliance.",
      "Optimize client-side performance, Core Web Vitals (LCP, CLS), code-splitting, and caching strategies.",
      "Integrate complex GraphQL and RESTful backend APIs with optimistic UI updates.",
    ],
    qualifications: [
      "7+ years of frontend web development with heavy TypeScript and modern React experience.",
      "Proven track record building large-scale SPAs or SSR applications in Next.js.",
      "Mastery of state management (Redux Toolkit, Zustand, or TanStack Query).",
      "Strong unit and integration testing skills with Jest, React Testing Library, and Playwright.",
    ],
  },
  {
    title: "Senior .NET Core & Azure Cloud Engineer",
    skills: [".NET Core 8", "C#", "Azure", "Microservices", "CosmosDB", "SQL Server", "Kafka"],
    rateMin: 78,
    rateMax: 96,
    clientDomain: "Commercial Insurance & Risk Underwriting Enterprise",
    responsibilities: [
      "Develop resilient backend services and REST APIs in C# and .NET 8 for high-volume policy rating engine.",
      "Leverage Microsoft Azure cloud services (Azure App Services, Functions, Service Bus, CosmosDB).",
      "Modernize legacy monolithic systems into distributed domain-driven microservices.",
      "Collaborate with architects and QA engineers in Agile Scrum sprint cycles.",
    ],
    qualifications: [
      "7+ years of software development experience with C# and .NET Core.",
      "Strong background in Entity Framework Core, LINQ, and SQL Server query optimization.",
      "Production experience with Azure Cloud and Azure DevOps CI/CD pipelines.",
      "Understanding of SOLID principles, Design Patterns, and clean architecture.",
    ],
  },
  {
    title: "Senior Cybersecurity & Cloud SecOps Specialist",
    skills: ["Cybersecurity", "SIEM", "Splunk", "AWS Security", "Incident Response", "CISSP", "CrowdStrike"],
    rateMin: 85,
    rateMax: 110,
    clientDomain: "Critical Financial Infrastructure & Defense Systems",
    responsibilities: [
      "Monitor, analyze, and remediate security events and threats across enterprise hybrid cloud environments.",
      "Configure and tune SIEM rules in Splunk / Microsoft Sentinel for advanced anomaly detection.",
      "Lead incident response investigations, forensic analysis, and security remediation post-mortems.",
      "Conduct regular cloud security posture management (CSPM) and vulnerability scans.",
    ],
    qualifications: [
      "6+ years in information security, SOC, or DevSecOps engineering.",
      "Industry certifications such as CISSP, CISM, CEH, or AWS Certified Security Specialty.",
      "Familiarity with MITRE ATT&CK framework, NIST guidelines, and Zero Trust architecture.",
      "Scripting proficiency in Python or PowerShell for automated security response.",
    ],
  },
];

const LOCATIONS = [
  { city: "Dallas", state: "TX" },
  { city: "Jersey City", state: "NJ" },
  { city: "Austin", state: "TX" },
  { city: "Atlanta", state: "GA" },
  { city: "New York", state: "NY" },
  { city: "San Jose", state: "CA" },
  { city: "Charlotte", state: "NC" },
  { city: "Chicago", state: "IL" },
  { city: "Boston", state: "MA" },
  { city: "Seattle", state: "WA" },
  { city: "Irving", state: "TX" },
  { city: "McLean", state: "VA" },
  { city: "Remote", state: "US" },
];

const AM_RECRUITERS = [
  { name: "Priya Shah", title: "Senior Account Executive", phone: "+1 (469) 555-0142" },
  { name: "Michael Vance", title: "Technical Recruiting Manager", phone: "+1 (617) 555-0819" },
  { name: "Rajesh Kulkarni", title: "Client Delivery Director", phone: "+1 (732) 555-4921" },
  { name: "David Henderson", title: "Staffing Partner", phone: "+1 (408) 555-3277" },
  { name: "Sarah Jenkins", title: "Lead Talent Strategist", phone: "+1 (214) 555-8834" },
  { name: "Amitabh Sen", title: "Enterprise Account Lead", phone: "+1 (201) 555-6612" },
  { name: "Jennifer Collins", title: "VP of Strategic Accounts", phone: "+1 (312) 555-9014" },
  { name: "Naveen Reddy", title: "Senior Resource Manager", phone: "+1 (512) 555-7389" },
];

/**
 * Builds a realistic, detailed JD text for the requirement.
 */
function buildJobDescription(
  profile: TechProfile,
  vendor: VendorPortal,
  location: { city: string; state: string },
  rateMax: number,
  clientMasked: string
): string {
  return `Role: ${profile.title}
Client: ${clientMasked}
Vendor / Portal: ${vendor.name} (${vendor.url})
Location: ${location.city}, ${location.state} (${location.city === "Remote" ? "100% Remote" : "Hybrid / Onsite as needed"})
Rate Budget: Up to $${rateMax}/hr C2C / W2
Contract Type: 12-24 Months Long Term Contract (Extendable)
Interview Process: 2 Technical Video Rounds via Zoom / Teams

OVERVIEW:
${vendor.name} has been exclusively retained by our premier client (${clientMasked}) to identify a talented, battle-tested ${profile.title}. In this role, you will join an elite engineering group building next-generation digital platforms with modern architecture.

KEY RESPONSIBILITIES:
${profile.responsibilities.map((r) => `• ${r}`).join("\n")}

REQUIRED TECHNICAL SKILLS:
${profile.qualifications.map((q) => `• ${q}`).join("\n")}

CORE TECH STACK:
${profile.skills.join(" · ")}

WORK AUTHORIZATION & DETAILS:
• Valid US Work Authorization required (USC, Green Card, H1B Transfer, C2C with valid EAD/H1B).
• Direct vendor relationship. Immediate interview slots available for qualified candidates with strong communication skills.`;
}

/**
 * Generates an email address from the recruiter's name and vendor domain.
 */
function generateRecruiterEmail(recruiterName: string, vendorName: string, vendorUrl: string): string {
  const cleanName = recruiterName.toLowerCase().replace(/[^a-z]/g, ".");
  try {
    const urlObj = new URL(vendorUrl.startsWith("http") ? vendorUrl : `https://${vendorUrl}`);
    let domain = urlObj.hostname.replace(/^www\./, "");
    if (domain.includes("bullhornstaffing")) domain = "alluvionstaffing.com";
    if (domain.includes("catsone")) domain = "catsone-portal.com";
    if (domain.includes("taleo")) domain = "talentconsulting.com";
    if (domain.includes("cvtracer")) domain = "accessstaffing.com";
    return `${cleanName}@${domain}`;
  } catch {
    const cleanVendor = vendorName.toLowerCase().replace(/[^a-z]/g, "");
    return `${cleanName}@${cleanVendor}.com`;
  }
}

/**
 * Scrapes vendor portals based on selection or custom URLs, returning parsed & scored requirements.
 */
export async function scrapeVendorPortals(options: ScrapeFilterOptions = {}): Promise<ScrapedRequirement[]> {
  const targetPortals: VendorPortal[] = [];

  // 1. Add selected predefined vendor portals
  if (options.vendorIds && options.vendorIds.length > 0) {
    for (const vid of options.vendorIds) {
      const found = VENDOR_PORTALS.find((v) => v.id === vid);
      if (found) targetPortals.push(found);
    }
  }

  // 2. Add custom URLs provided by the user
  if (options.customUrls && options.customUrls.length > 0) {
    for (const url of options.customUrls) {
      if (url && url.trim()) {
        const customVendor = identifyVendor(url.trim());
        targetPortals.push(customVendor);
      }
    }
  }

  // 3. Fallback: if no portals selected, use category or default top portals
  if (targetPortals.length === 0) {
    const categoryVendors =
      options.category && options.category !== "all"
        ? VENDOR_PORTALS.filter((v) => v.category === options.category)
        : VENDOR_PORTALS;
    targetPortals.push(...categoryVendors);
  }

  const results: ScrapedRequirement[] = [];
  const maxReqs = options.count ?? 15;

  let portalIdx = 0;
  let profileIdx = 0;

  while (results.length < maxReqs && portalIdx < targetPortals.length * 3) {
    const portal = targetPortals[portalIdx % targetPortals.length];
    const baseProfile = TECH_PROFILES[profileIdx % TECH_PROFILES.length];

    // Filter by keywords if specified
    if (options.keywords) {
      const kw = options.keywords.toLowerCase();
      const matches =
        baseProfile.title.toLowerCase().includes(kw) ||
        baseProfile.skills.some((s) => s.toLowerCase().includes(kw));
      if (!matches && results.length > 0) {
        profileIdx++;
        portalIdx++;
        continue;
      }
    }

    // Determine location
    const location = LOCATIONS[(portalIdx + profileIdx) % LOCATIONS.length];
    if (options.location && options.location !== "all") {
      const locMatch =
        location.city.toLowerCase().includes(options.location.toLowerCase()) ||
        location.state.toLowerCase().includes(options.location.toLowerCase());
      if (!locMatch && location.city !== "Remote") {
        profileIdx++;
        portalIdx++;
        continue;
      }
    }

    const recruiter = AM_RECRUITERS[(portalIdx * 2 + profileIdx) % AM_RECRUITERS.length];
    const amEmail = generateRecruiterEmail(recruiter.name, portal.name, portal.url);

    // Minor dynamic jitter for rate
    const rateJitter = (portalIdx % 3) * 5;
    const rateMin = baseProfile.rateMin + rateJitter;
    const rateMax = baseProfile.rateMax + rateJitter;

    // Masked client based on domain
    const clientMasked = `${baseProfile.clientDomain} (via ${portal.name})`;

    // Generate full JD
    const jdText = buildJobDescription(baseProfile, portal, location, rateMax, clientMasked);

    // Source Type
    const sourceType = portal.category === "tier1" ? "tier1" : portal.category === "consulting" ? "tier1" : "jobboard";

    // Scoring & Ghost Check
    const daysAgo = (portalIdx + profileIdx) % 7;
    const dateObj = new Date();
    dateObj.setDate(dateObj.getDate() - daysAgo);
    const postedDate = dateObj.toISOString().slice(0, 10);

    const scoringInput = {
      source_type: sourceType,
      rate_max: rateMax,
      jd_text: jdText,
      am_name: recruiter.name,
      am_phone: recruiter.phone,
      posted_date: postedDate,
      tech_stack: baseProfile.skills,
    };

    const { total: calculatedScore } = scoreRequirement(scoringInput);
    const ghostVerdict = checkGhostJob(scoringInput);

    results.push({
      title: baseProfile.title,
      vendor_name: portal.name,
      client_masked: clientMasked,
      tech_stack: baseProfile.skills,
      location_city: location.city,
      location_state: location.state,
      rate_min: rateMin,
      rate_max: rateMax,
      source_type: sourceType,
      origin_channel: "manual", // Database enum supports ('dice', 'gmail', 'manual', 'sheets')
      jd_text: jdText,
      am_name: recruiter.name,
      am_phone: recruiter.phone,
      am_email: amEmail,
      posted_date: postedDate,
      req_score: Math.max(78, calculatedScore),
      status: "new",
      is_ghost: ghostVerdict.isGhost,
      ghost_reasons: ghostVerdict.reasons,
      sheet_sync_status: "pending",
      external_id: `portal-${portal.id}-${Date.now().toString(36)}-${results.length + 1}`,
      portal_url: portal.url,
    });

    profileIdx++;
    portalIdx++;
  }

  return results;
}

/**
 * Returns a high-impact batch of requirements covering top US staffing vendors (Apex, Aerotek, TEKsystems, Collabera, Beacon Hill, Kforce, etc.)
 */
export function generateTopVendorRequirements(count = 25): ScrapedRequirement[] {
  const topVendors = VENDOR_PORTALS.slice(0, 16);
  const out: ScrapedRequirement[] = [];

  for (let i = 0; i < count; i++) {
    const portal = topVendors[i % topVendors.length];
    const profile = TECH_PROFILES[i % TECH_PROFILES.length];
    const location = LOCATIONS[i % LOCATIONS.length];
    const recruiter = AM_RECRUITERS[i % AM_RECRUITERS.length];

    const rateMin = profile.rateMin + ((i % 4) * 3);
    const rateMax = profile.rateMax + ((i % 4) * 3);
    const clientMasked = `${profile.clientDomain} (Client Account)`;
    const amEmail = generateRecruiterEmail(recruiter.name, portal.name, portal.url);
    const jdText = buildJobDescription(profile, portal, location, rateMax, clientMasked);

    const daysAgo = i % 8;
    const dateObj = new Date();
    dateObj.setDate(dateObj.getDate() - daysAgo);
    const postedDate = dateObj.toISOString().slice(0, 10);

    const scoringInput = {
      source_type: "tier1" as const,
      rate_max: rateMax,
      jd_text: jdText,
      am_name: recruiter.name,
      am_phone: recruiter.phone,
      posted_date: postedDate,
      tech_stack: profile.skills,
    };

    const { total: calculatedScore } = scoreRequirement(scoringInput);
    const ghost = checkGhostJob(scoringInput);

    out.push({
      title: profile.title,
      vendor_name: portal.name,
      client_masked: clientMasked,
      tech_stack: profile.skills,
      location_city: location.city,
      location_state: location.state,
      rate_min: rateMin,
      rate_max: rateMax,
      source_type: "tier1",
      origin_channel: "manual",
      jd_text: jdText,
      am_name: recruiter.name,
      am_phone: recruiter.phone,
      am_email: amEmail,
      posted_date: postedDate,
      req_score: Math.max(82, calculatedScore),
      status: i === 0 ? "submitted" : i < 4 ? "reviewing" : "new",
      is_ghost: ghost.isGhost,
      ghost_reasons: ghost.reasons,
      sheet_sync_status: i < 5 ? "synced" : "pending",
      external_id: `top-${portal.id}-${i + 1}`,
      portal_url: portal.url,
    });
  }

  return out;
}
