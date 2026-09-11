import allVendorPortalsRaw from "./all-vendor-portals.json";

export interface VendorPortal {
  id: string;
  name: string;
  category: "tier1" | "ats" | "consulting" | "boutique";
  url: string;
  atsType?: "bullhorn" | "jobdiva" | "catsone" | "taleo" | "applicantstack" | "cvtracer" | "direct";
  defaultRoles: string[];
  headquarters?: string;
  notes?: string;
}

export const FEATURED_VENDOR_PORTALS: VendorPortal[] = [
  // --- Tier-1 Staffing Giants ---
  {
    id: "apex-systems",
    name: "Apex Systems",
    category: "tier1",
    url: "http://itcareers.apexsystems.com/",
    atsType: "direct",
    defaultRoles: ["Senior Java Developer", "AWS Cloud Architect", "DevOps Engineer", "Data Engineer"],
    headquarters: "Glen Allen, VA",
    notes: "Largest US IT staffing firm, major supplier to Fortune 500 banks, healthcare, and tech.",
  },
  {
    id: "aerotek",
    name: "Aerotek / Actalent",
    category: "tier1",
    url: "https://jobs.aerotek.com/us/en",
    atsType: "direct",
    defaultRoles: ["Embedded Software Engineer", "Full Stack Developer", "Systems Architect", "Automation Engineer"],
    headquarters: "Hanover, MD",
    notes: "Top national engineering & scientific workforce solutions provider.",
  },
  {
    id: "teksystems",
    name: "TEKsystems",
    category: "tier1",
    url: "https://www.teksystems.com/en/careers/search-jobs",
    atsType: "direct",
    defaultRoles: ["Cloud Infrastructure Lead", "Senior Full Stack Java/React", "Cybersecurity Analyst", "Snowflake Architect"],
    headquarters: "Hanover, MD",
    notes: "Premier IT staffing, talent management and digital enterprise solutions provider.",
  },
  {
    id: "collabera",
    name: "Collabera",
    category: "tier1",
    url: "https://collabera.com/find-a-job/search-jobs/",
    atsType: "direct",
    defaultRoles: ["Java Microservices Developer", "Python Data Engineer", "AWS DevOps Specialist", "Salesforce Lead"],
    headquarters: "Basking Ridge, NJ",
    notes: "Massive C2C and direct placement supplier across US financial institutions.",
  },
  {
    id: "kforce",
    name: "Kforce",
    category: "tier1",
    url: "https://www.kforce.com/find-work/search-jobs/",
    atsType: "direct",
    defaultRoles: ["Senior .NET Core Developer", "Business Intelligence Analyst", "Cloud Security Engineer", "Scrum Master"],
    headquarters: "Tampa, FL",
    notes: "Publicly traded technology and finance staffing powerhouse.",
  },
  {
    id: "beacon-hill",
    name: "Beacon Hill Staffing Group",
    category: "tier1",
    url: "https://www.beaconhillstaffing.com/job-seekers",
    atsType: "direct",
    defaultRoles: ["Lead Python/FastAPI Engineer", "Snowflake Data Architect", "React/TypeScript UI Architect", "DevOps SRE"],
    headquarters: "Boston, MA",
    notes: "Elite specialty staffing firm servicing top tier tech and consulting clients.",
  },
  {
    id: "insight-global",
    name: "Insight Global",
    category: "tier1",
    url: "https://jobs.insightglobal.com/",
    atsType: "direct",
    defaultRoles: ["Full Stack Java Engineer", "Network Cloud Engineer", "QA Automation Lead", "Salesforce Admin"],
    headquarters: "Atlanta, GA",
    notes: "Over 70 offices across North America, Fortune 1000 supplier.",
  },
  {
    id: "robert-half",
    name: "Robert Half Technology",
    category: "tier1",
    url: "https://www.roberthalf.com/jobs/technology",
    atsType: "direct",
    defaultRoles: ["Data Analytics Lead", "Senior Python Backend Developer", "AWS Solutions Architect", "Product Manager"],
    headquarters: "Menlo Park, CA",
    notes: "Global talent solutions leader founded in 1948.",
  },
  {
    id: "randstad",
    name: "Randstad Technologies",
    category: "tier1",
    url: "https://www.randstadusa.com/jobs/search/technology/",
    atsType: "direct",
    defaultRoles: ["Enterprise Java Developer", "Kubernetes DevOps Engineer", "Mobile iOS/Android Lead", "Data Scientist"],
    headquarters: "Atlanta, GA",
    notes: "World's largest HR service provider and global staffing firm.",
  },
  {
    id: "addison-group",
    name: "Addison Group",
    category: "tier1",
    url: "https://www.addisongroup.com/positions/",
    atsType: "direct",
    defaultRoles: ["Cloud Systems Engineer", "Java Backend Developer", "Salesforce CPQ Developer", "Database Administrator"],
    headquarters: "Chicago, IL",
    notes: "Leading provider of professional services and talent solutions.",
  },
  {
    id: "akraya",
    name: "Akraya",
    category: "tier1",
    url: "http://akraya.com/career-opportunities/",
    atsType: "direct",
    defaultRoles: ["Machine Learning Engineer", "Frontend React Specialist", "AWS DevOps Engineer", "Technical Project Manager"],
    headquarters: "Santa Clara, CA",
    notes: "Silicon Valley award-winning staffing and managed solutions company.",
  },
  {
    id: "atr-international",
    name: "ATR International",
    category: "tier1",
    url: "https://atr.com/jobsearch/",
    atsType: "direct",
    defaultRoles: ["Java Spring Boot Engineer", "Cloud Security Architect", "Data Pipeline Engineer", "Site Reliability Engineer"],
    headquarters: "Sunnyvale, CA",
    notes: "Silicon Valley-based IT staffing firm partnering with major tech firms.",
  },

  // --- ATS & Recruitment Engine Portals ---
  {
    id: "bullhorn-alluvion",
    name: "Bullhorn Portal (Alluvion Staffing)",
    category: "ats",
    url: "http://cls5.bullhornstaffing.com/JobBoard/Standard/BHContent_JobOpportunities.cfm",
    atsType: "bullhorn",
    defaultRoles: ["Senior Java Cloud Engineer", "DevOps & CI/CD Specialist", "Salesforce Developer", "Data Analyst"],
    headquarters: "Jacksonville, FL",
    notes: "Direct Bullhorn ATS candidate and requirements engine.",
  },
  {
    id: "bullhorn-genesis",
    name: "Bullhorn Portal (Genesis10 / Tech Staffing)",
    category: "ats",
    url: "https://cls6.bullhornstaffing.com/JobBoard/Standard/BHContent_JobOpportunities.cfm",
    atsType: "bullhorn",
    defaultRoles: ["Full Stack Python/React", "AWS Kubernetes Engineer", "Enterprise Data Architect", "BI Reporting Lead"],
    headquarters: "New York, NY",
    notes: "High-volume enterprise talent engine on Bullhorn ATS.",
  },
  {
    id: "jobdiva-adept",
    name: "JobDiva Portal (Adept Solutions)",
    category: "ats",
    url: "http://jobs.adeptsolutionsinc.com/candidates/myjobs/searchjobsdone.jsp",
    atsType: "jobdiva",
    defaultRoles: ["Senior Java/Kafka Developer", "AWS Big Data Engineer", "Salesforce Architect", "QA Automation SDET"],
    headquarters: "Irving, TX",
    notes: "JobDiva-powered vendor recruitment exchange portal.",
  },
  {
    id: "jobdiva-apn",
    name: "JobDiva Portal (APN Consulting)",
    category: "ats",
    url: "http://jobs.apnconsultinginc.com/candidates/myjobs/searchjobsdone.jsp",
    atsType: "jobdiva",
    defaultRoles: ["Golang Backend Engineer", "Lead Data Engineer (Spark/Databricks)", "ServiceNow Developer", "Cloud Security"],
    headquarters: "Monmouth Junction, NJ",
    notes: "JobDiva ATS staffing engine specializing in Fortune 500 placements.",
  },
  {
    id: "cvtracer-access",
    name: "CVTracer Portal (Access Staffing)",
    category: "ats",
    url: "http://pro.cvtracer.com/public/481001036/jobpostings/job-list.jsp",
    atsType: "cvtracer",
    defaultRoles: ["Lead Java Microservices Developer", "Angular/React Frontend Lead", "AWS Solutions Architect", ".NET Architect"],
    headquarters: "New York, NY",
    notes: "CVTracer enterprise ATS job board.",
  },
  {
    id: "applicantstack-beyondsoft",
    name: "ApplicantStack Portal (Beyondsoft Consulting)",
    category: "ats",
    url: "http://beyondsoft.applicantstack.com/x/openings",
    atsType: "applicantstack",
    defaultRoles: ["Cloud Infrastructure Engineer", "AI/ML Engineer", "Senior Java Developer", "DevSecOps Specialist"],
    headquarters: "Bellevue, WA",
    notes: "ApplicantStack ATS enterprise careers portal.",
  },
  {
    id: "catsone-tech",
    name: "Catsone Portal (Global Tech Solutions)",
    category: "ats",
    url: "https://techsolutions.catsone.com/careers",
    atsType: "catsone",
    defaultRoles: ["Salesforce Technical Architect", "Full Stack Java Engineer", "Azure Data Engineer", "Python Automation Lead"],
    headquarters: "Austin, TX",
    notes: "Catsone applicant tracking and candidate submission portal.",
  },
  {
    id: "taleo-attain",
    name: "Oracle Taleo Portal (Attain / Tech Consulting)",
    category: "ats",
    url: "http://chp.tbe.taleo.net/chp02/ats/careers/jobSearch.jsp",
    atsType: "taleo",
    defaultRoles: ["Senior Cloud Systems Engineer", "Java/Spring Cloud Developer", "Cyber Risk Consultant", "Data Governance Lead"],
    headquarters: "McLean, VA",
    notes: "Oracle Taleo enterprise recruitment cloud system.",
  },

  // --- IT Consultancies & System Integrators ---
  {
    id: "tcs",
    name: "Tata Consultancy Services (TCS)",
    category: "consulting",
    url: "https://www.tcs.com/careers",
    atsType: "direct",
    defaultRoles: ["Senior Java/Kafka Developer", "AWS Cloud Architect", "Full Stack React/Node", "Snowflake Engineer"],
    headquarters: "Edison, NJ (US HQ)",
    notes: "Global IT consultancy with massive ongoing client requirements.",
  },
  {
    id: "infosys",
    name: "Infosys",
    category: "consulting",
    url: "https://www.infosys.com/careers.html",
    atsType: "direct",
    defaultRoles: ["Lead Java Backend Developer", "Salesforce Technical Consultant", "Data Engineering Lead", "GCP Cloud Engineer"],
    headquarters: "Richardson, TX (US HQ)",
    notes: "Tier-1 system integrator with prime accounts across US banking and retail.",
  },
  {
    id: "cognizant",
    name: "Cognizant",
    category: "consulting",
    url: "https://careers.cognizant.com/global/en",
    atsType: "direct",
    defaultRoles: ["Full Stack Java/Angular", "Cloud DevOps Architect", "AI Prompt & ML Engineer", "Big Data Specialist"],
    headquarters: "Teaneck, NJ",
    notes: "Fortune 200 IT giant with large-scale contract and consulting pipelines.",
  },
  {
    id: "capgemini",
    name: "Capgemini",
    category: "consulting",
    url: "https://www.capgemini.com/careers/",
    atsType: "direct",
    defaultRoles: ["Cloud Migration Architect", "Salesforce CPQ & Billing", "Senior Java Microservices", "Data Modeler"],
    headquarters: "Chicago, IL (US HQ)",
    notes: "Global leader in consulting, digital transformation and engineering.",
  },
  {
    id: "wipro",
    name: "Wipro",
    category: "consulting",
    url: "https://careers.wipro.com/",
    atsType: "direct",
    defaultRoles: ["AWS DevOps Engineer", "Cybersecurity Specialist", "Java Spring Boot Lead", "Snowflake Developer"],
    headquarters: "East Brunswick, NJ (US HQ)",
    notes: "Tier-1 tech vendor servicing health, finance, and manufacturing.",
  },

  // --- Boutique & Specialized Staffing Portals ---
  {
    id: "2rb-consulting",
    name: "2RB Consulting",
    category: "boutique",
    url: "http://www.2rbconsulting.com/jobs/",
    atsType: "direct",
    defaultRoles: ["Senior Java Developer", "Cloud Solutions Architect", "DevOps Engineer"],
    headquarters: "Kirkland, WA",
    notes: "Pacific Northwest specialized IT and cloud staffing consultancy.",
  },
  {
    id: "3cords-solutions",
    name: "3 Cords Solutions",
    category: "boutique",
    url: "http://3cordssolutions.com/careers/",
    atsType: "direct",
    defaultRoles: ["Full Stack Java Engineer", "Python Backend Developer", "QA Automation Lead"],
    headquarters: "Plano, TX",
    notes: "Texas-based recruitment solutions partner.",
  },
  {
    id: "abacus-service",
    name: "Abacus Service Corporation",
    category: "boutique",
    url: "https://abacusgrpllc.com/positions/listing",
    atsType: "direct",
    defaultRoles: ["Senior .NET Core Engineer", "Data Pipeline Engineer", "Salesforce Admin"],
    headquarters: "Southfield, MI",
    notes: "National staffing and recruitment firm established in 1944.",
  },
  {
    id: "axelon-services",
    name: "Axelon Services Corporation",
    category: "boutique",
    url: "http://www.axelon.com/search-jobs/",
    atsType: "direct",
    defaultRoles: ["Senior Java/Spring Boot Developer", "AWS Cloud Infrastructure Lead", "Data Analyst"],
    headquarters: "New York, NY",
    notes: "Over 40 years servicing Fortune 500 financial and IT leaders.",
  },
  {
    id: "bravotech",
    name: "BravoTECH",
    category: "boutique",
    url: "https://bravotech.com/jobs/",
    atsType: "direct",
    defaultRoles: ["DevOps & SRE Engineer", "Full Stack TypeScript/React", "Enterprise Architect"],
    headquarters: "Dallas, TX",
    notes: "Premier Dallas-Fort Worth technical staffing firm.",
  },
  {
    id: "aboutweb",
    name: "AboutWeb",
    category: "boutique",
    url: "http://www.aboutweb.com/careers/jobs",
    atsType: "direct",
    defaultRoles: ["Cybersecurity Specialist", "Full Stack Developer", "Cloud Architect"],
    headquarters: "Rockville, MD",
    notes: "Public and private sector IT solutions provider.",
  },
];

const featuredIds = new Set(FEATURED_VENDOR_PORTALS.map((f) => f.id));
const rawList = allVendorPortalsRaw as VendorPortal[];

export const VENDOR_PORTALS: VendorPortal[] = [
  ...FEATURED_VENDOR_PORTALS,
  ...rawList.filter((p) => !featuredIds.has(p.id)),
];

/**
 * Automatically inspects a URL or company name and determines which vendor or portal it matches.
 */
export function identifyVendor(input: string): VendorPortal {
  const clean = input.toLowerCase().trim();

  // Try exact match or sub-match by ID
  const matchById = VENDOR_PORTALS.find((v) => v.id === clean);
  if (matchById) return matchById;

  // Try match by portal URL domain
  for (const portal of VENDOR_PORTALS) {
    try {
      const pUrl = new URL(portal.url);
      if (clean.includes(pUrl.hostname.replace(/^www\./, ""))) {
        return portal;
      }
    } catch {
      // ignore
    }
    if (clean.includes(portal.name.toLowerCase())) {
      return portal;
    }
  }

  // Detect ATS patterns
  let atsType: VendorPortal["atsType"] = "direct";
  let category: VendorPortal["category"] = "boutique";

  if (clean.includes("bullhornstaffing")) {
    atsType = "bullhorn";
    category = "ats";
  } else if (clean.includes("jobdiva")) {
    atsType = "jobdiva";
    category = "ats";
  } else if (clean.includes("catsone")) {
    atsType = "catsone";
    category = "ats";
  } else if (clean.includes("taleo")) {
    atsType = "taleo";
    category = "ats";
  } else if (clean.includes("applicantstack")) {
    atsType = "applicantstack";
    category = "ats";
  } else if (clean.includes("cvtracer")) {
    atsType = "cvtracer";
    category = "ats";
  }

  // Extract a sensible readable name from URL or text
  let inferredName = "Custom Vendor Portal";
  try {
    const parsed = new URL(input.startsWith("http") ? input : `https://${input}`);
    const host = parsed.hostname.replace(/^www\./, "").split(".")[0];
    inferredName = host.charAt(0).toUpperCase() + host.slice(1) + " Portal";
  } catch {
    inferredName = input.slice(0, 30);
  }

  return {
    id: `custom-${Date.now()}`,
    name: inferredName,
    category,
    url: input.startsWith("http") ? input : `https://${input}`,
    atsType,
    defaultRoles: ["Senior Java Developer", "Cloud Solutions Architect", "DevOps Engineer", "Data Engineer"],
    notes: `Scraped from custom portal link: ${input}`,
  };
}

export function getVendorsByCategory(cat: "all" | VendorPortal["category"]): VendorPortal[] {
  if (cat === "all") return VENDOR_PORTALS;
  return VENDOR_PORTALS.filter((v) => v.category === cat);
}
