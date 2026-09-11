import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertTriangle, Sparkles, CheckCircle2, Loader2, Copy, Check, Printer, FileText, Send, ArrowUpRight,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useConsultants, useRequirements, useAnalyzeJD, type JDAnalysisResult } from "@/lib/api";
import { analyzeJDLocally, buildTailoredResumeDocument } from "@/lib/resume-engine";
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
  const analyze = useAnalyzeJD();

  const [jd, setJd] = useState("");
  const [selectedReqId, setSelectedReqId] = useState<string>(search.reqId ?? "");
  const [consultantId, setConsultantId] = useState<string>(search.consultantId ?? "none");
  const [result, setResult] = useState<JDAnalysisResult | null>(null);
  const [activeTab, setActiveTab] = useState("analysis");
  const [copiedResume, setCopiedResume] = useState(false);
  const [copiedBullets, setCopiedBullets] = useState(false);

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

  async function runAnalysis() {
    if (!jd.trim()) {
      toast.error("Please paste or load a Job Description first");
      return;
    }

    try {
      // Try edge function (Groq) first
      const data = await analyze.mutateAsync({
        jd_text: jd,
        consultant: selectedConsultant
          ? {
              full_name: selectedConsultant.full_name,
              tech_stack: selectedConsultant.tech_stack ?? [],
              years_experience: selectedConsultant.years_experience,
              last_project_title: selectedConsultant.last_project_title,
              last_client_type: selectedConsultant.last_client_type,
              last_project_duration: selectedConsultant.last_project_duration,
            }
          : undefined,
      });
      setResult(data);
      toast.success("AI analysis completed successfully!");
    } catch {
      // Seamless intelligent local fallback
      const localResult = analyzeJDLocally(jd, selectedConsultant);
      setResult(localResult);
      toast.success("Analyzed and tailored using built-in NLP engine!");
    }
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

  function handlePrintResume() {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Tailored Resume - ${selectedConsultant?.full_name || "Candidate"}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.5; color: #111; padding: 40px; max-width: 800px; margin: 0 auto; }
            h1 { font-size: 24px; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
            .header-info { font-size: 13px; color: #444; margin-bottom: 20px; border-bottom: 2px solid #111; padding-bottom: 12px; }
            h2 { font-size: 14px; text-transform: uppercase; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-top: 24px; margin-bottom: 8px; letter-spacing: 0.5px; }
            p { font-size: 13px; margin: 8px 0; }
            ul { margin: 8px 0 16px 20px; padding: 0; }
            li { font-size: 13px; margin-bottom: 6px; }
            .meta { font-weight: bold; font-size: 13px; }
          </style>
        </head>
        <body>
          <pre style="font-family: inherit; white-space: pre-wrap; word-wrap: break-word;">${fullResumeText}</pre>
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

            <Button
              className="w-full"
              onClick={runAnalysis}
              disabled={!jd.trim() || analyze.isPending}
            >
              {analyze.isPending ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Analyzing…
                </>
              ) : (
                <>
                  <Sparkles className="mr-1.5 h-4 w-4" /> Analyze & Tailor Resume
                </>
              )}
            </Button>
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
                <TabsTrigger value="resume" className="text-xs" disabled={!selectedConsultant || !result}>
                  Full Resume Preview
                </TabsTrigger>
              </TabsList>

              {result && selectedConsultant && activeTab === "resume" && (
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handlePrintResume} className="h-7 text-xs">
                    <Printer className="mr-1.5 h-3.5 w-3.5" /> Print / PDF
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleCopyResume} className="h-7 text-xs">
                    {copiedResume ? <Check className="mr-1.5 h-3.5 w-3.5 text-green-500" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
                    {copiedResume ? "Copied!" : "Copy Text"}
                  </Button>
                </div>
              )}
            </div>

            {/* Tab 1: Skills & Bullets */}
            <TabsContent value="analysis" className="space-y-4 mt-0">
              {/* JD Analysis Card */}
              <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-foreground">JD Intelligence & Extracted Skills</h2>
                {!result ? (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Paste a JD on the left and click <strong>Analyze & Tailor</strong> to extract required skills, domain, and pain points.
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
              <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
                <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
                  <div>
                    <h2 className="text-base font-bold text-foreground">
                      {selectedConsultant?.full_name} — Tailored Resume
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Target Role: {requirements.find((r) => r.id === selectedReqId)?.title || "Senior Software Consultant"}
                    </p>
                  </div>
                  {selectedReqId && selectedReqId !== "manual" && (
                    <Button
                      size="sm"
                      onClick={() =>
                        navigate({
                          to: "/submit",
                          search: { reqId: selectedReqId, consultantId: selectedConsultant?.id },
                        })
                      }
                    >
                      <Send className="mr-1.5 h-3.5 w-3.5" /> Submit to Pipeline
                    </Button>
                  )}
                </div>

                <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed rounded-lg border border-border bg-muted/40 p-4 text-foreground overflow-x-auto">
                  {fullResumeText}
                </pre>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
