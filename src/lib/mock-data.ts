export type OriginChannel = "dice" | "gmail" | "manual" | "sheets";
export type SourceType = "direct" | "tier1" | "jobboard";
export type ReqStatus = "new" | "reviewing" | "submitted" | "interview" | "closed";
export type SyncStatus = "synced" | "pending" | "failed";

export interface Requirement {
  id: string;
  title: string;
  vendor_name: string;
  client_masked: string;
  tech_stack: string[];
  location_city: string;
  location_state: string;
  rate_min: number;
  rate_max: number;
  source_type: SourceType;
  origin_channel: OriginChannel;
  jd_text: string;
  am_name: string;
  am_phone: string;
  am_email: string;
  posted_date: string;
  req_score: number;
  status: ReqStatus;
  is_ghost: boolean;
  ghost_reasons: string[];
  sheet_sync_status: SyncStatus;
}

export interface Consultant {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  tech_stack: string[];
  years_experience: number;
  work_authorization: string;
  last_project_title: string;
  last_client_type: string;
  last_project_duration: string;
  availability_date: string;
  bench_status: "available" | "in_interview" | "placed";
}

export interface Submission {
  id: string;
  requirement_id: string;
  consultant_id: string;
  submitted_date: string;
  am_summary: string;
  am_feedback: string;
  status: "submitted" | "in_review" | "interview_scheduled" | "rejected" | "placed";
}

export interface SyncLog {
  id: string;
  integration_type: "google_sheets" | "dice" | "gmail";
  run_at: string;
  records_processed: number;
  records_added: number;
  status: "success" | "partial" | "failed";
  error_message?: string;
}

const TODAY = new Date();
const iso = (daysAgo: number) => {
  const d = new Date(TODAY);
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
};

const TITLES = [
  "Senior Java Developer",
  "Salesforce Administrator",
  "Python Data Engineer",
  "AWS DevOps Engineer",
  "Full Stack Java/React Developer",
  "Salesforce Marketing Cloud Dev",
  "Senior Python Backend Engineer",
  "AWS Cloud Architect",
  "Java Microservices Lead",
  "Salesforce Service Cloud Consultant",
  "Python ML Engineer",
  "AWS Data Engineer",
  "Java Spring Boot Developer",
  "Salesforce CPQ Developer",
  "Senior DevOps / Kubernetes Engineer",
];

const STACKS: string[][] = [
  ["Java", "Spring Boot", "Kafka", "AWS"],
  ["Salesforce", "Apex", "LWC"],
  ["Python", "Airflow", "Snowflake", "dbt"],
  ["AWS", "Terraform", "Kubernetes", "Docker"],
  ["Java", "React", "TypeScript", "GraphQL"],
  ["Salesforce", "Marketing Cloud", "AMPscript"],
  ["Python", "FastAPI", "PostgreSQL", "Redis"],
  ["AWS", "Lambda", "DynamoDB", "API Gateway"],
  ["Java", "Microservices", "Spring Cloud", "Kafka"],
  ["Salesforce", "Service Cloud", "Omni-Channel"],
  ["Python", "PyTorch", "MLflow", "SageMaker"],
  ["AWS", "EMR", "Glue", "Athena"],
  ["Java", "Spring Boot", "Hibernate"],
  ["Salesforce", "CPQ", "Apex", "Flow"],
  ["Kubernetes", "Helm", "ArgoCD", "Prometheus"],
];

const LOCS = [
  ["Dallas", "TX"],
  ["Austin", "TX"],
  ["New York", "NY"],
  ["Jersey City", "NJ"],
  ["San Francisco", "CA"],
  ["San Jose", "CA"],
  ["Houston", "TX"],
  ["Newark", "NJ"],
  ["Brooklyn", "NY"],
  ["Palo Alto", "CA"],
  ["Plano", "TX"],
  ["Manhattan", "NY"],
  ["Princeton", "NJ"],
  ["Sunnyvale", "CA"],
  ["Irving", "TX"],
];

const VENDORS = [
  "TCS",
  "Infosys",
  "Cognizant",
  "Collabera",
  "Wipro",
  "HCL",
  "Capgemini",
  "Mindtree",
  "LTI",
  "Mphasis",
  "Apex Systems",
  "Insight Global",
  "Robert Half",
  "TEKsystems",
  "Direct Client",
];

const ORIGINS: OriginChannel[] = [
  "dice", "gmail", "dice", "gmail", "manual",
  "dice", "gmail", "dice", "manual", "gmail",
  "dice", "gmail", "dice", "manual", "gmail",
];

const SOURCES: SourceType[] = [
  "direct", "tier1", "jobboard", "tier1", "direct",
  "jobboard", "tier1", "direct", "tier1", "jobboard",
  "direct", "tier1", "jobboard", "direct", "tier1",
];

const STATUSES: ReqStatus[] = [
  "new", "reviewing", "submitted", "new", "interview",
  "new", "reviewing", "submitted", "new", "reviewing",
  "new", "closed", "submitted", "new", "interview",
];

function rand(seed: number) {
  return ((seed * 9301 + 49297) % 233280) / 233280;
}

export const requirements: Requirement[] = TITLES.map((title, i) => {
  const r = rand(i + 1);
  const r2 = rand(i + 7);
  const rateMin = 55 + Math.floor(r * 45);
  const rateMax = rateMin + 10 + Math.floor(r2 * 25);
  const score = 35 + Math.floor(rand(i + 13) * 60);
  const ghost = score < 45 && i % 4 === 0;
  return {
    id: `req-${i + 1}`,
    title,
    vendor_name: VENDORS[i],
    client_masked: `Client ${String.fromCharCode(65 + (i % 8))}`,
    tech_stack: STACKS[i],
    location_city: LOCS[i][0],
    location_state: LOCS[i][1],
    rate_min: rateMin,
    rate_max: rateMax,
    source_type: SOURCES[i],
    origin_channel: ORIGINS[i],
    jd_text: `We are looking for a ${title} with strong experience in ${STACKS[i].join(", ")}. Long-term contract, ${LOCS[i][0]}, ${LOCS[i][1]}. Must have USC/GC or H1B transfer.`,
    am_name: ["Priya Shah", "Mike Johnson", "Anjali Rao", "David Lee", "Neha Patel"][i % 5],
    am_phone: `+1 (555) ${100 + i}-${1000 + i * 7}`,
    am_email: `am${i + 1}@${VENDORS[i].toLowerCase().replace(/\s+/g, "")}.com`,
    posted_date: iso(i % 14),
    req_score: score,
    status: STATUSES[i],
    is_ghost: ghost,
    ghost_reasons: ghost
      ? ["Posted >30 days", "JD found on 12+ boards"]
      : [],
    sheet_sync_status: (["synced", "synced", "pending", "synced", "failed"] as SyncStatus[])[i % 5],
  };
});

export const consultants: Consultant[] = [
  {
    id: "c-1", full_name: "Arjun Mehta", email: "arjun@bench.dev", phone: "+1 (469) 555-1010",
    tech_stack: ["Java", "Spring Boot", "AWS", "Kafka"], years_experience: 9,
    work_authorization: "H1B", last_project_title: "Senior Java Engineer",
    last_client_type: "Fortune 100 Bank", last_project_duration: "18 months",
    availability_date: iso(-2), bench_status: "available",
  },
  {
    id: "c-2", full_name: "Sneha Iyer", email: "sneha@bench.dev", phone: "+1 (732) 555-2020",
    tech_stack: ["Salesforce", "Apex", "LWC", "CPQ"], years_experience: 7,
    work_authorization: "GC", last_project_title: "Salesforce Tech Lead",
    last_client_type: "Retail", last_project_duration: "12 months",
    availability_date: iso(0), bench_status: "available",
  },
  {
    id: "c-3", full_name: "Rahul Verma", email: "rahul@bench.dev", phone: "+1 (415) 555-3030",
    tech_stack: ["Python", "Airflow", "Snowflake"], years_experience: 11,
    work_authorization: "USC", last_project_title: "Data Engineering Manager",
    last_client_type: "Healthcare", last_project_duration: "24 months",
    availability_date: iso(-7), bench_status: "in_interview",
  },
  {
    id: "c-4", full_name: "Maria Gonzalez", email: "maria@bench.dev", phone: "+1 (646) 555-4040",
    tech_stack: ["AWS", "Terraform", "Kubernetes"], years_experience: 8,
    work_authorization: "USC", last_project_title: "Cloud Architect",
    last_client_type: "Insurance", last_project_duration: "15 months",
    availability_date: iso(3), bench_status: "available",
  },
  {
    id: "c-5", full_name: "Karthik Reddy", email: "karthik@bench.dev", phone: "+1 (214) 555-5050",
    tech_stack: ["Java", "React", "TypeScript"], years_experience: 6,
    work_authorization: "H1B", last_project_title: "Full Stack Developer",
    last_client_type: "FinTech", last_project_duration: "20 months",
    availability_date: iso(1), bench_status: "available",
  },
  {
    id: "c-6", full_name: "Priya Nair", email: "priya@bench.dev", phone: "+1 (973) 555-6060",
    tech_stack: ["Salesforce", "Marketing Cloud"], years_experience: 5,
    work_authorization: "EAD", last_project_title: "SF Marketing Developer",
    last_client_type: "E-commerce", last_project_duration: "10 months",
    availability_date: iso(0), bench_status: "available",
  },
  {
    id: "c-7", full_name: "Dmitri Volkov", email: "dmitri@bench.dev", phone: "+1 (650) 555-7070",
    tech_stack: ["Python", "PyTorch", "AWS SageMaker"], years_experience: 10,
    work_authorization: "GC", last_project_title: "ML Engineer",
    last_client_type: "AI Startup", last_project_duration: "16 months",
    availability_date: iso(-1), bench_status: "placed",
  },
  {
    id: "c-8", full_name: "Aisha Khan", email: "aisha@bench.dev", phone: "+1 (832) 555-8080",
    tech_stack: ["Java", "Microservices", "Spring Cloud"], years_experience: 12,
    work_authorization: "USC", last_project_title: "Tech Architect",
    last_client_type: "Banking", last_project_duration: "30 months",
    availability_date: iso(5), bench_status: "available",
  },
];

export const submissions: Submission[] = Array.from({ length: 20 }, (_, i) => {
  const statuses = ["submitted", "in_review", "interview_scheduled", "rejected", "placed"] as const;
  return {
    id: `s-${i + 1}`,
    requirement_id: requirements[i % requirements.length].id,
    consultant_id: consultants[i % consultants.length].id,
    submitted_date: iso(i % 14),
    am_summary: `Strong match. ${consultants[i % consultants.length].years_experience}+ yrs in ${requirements[i % requirements.length].tech_stack[0]}. Available immediately. Targeting $${requirements[i % requirements.length].rate_min}/hr.`,
    am_feedback: i % 3 === 0 ? "Shortlisted, interview scheduling in progress" : "",
    status: statuses[i % 5],
  };
});

export const syncLogs: SyncLog[] = [
  { id: "l1", integration_type: "google_sheets", run_at: iso(0), records_processed: 15, records_added: 3, status: "success" },
  { id: "l2", integration_type: "dice", run_at: iso(0), records_processed: 42, records_added: 8, status: "success" },
  { id: "l3", integration_type: "gmail", run_at: iso(0), records_processed: 17, records_added: 3, status: "success" },
  { id: "l4", integration_type: "google_sheets", run_at: iso(1), records_processed: 12, records_added: 0, status: "success" },
  { id: "l5", integration_type: "dice", run_at: iso(1), records_processed: 38, records_added: 6, status: "partial", error_message: "2 listings blocked by captcha" },
  { id: "l6", integration_type: "gmail", run_at: iso(2), records_processed: 22, records_added: 4, status: "success" },
  { id: "l7", integration_type: "google_sheets", run_at: iso(3), records_processed: 9, records_added: 9, status: "failed", error_message: "Token expired — reconnect Google account" },
];

export const dailySubmissions = Array.from({ length: 14 }, (_, i) => ({
  day: iso(13 - i).slice(5),
  submissions: 3 + ((i * 7) % 9),
  target: 8,
}));

export const scoreOverTime = Array.from({ length: 14 }, (_, i) => ({
  day: iso(13 - i).slice(5),
  score: 55 + ((i * 11) % 25),
}));

export const channelPerformance = [
  { channel: "Dice", reqs: 78, submissions: 22, closures: 4 },
  { channel: "Gmail", reqs: 54, submissions: 28, closures: 7 },
  { channel: "Manual", reqs: 18, submissions: 12, closures: 3 },
];

export const sourceBreakdown = [
  { name: "Dice", value: 78 },
  { name: "Gmail", value: 54 },
  { name: "Manual", value: 18 },
  { name: "Other", value: 6 },
];

export const funnelData = [
  { stage: "Requirements", value: 150 },
  { stage: "Submissions", value: 62 },
  { stage: "Interviews", value: 18 },
  { stage: "Placements", value: 6 },
];

export const marketRates = [
  { stack: "Java / Spring Boot", min: 65, max: 95 },
  { stack: "Salesforce Apex/LWC", min: 70, max: 100 },
  { stack: "Python / Data", min: 70, max: 110 },
  { stack: "AWS / DevOps", min: 75, max: 120 },
  { stack: "React / Frontend", min: 60, max: 90 },
  { stack: "ML / AI Engineer", min: 90, max: 150 },
];
