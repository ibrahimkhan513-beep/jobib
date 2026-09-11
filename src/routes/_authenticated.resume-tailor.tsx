import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertTriangle, Sparkles, CheckCircle2, Loader2, Copy, Check, Printer, FileText, Send, ArrowUpRight,
  Zap, Key, ExternalLink, Download, Eye, Code, Briefcase, GraduationCap,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useConsultants, useRequirements, type JDAnalysisResult } from "@/lib/api";
import { analyzeJDLocally, buildTailoredResumeDocument } from "@/lib/resume-engine";
import {
  callGroqAI, getStoredGroqKey, setStoredGroqKey, clearStoredGroqKey,
} from "@/lib/groq-client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/resume-tailor")({
  validateSearch: (search: Record<string, unknown>): { consultantId?: string; reqId?: string } => {
    return {
      consultantId: typeof search.consultantId === "string" ? search.consultantId : undefined,
      reqId: typeof search.reqId === "string" ? search.reqId : undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "Resume Tailor — Jobib" },
      { name: "description", content: "AI-tailored resume bullets, JD skills extraction, and resume document generator." },
    ],
  }),
  component: ResumeTailorPage,
});

function ResumeTailorPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();

  const { data: consultants = [] } = useConsultants();
  const { data: requirements = [] } = useRequirements();
  const [jd, setJd] = useState("");
  const [selectedReqId, setSelectedReqId] = useState<string>(search.reqId ?? "");
  const [consultantId, setConsultantId] = useState<string>(search.consultantId ?? "none");
  const [result, setResult] = useState<JDAnalysisResult | null>(null);
  const [engineUsed, setEngineUsed] = useState<"nlp" | "groq" | null>(null);
  const [usedModelName, setUsedModelName] = useState<string>("LLaMA");
  const [activeTab, setActiveTab] = useState("analysis");
  const [copiedResume, setCopiedResume] = useState(false);
  const [copiedBullets, setCopiedBullets] = useState(false);
  const [resumeViewMode, setResumeViewMode] = useState<"document" | "text">("document");

  // Engine loading states
  const [isNlpLoading, setIsNlpLoading] = useState(false);
  const [isGroqLoading, setIsGroqLoading] = useState(false);

  // Groq API Key modal & state
  const [hasGroqKey, setHasGroqKey] = useState(false);
  const [groqKeyOpen, setGroqKeyOpen] = useState(false);
  const [groqKeyInput, setGroqKeyInput] = useState("");

  useEffect(() => {
    setHasGroqKey(Boolean(getStoredGroqKey()));
  }, []);

  // Pre-fill from query params or requirement selection
  useEffect(() => {
    if (search.reqId) {
      setSelectedReqId(search.reqId);
      const req = requirements.find((r) => r.id === search.reqId);
      if (req?.jd_text) setJd(req.jd_text);
    }
    if (search.consultantId) {
      setConsultantId(search.consultantId);
    }
  }, [search.reqId, search.consultantId, requirements]);

  function handleSelectRequirement(reqId: string) {
    setSelectedReqId(reqId);
    if (reqId === "manual") {
      setJd("");
      return;
    }
    const r = requirements.find((req) => req.id === reqId);
    if (r) {
      const formatted = `${r.title} — ${r.client_masked || r.vendor_name || ""}\n\nRequired Skills: ${(r.tech_stack ?? []).join(", ")}\nLocation: ${[r.location_city, r.location_state].filter(Boolean).join(", ")}\n\n${r.jd_text || ""}`;
      setJd(formatted);
      toast.success(`Loaded JD for ${r.title}`);
    }
  }

  const selectedConsultant = consultants.find((c: any) => c.id === consultantId) || null;

  // --- Engine 1: Fast Built-in NLP (Offline, Deterministic, 0s) ---
  function handleRunNlp() {
    if (!jd.trim()) {
      toast.error("Please paste or load a Job Description first");
      return;
    }
    setIsNlpLoading(true);
    try {
      const localResult = analyzeJDLocally(jd, selectedConsultant);
      setResult(localResult);
      setEngineUsed("nlp");
      toast.success("Tailored with Fast Built-in NLP Engine!");
    } catch (err) {
      console.error("Local NLP analysis error:", err);
      toast.error("Error analyzing JD with local NLP engine.");
    } finally {
      setIsNlpLoading(false);
    }
  }

  // --- Engine 2: Groq AI Deep Tailor (LLaMA 3.3 70B) ---
  async function handleRunGroq(overrideKey?: string) {
    if (!jd.trim()) {
      toast.error("Please paste or load a Job Description first");
      return;
    }

    const key = (overrideKey || getStoredGroqKey()).trim();
    if (!key) {
      setGroqKeyInput("");
      setGroqKeyOpen(true);
      return;
    }

    setIsGroqLoading(true);
    try {
      const aiResult = await callGroqAI({
        jdText: jd,
        consultant: selectedConsultant
          ? {
              full_name: selectedConsultant.full_name,
              tech_stack: selectedConsultant.tech_stack ?? [],
              years_experience: selectedConsultant.years_experience,
              last_project_title: selectedConsultant.last_project_title,
              last_client_type: selectedConsultant.last_client_type,
              last_project_duration: selectedConsultant.last_project_duration,
            }
          : null,
        apiKey: key,
      });
      const modelLabel = (aiResult as any).modelUsed || "LLaMA";
      setUsedModelName(modelLabel);
      setResult(aiResult);
      setEngineUsed("groq");
      toast.success(`Tailored with Groq AI (${modelLabel})!`);
    } catch (err: any) {
      console.error("Groq AI analysis error:", err);
      if (err.message === "GROQ_API_KEY_REQUIRED" || err.message?.includes("Invalid Groq API Key")) {
        toast.error("Groq API key required or invalid. Please configure your key.");
        setGroqKeyOpen(true);
      } else {
        toast.error(err.message || "Failed to generate with Groq AI.");
      }
    } finally {
      setIsGroqLoading(false);
    }
  }

  function handleSaveKeyAndRun() {
    const key = groqKeyInput.trim();
    if (!key) {
      toast.error("Please paste a valid Groq API Key");
      return;
    }
    setStoredGroqKey(key);
    setHasGroqKey(true);
    setGroqKeyOpen(false);
    toast.success("Groq API Key saved successfully!");
    handleRunGroq(key);
  }

  function handleRemoveKey() {
    clearStoredGroqKey();
    setHasGroqKey(false);
    setGroqKeyInput("");
    setGroqKeyOpen(false);
    toast.success("Groq API Key removed.");
  }

  const fullResumeText = selectedConsultant && result
    ? buildTailoredResumeDocument(selectedConsultant, result, requirements.find((r) => r.id === selectedReqId)?.title)
    : "";

  async function handleCopyResume() {
    if (!fullResumeText) return;
    await navigator.clipboard.writeText(fullResumeText);
    setCopiedResume(true);
    toast.success("Full tailored resume copied to clipboard!");
    setTimeout(() => setCopiedResume(false), 2500);
  }

  async function handleCopyBullets() {
    if (!result?.tailored_bullets.length) return;
    const bullets = result.tailored_bullets.map((b) => `• ${b.tailored}`).join("\n\n");
    await navigator.clipboard.writeText(bullets);
    setCopiedBullets(true);
    toast.success("Tailored bullets copied!");
    setTimeout(() => setCopiedBullets(false), 2500);
  }

  function handleDownloadTxt() {
    if (!fullResumeText) return;
    const blob = new Blob([fullResumeText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const safeName = (selectedConsultant?.full_name || "Consultant").replace(/\s+/g, "_");
    link.download = `${safeName}_Tailored_Resume.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Downloaded tailored resume (.txt)!");
  }

  function handlePrintResume() {
    if (!selectedConsultant || !result) {
      if (fullResumeText) {
        window.print();
      }
      return;
    }
    const targetTitle = requirements.find((r) => r.id === selectedReqId)?.title || selectedConsultant.last_project_title || "Senior Software Consultant";
    const allSkills = Array.from(new Set([...result.must_have_skills, ...(selectedConsultant.tech_stack ?? [])])).join(" • ");
    const bulletsHtml = result.tailored_bullets
      .map((b) => `<li style="margin-bottom: 6px; line-height: 1.45;">${b.tailored}</li>`)
      .join("");

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${selectedConsultant.full_name} — Tailored Resume</title>
          <style>
            @page { margin: 15mm; size: auto; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.45; color: #111; max-width: 800px; margin: 0 auto; padding: 20px; font-size: 10.5pt; }
            h1 { font-size: 18pt; margin: 0 0 2px 0; text-align: center; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700; }
            .title { text-align: center; font-size: 11pt; font-weight: 600; color: #2563eb; margin-bottom: 4px; }
            .contact { text-align: center; font-size: 9pt; color: #555; margin-bottom: 14px; border-bottom: 1.5px solid #222; padding-bottom: 8px; }
            h2 { font-size: 10.5pt; text-transform: uppercase; border-bottom: 1px solid #aaa; padding-bottom: 2px; margin-top: 14px; margin-bottom: 6px; letter-spacing: 0.5px; color: #111; font-weight: 700; }
            p { margin: 4px 0 8px 0; text-align: justify; }
            ul { margin: 4px 0 10px 18px; padding: 0; }
            .role-header { display: flex; justify-content: space-between; font-weight: 700; margin-top: 6px; font-size: 10pt; }
            .company { font-style: italic; color: #444; font-size: 9.5pt; margin-bottom: 4px; }
          </style>
        </head>
        <body>
          <h1>${selectedConsultant.full_name}</h1>
          <div class="title">${targetTitle}</div>
          <div class="contact">
            ${selectedConsultant.email || "consultant@bench.dev"} &nbsp;|&nbsp; ${selectedConsultant.phone || "+1 (555) 019-2834"} &nbsp;|&nbsp; Dallas, TX &nbsp;|&nbsp; ${selectedConsultant.work_authorization ? 'Auth: ' + selectedConsultant.work_authorization : 'US Work Authorized'}
          </div>

          <h2>Professional Summary</h2>
          <p>Results-driven ${result.seniority} with ${selectedConsultant.years_experience ?? 5}+ years of proven expertise in ${result.domain}. Deep technical specialization in ${result.must_have_skills.slice(0, 4).join(", ")}, with a demonstrated track record of delivering scalable solutions addressing core business challenges including ${result.pain_points[0] || "modern enterprise architectures"}. Experienced across high-velocity teams delivering resilient production systems.</p>

          <h2>Technical Expertise</h2>
          <p>${allSkills}</p>

          <h2>Highlighted Professional Experience</h2>
          <div class="role-header">
            <span>${selectedConsultant.last_project_title || targetTitle}</span>
            <span>${selectedConsultant.last_project_duration || "Recent"}</span>
          </div>
          <div class="company">${selectedConsultant.last_client_type || result.domain} Client Environment</div>
          <ul>${bulletsHtml}</ul>

          <h2>Education & Credentials</h2>
          <ul>
            <li>Bachelor of Science in Computer Science / Information Systems</li>
            <li>Verified US Technical Screening & Background Check by Jobib Bench Operations</li>
          </ul>

          <script>window.onload = function() { window.print(); };</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }

  return (
    <div>
      <PageHeader
        title="AI Resume Tailor & Generator"
        subtitle="Extract required skills, tailor XYZ impact bullets, and generate submission-ready resumes."
      />

      <div className="grid gap-6 p-6 lg:grid-cols-12">
        {/* Left column: JD & Consultant Inputs (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-xl border border-border bg-surface p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Target Role & JD</h2>
              {requirements.length > 0 && (
                <span className="text-[11px] text-muted-foreground">Load from pipeline</span>
              )}
            </div>

            {/* Quick selector from existing requirements */}
            {requirements.length > 0 && (
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Select from active requirements</Label>
                <Select value={selectedReqId} onValueChange={handleSelectRequirement}>
                  <SelectTrigger className="mt-1 text-xs">
                    <SelectValue placeholder="Or paste manually below…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual Paste / Custom JD</SelectItem>
                    {requirements.map((r: any) => (
                      <SelectItem key={r.id} value={r.id} className="text-xs">
                        {r.title} ({r.client_masked || r.vendor_name || "Direct"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label className="text-xs font-medium text-muted-foreground">Job Description Text</Label>
              <Textarea
                value={jd}
                onChange={(e) => setJd(e.target.value)}
                rows={11}
                placeholder="Paste the target JD here (skills, responsibilities, deliverables)…"
                className="mt-1 text-xs leading-relaxed"
              />
            </div>

            <div>
              <Label className="text-xs font-medium text-muted-foreground">Select Consultant to Tailor For</Label>
              <Select value={consultantId} onValueChange={setConsultantId}>
                <SelectTrigger className="mt-1 text-xs">
                  <SelectValue placeholder="Choose consultant…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">JD Skills Extraction Only (No candidate)</SelectItem>
                  {consultants.map((c: any) => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">
                      {c.full_name} ({c.years_experience}y · {(c.tech_stack ?? []).slice(0, 3).join(", ")})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Dual Actions: NLP vs Groq AI */}
            <div className="space-y-2 pt-2 border-t border-border">
              <Button
                variant="outline"
                className="w-full justify-between h-10 px-3.5 border-border hover:bg-muted font-medium"
                onClick={handleRunNlp}
                disabled={!jd.trim() || isNlpLoading || isGroqLoading}
              >
                <div className="flex items-center gap-2">
                  {isNlpLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
                  ) : (
                    <Zap className="h-4 w-4 text-amber-500" />
                  )}
                  <span className="text-xs font-semibold">⚡ Fast NLP Tailor</span>
                </div>
                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border">
                  Instant · Offline
                </span>
              </Button>

              <Button
                className="w-full justify-between h-10 px-3.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-sm border-0"
                onClick={() => handleRunGroq()}
                disabled={!jd.trim() || isNlpLoading || isGroqLoading}
              >
                <div className="flex items-center gap-2">
                  {isGroqLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                  ) : (
                    <Sparkles className="h-4 w-4 text-purple-200" />
                  )}
                  <span className="text-xs font-semibold">✨ Groq AI Deep Tailor</span>
                </div>
                <span className="text-[10px] bg-white/20 text-white px-1.5 py-0.5 rounded font-mono font-medium">
                  Groq Cloud AI
                </span>
              </Button>

              {/* API Key status & quick config */}
              <div className="flex items-center justify-between px-1 pt-1 text-[11px] text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${hasGroqKey ? "bg-emerald-500" : "bg-amber-400"}`} />
                  <span>{hasGroqKey ? "Groq API key saved" : "Groq API key: optional (Free)"}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setGroqKeyInput(getStoredGroqKey());
                    setGroqKeyOpen(true);
                  }}
                  className="text-primary hover:underline flex items-center gap-1 font-medium"
                >
                  <Key className="h-3 w-3" />
                  {hasGroqKey ? "Change Key" : "Add Key"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right column: Results & Full Resume View (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="flex items-center justify-between pb-2">
              <TabsList className="bg-muted">
                <TabsTrigger value="analysis" className="text-xs">
                  Skills & Bullets
                </TabsTrigger>
                <TabsTrigger value="resume" className="text-xs flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  Full Resume Preview
                  {selectedConsultant && result && (
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />
                  )}
                </TabsTrigger>
              </TabsList>

              {result && selectedConsultant && activeTab === "resume" && (
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center rounded-lg border border-border bg-muted/60 p-0.5">
                    <Button
                      variant={resumeViewMode === "document" ? "secondary" : "ghost"}
                      size="sm"
                      className="h-6 px-2 text-[11px]"
                      onClick={() => setResumeViewMode("document")}
                    >
                      <Eye className="mr-1 h-3 w-3" /> Formatted
                    </Button>
                    <Button
                      variant={resumeViewMode === "text" ? "secondary" : "ghost"}
                      size="sm"
                      className="h-6 px-2 text-[11px]"
                      onClick={() => setResumeViewMode("text")}
                    >
                      <Code className="mr-1 h-3 w-3" /> ATS Text
                    </Button>
                  </div>

                  <Button variant="outline" size="sm" onClick={handleDownloadTxt} className="h-7 text-xs" title="Download .txt file">
                    <Download className="mr-1 h-3.5 w-3.5" /> .txt
                  </Button>
                  <Button variant="outline" size="sm" onClick={handlePrintResume} className="h-7 text-xs">
                    <Printer className="mr-1.5 h-3.5 w-3.5" /> Print / PDF
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleCopyResume} className="h-7 text-xs">
                    {copiedResume ? <Check className="mr-1.5 h-3.5 w-3.5 text-green-500" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
                    {copiedResume ? "Copied!" : "Copy"}
                  </Button>
                </div>
              )}
            </div>

            {/* Active Engine Indicator Badge */}
            {result && engineUsed && (
              <div className="flex items-center justify-between py-1.5 px-3 rounded-lg border text-xs bg-muted/40 mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-[11px]">Active Engine:</span>
                  {engineUsed === "groq" ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-purple-700 dark:text-purple-300 bg-purple-500/10 px-2.5 py-0.5 rounded-full border border-purple-300 dark:border-purple-800 text-[11px]">
                      <Sparkles className="h-3 w-3 text-purple-600" /> Groq AI ({usedModelName})
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-300 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-300 dark:border-amber-800 text-[11px]">
                      <Zap className="h-3 w-3 text-amber-600" /> Fast Built-in NLP Engine
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-muted-foreground hidden sm:inline">
                  {engineUsed === "groq" ? "Bespoke LLM contextual synthesis" : "Rule-based instant extraction"}
                </span>
              </div>
            )}

            {/* Tab 1: Skills & Bullets */}
            <TabsContent value="analysis" className="space-y-4 mt-0">
              {/* JD Analysis Card */}
              <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-foreground">JD Intelligence & Extracted Skills</h2>
                {!result ? (
                  <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
                    Paste or load a JD on the left, then click <strong>⚡ Fast NLP Tailor</strong> (instant offline) or <strong>✨ Groq AI Deep Tailor</strong> (bespoke LLaMA 3.3) to synthesize tailored resume bullets.
                  </p>
                ) : (
                  <div className="mt-3 space-y-3 text-sm">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Must-Have Core Skills ({result.must_have_skills.length})
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {result.must_have_skills.map((s) => (
                          <span
                            key={s}
                            className="rounded-md bg-primary/10 border border-primary/20 px-2 py-0.5 text-xs font-semibold text-primary"
                          >
                            ✓ {s}
                          </span>
                        ))}
                      </div>
                    </div>

                    {result.nice_to_have_skills.length > 0 && (
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Preferred / Nice-to-Have
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {result.nice_to_have_skills.map((s) => (
                            <span
                              key={s}
                              className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-4 text-xs pt-1 border-t border-border">
                      <div>
                        <span className="text-muted-foreground">Domain: </span>
                        <span className="font-semibold text-foreground">{result.domain}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Target Seniority: </span>
                        <span className="font-semibold text-foreground">{result.seniority}</span>
                      </div>
                    </div>

                    {result.pain_points.length > 0 && (
                      <div className="pt-1">
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Client Core Pain Points
                        </div>
                        <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                          {result.pain_points.map((p) => (
                            <li key={p}>{p}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Tailored Bullets (Before -> After) */}
              <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-foreground">Tailored Impact Bullets (XYZ Format)</h2>
                  {result && result.tailored_bullets.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={handleCopyBullets} className="h-6 text-[11px]">
                      {copiedBullets ? <Check className="mr-1 h-3 w-3 text-green-500" /> : <Copy className="mr-1 h-3 w-3" />}
                      {copiedBullets ? "Copied!" : "Copy Bullets"}
                    </Button>
                  )}
                </div>

                {!result ? (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Select a consultant and run analysis to view tailored XYZ resume bullets.
                  </p>
                ) : result.tailored_bullets.length === 0 ? (
                  <p className="mt-3 text-xs text-muted-foreground">
                    No consultant selected. Choose a candidate from the dropdown to craft tailored bullets.
                  </p>
                ) : (
                  <div className="mt-3 space-y-3 text-sm">
                    {result.tailored_bullets.map((b, i) => (
                      <div key={i} className="rounded-lg border border-border p-3 space-y-2 bg-muted/20">
                        <div className="text-[11px] text-muted-foreground">
                          <span className="font-semibold text-destructive/70">Standard: </span>
                          <span className="italic">{b.original}</span>
                        </div>
                        <div className="text-xs font-medium text-foreground rounded bg-primary/5 border border-primary/20 p-2.5">
                          <CheckCircle2 className="mr-1.5 inline h-3.5 w-3.5 text-primary" />
                          {b.tailored}
                        </div>
                      </div>
                    ))}

                    <div className="pt-2 flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => setActiveTab("resume")}
                      >
                        <FileText className="mr-1.5 h-3.5 w-3.5" /> View Full Formatted Resume
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Ghost Job Signal Box */}
              {result && (
                <div
                  className={`rounded-xl border p-4 ${
                    result.ghost_job.is_ghost
                      ? "border-score-low/30 bg-score-low/10 text-score-low"
                      : "border-score-high/30 bg-score-high/10 text-score-high"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    <h3 className="text-xs font-bold uppercase tracking-wider">
                      {result.ghost_job.is_ghost ? "High Ghost Job Risk" : "Legitimate Job Posting Verified"}
                    </h3>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {result.ghost_job.is_ghost
                      ? `Flagged with ${result.ghost_job.confidence}% confidence. Reasons: ${result.ghost_job.reasons.join(" · ")}`
                      : `Confidence: ${result.ghost_job.confidence}%. ${result.ghost_job.reasons.join(" · ")}`}
                  </p>
                </div>
              )}
            </TabsContent>

            {/* Tab 2: Full Resume Preview */}
            <TabsContent value="resume" className="space-y-4 mt-0">
              {!selectedConsultant || !result ? (
                <div className="rounded-xl border border-dashed border-border bg-surface p-8 text-center space-y-4">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <FileText className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-foreground">
                      {!selectedConsultant
                        ? "Select a Bench Candidate to Generate Full Resume"
                        : "Run Tailoring to Synthesize Full Resume"}
                    </h3>
                    <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
                      {!selectedConsultant
                        ? "The Full Resume Preview synthesizes an end-to-end client-ready resume combining the candidate's real profile, your target JD's required skills, and tailored XYZ impact bullets."
                        : `Candidate "${selectedConsultant.full_name}" is selected! Click either ⚡ Fast NLP Tailor or ✨ Groq AI Deep Tailor on the left to synthesize their tailored document.`}
                    </p>
                  </div>

                  {!selectedConsultant && consultants.length > 0 && (
                    <div className="pt-2">
                      <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        Quick Select from Bench:
                      </div>
                      <div className="flex flex-wrap justify-center gap-2">
                        {consultants.slice(0, 4).map((c: any) => (
                          <Button
                            key={c.id}
                            variant="outline"
                            size="sm"
                            className="text-xs border-primary/30 hover:bg-primary/5 hover:border-primary"
                            onClick={() => {
                              setConsultantId(c.id);
                              toast.info(`Selected ${c.full_name}. Now hit Fast NLP or Groq AI to tailor!`);
                            }}
                          >
                            <span className="font-semibold text-foreground">{c.full_name}</span>
                            <span className="ml-1 text-[10px] text-muted-foreground">({c.years_experience}y)</span>
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedConsultant && !result && (
                    <div className="pt-2 flex justify-center gap-2">
                      <Button size="sm" variant="outline" onClick={handleRunNlp} disabled={!jd.trim() || isNlpLoading}>
                        <Zap className="mr-1.5 h-3.5 w-3.5 text-amber-500" /> Run Fast NLP Tailor
                      </Button>
                      <Button size="sm" onClick={() => handleRunGroq()} disabled={!jd.trim() || isGroqLoading} className="bg-purple-600 hover:bg-purple-700 text-white">
                        <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Run Groq AI Deep Tailor
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Top Bar for Submission */}
                  <div className="rounded-xl border border-border bg-surface px-5 py-3 shadow-sm flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold text-foreground flex items-center gap-2">
                        <span>{selectedConsultant.full_name}</span>
                        <span className="text-xs font-normal text-muted-foreground">— Tailored for {requirements.find((r) => r.id === selectedReqId)?.title || "Target Position"}</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Ready for ATS submission, Vendor Portal uploading, or Account Manager client pitches.
                      </div>
                    </div>

                    {selectedReqId && selectedReqId !== "manual" ? (
                      <Button
                        size="sm"
                        className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs"
                        onClick={() =>
                          navigate({
                            to: "/submit",
                            search: { reqId: selectedReqId, consultantId: selectedConsultant?.id },
                          })
                        }
                      >
                        <Send className="mr-1.5 h-3.5 w-3.5" /> Submit to Pipeline
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs"
                        onClick={handleCopyResume}
                      >
                        <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy for Submission
                      </Button>
                    )}
                  </div>

                  {/* Document View Mode */}
                  {resumeViewMode === "document" ? (
                    <div className="rounded-xl border border-border bg-white dark:bg-zinc-950 text-foreground p-8 shadow-sm space-y-6 max-w-[850px] mx-auto">
                      {/* Header */}
                      <div className="text-center border-b border-border/80 pb-5 space-y-1">
                        <h1 className="text-2xl font-black tracking-wider uppercase text-foreground">
                          {selectedConsultant.full_name}
                        </h1>
                        <div className="text-sm font-bold text-primary tracking-wide">
                          {requirements.find((r) => r.id === selectedReqId)?.title || selectedConsultant.last_project_title || "Senior Technical Consultant"}
                        </div>
                        <div className="pt-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground font-medium">
                          <span>{selectedConsultant.email || "consultant@bench.dev"}</span>
                          <span>•</span>
                          <span>{selectedConsultant.phone || "+1 (555) 019-2834"}</span>
                          <span>•</span>
                          <span>Dallas, TX (Open to Relocation / Remote)</span>
                          <span>•</span>
                          <span className="font-bold text-foreground">
                            {selectedConsultant.work_authorization ? `Auth: ${selectedConsultant.work_authorization}` : "US Work Authorized"}
                          </span>
                        </div>
                      </div>

                      {/* Executive Professional Summary */}
                      <div>
                        <h3 className="text-xs font-black uppercase tracking-wider text-foreground border-b border-border/60 pb-1 mb-2">
                          Professional Summary
                        </h3>
                        <p className="text-xs leading-relaxed text-foreground/90 text-justify">
                          Results-driven {result.seniority} with {selectedConsultant.years_experience ?? 5}+ years of progressive, hands-on engineering experience in {result.domain}. Demonstrated specialization in {result.must_have_skills.slice(0, 4).join(", ")}, with a proven record of designing and delivering high-throughput, fault-tolerant solutions addressing core client business challenges including {result.pain_points[0] || "scalable system performance"}. Experienced in fast-paced agile engineering teams delivering high-visibility production deliverables.
                        </p>
                      </div>

                      {/* Technical Competencies Matrix */}
                      <div>
                        <h3 className="text-xs font-black uppercase tracking-wider text-foreground border-b border-border/60 pb-1 mb-2.5">
                          Technical Competencies
                        </h3>
                        <div className="space-y-1.5 text-xs">
                          <div>
                            <span className="font-bold text-foreground">Target Role Priority Skills: </span>
                            <span className="text-muted-foreground">{result.must_have_skills.join(", ")}</span>
                          </div>
                          {selectedConsultant.tech_stack && selectedConsultant.tech_stack.length > 0 && (
                            <div>
                              <span className="font-bold text-foreground">Core Tech Stack: </span>
                              <span className="text-muted-foreground">{selectedConsultant.tech_stack.join(", ")}</span>
                            </div>
                          )}
                          <div>
                            <span className="font-bold text-foreground">Domain & Methodologies: </span>
                            <span className="text-muted-foreground">{result.domain}, Microservices, Distributed Systems, CI/CD Pipelines, Agile/Scrum</span>
                          </div>
                        </div>
                      </div>

                      {/* Highlighted Project Experience with XYZ Bullets */}
                      <div>
                        <h3 className="text-xs font-black uppercase tracking-wider text-foreground border-b border-border/60 pb-1 mb-3">
                          Highlighted Professional Experience
                        </h3>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-bold text-sm text-foreground">
                                {selectedConsultant.last_project_title || "Senior Enterprise Consultant"}
                              </div>
                              <div className="text-xs font-medium text-primary">
                                {selectedConsultant.last_client_type || result.domain} Client Workloads
                              </div>
                            </div>
                            <div className="text-xs font-mono font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded border border-border">
                              {selectedConsultant.last_project_duration || "Recent / 2+ Yrs"}
                            </div>
                          </div>

                          <ul className="space-y-2 text-xs">
                            {result.tailored_bullets.map((b, i) => (
                              <li key={i} className="flex items-start gap-2 leading-relaxed">
                                <span className="text-primary font-bold mt-0.5">•</span>
                                <span className="text-foreground/90">{b.tailored}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {/* Education & Verified Background */}
                      <div>
                        <h3 className="text-xs font-black uppercase tracking-wider text-foreground border-b border-border/60 pb-1 mb-2">
                          Education & Credentials
                        </h3>
                        <ul className="space-y-1 text-xs text-muted-foreground">
                          <li>• Bachelor of Science in Computer Science / Information Systems</li>
                          <li>• Work Authorization & Technical Screening Verified by Jobib Bench Operations</li>
                        </ul>
                      </div>
                    </div>
                  ) : (
                    /* ATS Plain Text View */
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                        <span>Plain text document (Ideal for ATS pasting, emails, and dice/vendor forms):</span>
                        <Button variant="ghost" size="sm" onClick={handleCopyResume} className="h-6 text-xs text-primary">
                          {copiedResume ? "Copied to Clipboard!" : "Copy Full Text"}
                        </Button>
                      </div>
                      <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed rounded-lg border border-border bg-muted/40 p-5 text-foreground overflow-x-auto">
                        {fullResumeText}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Groq Key Modal */}
      <Dialog open={groqKeyOpen} onOpenChange={setGroqKeyOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              Connect Free Groq API Key
            </DialogTitle>
            <DialogDescription className="text-xs">
              Jobib uses Groq's high-speed cloud AI models for bespoke contextual resume bullets and deep JD insights.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="rounded-lg border border-purple-200 bg-purple-50/50 dark:bg-purple-950/20 p-3 text-xs text-muted-foreground space-y-1.5">
              <div className="font-semibold text-purple-900 dark:text-purple-200">How to get your free key (30 seconds):</div>
              <ol className="list-decimal pl-4 space-y-1 text-[11px]">
                <li>
                  Open{" "}
                  <a
                    href="https://console.groq.com/keys"
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline font-medium inline-flex items-center gap-0.5"
                  >
                    console.groq.com/keys <ExternalLink className="h-2.5 w-2.5" />
                  </a>{" "}
                  (Sign in with Google / GitHub).
                </li>
                <li>Click <strong>"Create API Key"</strong> and copy it.</li>
                <li>Paste it below. It's completely free with generous daily rate limits.</li>
              </ol>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium">Groq API Key (starts with gsk_)</Label>
              <Input
                type="password"
                placeholder="gsk_..."
                value={groqKeyInput}
                onChange={(e) => setGroqKeyInput(e.target.value)}
                className="text-xs font-mono"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-2">
            {hasGroqKey ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs text-destructive hover:bg-destructive/10"
                onClick={handleRemoveKey}
              >
                Remove Key
              </Button>
            ) : (
              <div />
            )}
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setGroqKeyOpen(false)} className="text-xs">
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSaveKeyAndRun}
                disabled={!groqKeyInput.trim()}
                className="text-xs bg-purple-600 hover:bg-purple-700 text-white"
              >
                Save & Tailor with AI
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
