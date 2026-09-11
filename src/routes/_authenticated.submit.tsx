import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Sparkles, Copy, Check, Send, Phone, Mail, Trash2, ArrowUpRight, DollarSign,
  TrendingUp, Filter, FileText, UserCheck, CalendarClock, Zap, CheckCircle2,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import {
  useSubmissions, useRequirements, useConsultants,
  useCreateSubmission, useUpdateSubmission, useDeleteSubmission,
} from "@/lib/api";
import { generateAMPitch } from "@/lib/matching";
import { callGroqAIPitch, getStoredGroqKey } from "@/lib/groq-client";

export const Route = createFileRoute("/_authenticated/submit")({
  validateSearch: (search: Record<string, unknown>): { reqId?: string; consultantId?: string } => {
    return {
      reqId: typeof search.reqId === "string" ? search.reqId : undefined,
      consultantId: typeof search.consultantId === "string" ? search.consultantId : undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "Submissions — Jobib" },
      { name: "description", content: "Manage active submissions, track status, and craft dynamic AM pitches." },
    ],
  }),
  component: SubmissionsPage,
});

const STATUS_OPTIONS = [
  { value: "submitted", label: "Submitted", tone: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  { value: "in_review", label: "In Review", tone: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
  { value: "interview_scheduled", label: "Interview Scheduled", tone: "bg-purple-500/10 text-purple-500 border-purple-500/20" },
  { value: "placed", label: "Placed", tone: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
  { value: "rejected", label: "Rejected", tone: "bg-rose-500/10 text-rose-500 border-rose-500/20" },
] as const;

function SubmissionsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { data: submissions = [], isLoading: subsLoading } = useSubmissions();
  const { data: requirements = [], isLoading: reqsLoading } = useRequirements();
  const { data: consultants = [], isLoading: consLoading } = useConsultants();

  const createSubmission = useCreateSubmission();
  const updateSubmission = useUpdateSubmission();
  const deleteSubmission = useDeleteSubmission();

  // Active form state
  const [selectedReqId, setSelectedReqId] = useState<string>(search.reqId ?? "");
  const [selectedConsId, setSelectedConsId] = useState<string>(search.consultantId ?? "");
  const [payRate, setPayRate] = useState<string>("65");
  const [summary, setSummary] = useState("");
  const [fullEmail, setFullEmail] = useState("");
  const [copied, setCopied] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [modelUsed, setModelUsed] = useState<string | null>(null);

  // Filter state
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Follow-up modal state
  const [followUpSub, setFollowUpSub] = useState<any | null>(null);
  const [feedbackNote, setFeedbackNote] = useState("");

  // Sync state if search params change
  useEffect(() => {
    if (search.reqId) setSelectedReqId(search.reqId);
    if (search.consultantId) setSelectedConsId(search.consultantId);
  }, [search.reqId, search.consultantId]);

  const selectedReq = requirements.find((r) => r.id === selectedReqId);
  const selectedCons = consultants.find((c) => c.id === selectedConsId);

  // Rate margin calculation
  const billRate = selectedReq?.rate_max || selectedReq?.rate_min || 0;
  const pay = parseFloat(payRate) || 0;
  const spread = billRate > 0 && pay > 0 ? billRate - pay : 0;
  const marginPct = billRate > 0 && pay > 0 ? Math.round((spread / billRate) * 100) : 0;
  const monthlyGross = spread > 0 ? spread * 160 : 0;

  // Automatically generate baseline NLP pitch when both consultant and req are chosen
  useEffect(() => {
    if (selectedCons && selectedReq) {
      const pitch = generateAMPitch(selectedCons, selectedReq);
      setSummary(pitch.bullets);
      setFullEmail(pitch.fullEmail);
      setModelUsed(null);
    }
  }, [selectedReqId, selectedConsId]);

  function handleFastNlpGenerate() {
    if (!selectedReq || !selectedCons) {
      toast.error("Please select both a Consultant and a Requirement first");
      return;
    }
    const pitch = generateAMPitch(selectedCons, selectedReq);
    setSummary(pitch.bullets);
    setFullEmail(pitch.fullEmail);
    setModelUsed(null);
    toast.success("⚡ Fast NLP pitch refreshed");
  }

  async function handleGroqAiGenerate() {
    if (!selectedReq || !selectedCons) {
      toast.error("Please select both a Consultant and a Requirement first");
      return;
    }
    const key = getStoredGroqKey();
    if (!key) {
      toast.error("Please configure your Groq API key in Resume Tailor or .env first");
      return;
    }
    setIsGeneratingAI(true);
    try {
      const res = await callGroqAIPitch({
        consultant: selectedCons,
        requirement: selectedReq,
        payRate: pay > 0 ? pay : undefined,
        apiKey: key,
      });
      setSummary(res.bullets);
      setFullEmail(res.fullEmail);
      setModelUsed(res.modelUsed);
      toast.success(`✨ Tailored pitch generated via ${res.modelUsed}!`);
    } catch (e: any) {
      toast.error(e.message || "Failed to generate AI pitch. Using Fast NLP fallback.");
      handleFastNlpGenerate();
    } finally {
      setIsGeneratingAI(false);
    }
  }

  async function handleCopyEmail() {
    if (!fullEmail) {
      handleFastNlpGenerate();
      return;
    }
    await navigator.clipboard.writeText(fullEmail);
    setCopied(true);
    toast.success("Full email pitch copied to clipboard!");
    setTimeout(() => setCopied(false), 2500);
  }

  async function handleSubmitNew() {
    if (!selectedReqId || !selectedConsId) {
      toast.error("Please select both a Consultant and a Requirement");
      return;
    }

    try {
      await createSubmission.mutateAsync({
        requirement_id: selectedReqId,
        consultant_id: selectedConsId,
        am_summary: summary,
        status: "submitted",
      });
      toast.success("Submission successfully recorded in pipeline!");
      // Reset pitch form
      setSelectedReqId("");
      setSelectedConsId("");
      setSummary("");
      setFullEmail("");
      setModelUsed(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to record submission");
    }
  }

  async function handleStatusChange(id: string, newStatus: any) {
    try {
      await updateSubmission.mutateAsync({
        id,
        patch: { status: newStatus },
      });
      toast.success(`Status updated to ${newStatus.replace("_", " ")}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update status");
    }
  }

  async function handleSaveFeedback() {
    if (!followUpSub) return;
    try {
      await updateSubmission.mutateAsync({
        id: followUpSub.id,
        patch: { am_feedback: feedbackNote },
      });
      toast.success("AM feedback note saved");
      setFollowUpSub(null);
      setFeedbackNote("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save feedback");
    }
  }

  async function handleDeleteSub(id: string) {
    try {
      await deleteSubmission.mutateAsync(id);
      toast.success("Submission deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    }
  }

  // Filtered submissions
  const filteredSubmissions = useMemo(() => {
    if (statusFilter === "all") return submissions;
    return submissions.filter((s: any) => s.status === statusFilter);
  }, [submissions, statusFilter]);

  // Counts for pipeline summary
  const counts = useMemo(() => {
    return {
      total: submissions.length,
      submitted: submissions.filter((s: any) => s.status === "submitted").length,
      in_review: submissions.filter((s: any) => s.status === "in_review").length,
      interview_scheduled: submissions.filter((s: any) => s.status === "interview_scheduled").length,
      placed: submissions.filter((s: any) => s.status === "placed").length,
      rejected: submissions.filter((s: any) => s.status === "rejected").length,
    };
  }, [submissions]);

  return (
    <div>
      <PageHeader
        title="Submission Pipeline & AM Pitch"
        subtitle={`${counts.submitted + counts.in_review} active review · ${counts.interview_scheduled} interview stage · ${counts.placed} placed`}
      />

      <div className="space-y-6 p-6">
        {/* Pipeline KPI Cards */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Pipeline</span>
              <span className="rounded-lg bg-blue-500/10 p-2 text-blue-500"><Send className="h-4 w-4" /></span>
            </div>
            <div className="mt-2 text-2xl font-bold">{counts.total}</div>
            <div className="mt-1 text-xs text-muted-foreground">{counts.submitted} newly submitted</div>
          </div>

          <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">In Client Review</span>
              <span className="rounded-lg bg-amber-500/10 p-2 text-amber-500"><UserCheck className="h-4 w-4" /></span>
            </div>
            <div className="mt-2 text-2xl font-bold">{counts.in_review}</div>
            <div className="mt-1 text-xs text-muted-foreground">Awaiting client AM feedback</div>
          </div>

          <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Interviews Scheduled</span>
              <span className="rounded-lg bg-purple-500/10 p-2 text-purple-500"><CalendarClock className="h-4 w-4" /></span>
            </div>
            <div className="mt-2 text-2xl font-bold">{counts.interview_scheduled}</div>
            <div className="mt-1 text-xs text-muted-foreground">Ready for final round</div>
          </div>

          <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Placed Consultants</span>
              <span className="rounded-lg bg-emerald-500/10 p-2 text-emerald-500"><CheckCircle2 className="h-4 w-4" /></span>
            </div>
            <div className="mt-2 text-2xl font-bold text-emerald-600">{counts.placed}</div>
            <div className="mt-1 text-xs text-muted-foreground">Gross revenue active</div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left 2 cols: Submissions list with Status Filter Tabs */}
          <section className="lg:col-span-2 space-y-6">
            <div className="rounded-xl border border-border bg-surface">
              {/* Filter Tabs Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold">Filter Pipeline</span>
                </div>

                <div className="flex flex-wrap gap-1.5 text-xs">
                  <button
                    onClick={() => setStatusFilter("all")}
                    className={`rounded-lg px-2.5 py-1 font-medium transition-colors ${
                      statusFilter === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    All ({counts.total})
                  </button>
                  <button
                    onClick={() => setStatusFilter("submitted")}
                    className={`rounded-lg px-2.5 py-1 font-medium transition-colors ${
                      statusFilter === "submitted" ? "bg-blue-600 text-white" : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Submitted ({counts.submitted})
                  </button>
                  <button
                    onClick={() => setStatusFilter("in_review")}
                    className={`rounded-lg px-2.5 py-1 font-medium transition-colors ${
                      statusFilter === "in_review" ? "bg-amber-600 text-white" : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    In Review ({counts.in_review})
                  </button>
                  <button
                    onClick={() => setStatusFilter("interview_scheduled")}
                    className={`rounded-lg px-2.5 py-1 font-medium transition-colors ${
                      statusFilter === "interview_scheduled" ? "bg-purple-600 text-white" : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Interviews ({counts.interview_scheduled})
                  </button>
                  <button
                    onClick={() => setStatusFilter("placed")}
                    className={`rounded-lg px-2.5 py-1 font-medium transition-colors ${
                      statusFilter === "placed" ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Placed ({counts.placed})
                  </button>
                  <button
                    onClick={() => setStatusFilter("rejected")}
                    className={`rounded-lg px-2.5 py-1 font-medium transition-colors ${
                      statusFilter === "rejected" ? "bg-rose-600 text-white" : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Rejected ({counts.rejected})
                  </button>
                </div>
              </div>

              {subsLoading && <p className="px-5 py-8 text-center text-sm text-muted-foreground">Loading submissions…</p>}

              {!subsLoading && filteredSubmissions.length === 0 && (
                <div className="px-5 py-12 text-center text-sm text-muted-foreground">
                  <p>No submissions found in this status view.</p>
                  <p className="mt-1 text-xs text-muted-foreground/80">Select a consultant and requirement on the right to submit!</p>
                </div>
              )}

              <ul className="divide-y divide-border">
                {filteredSubmissions.map((s: any) => {
                  const r = s.requirement ?? {};
                  const c = s.consultant ?? {};
                  const statusObj = STATUS_OPTIONS.find((opt) => opt.value === s.status) || STATUS_OPTIONS[0];

                  return (
                    <li key={s.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-accent/15">
                      <div className="min-w-[200px] flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground text-sm">{c.full_name || "Consultant"}</span>
                          <span className="text-muted-foreground">→</span>
                          <span className="font-medium text-foreground text-sm">{r.title || "Requirement"}</span>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground flex flex-wrap items-center gap-2">
                          <span>{r.client_masked || r.vendor_name || "Direct Client"}</span>
                          <span>·</span>
                          <span>${r.rate_max || 85}/hr</span>
                          <span>·</span>
                          <span>Submitted: {s.submitted_date}</span>
                          {s.am_feedback && (
                            <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-foreground font-medium">
                              Note: {s.am_feedback}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Select value={s.status} onValueChange={(val) => handleStatusChange(s.id, val)}>
                          <SelectTrigger className={`h-8 w-36 text-xs capitalize ${statusObj.tone}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                          onClick={() => {
                            setFollowUpSub(s);
                            setFeedbackNote(s.am_feedback || "");
                          }}
                        >
                          Follow up
                        </Button>

                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteSub(s.id)}
                          title="Delete submission"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>

          {/* Right col: New Submission & AM Pitch Generator */}
          <aside className="space-y-6">
            <div className="rounded-xl border border-border bg-surface p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <h2 className="text-base font-semibold">New Submission Pitch</h2>
                </div>
                {modelUsed && (
                  <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                    {modelUsed.replace("meta-llama/", "").replace("openai/", "")}
                  </span>
                )}
              </div>

              {/* Consultant Selection */}
              <div>
                <Label className="text-xs font-medium">Select Consultant</Label>
                <Select value={selectedConsId} onValueChange={setSelectedConsId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Choose consultant…" />
                  </SelectTrigger>
                  <SelectContent>
                    {consultants.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.full_name} ({c.years_experience}y · {c.bench_status})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Requirement Selection */}
              <div>
                <Label className="text-xs font-medium">Select Requirement</Label>
                <Select value={selectedReqId} onValueChange={setSelectedReqId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Choose requirement…" />
                  </SelectTrigger>
                  <SelectContent>
                    {requirements.map((r: any) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.title} — {r.client_masked || r.vendor_name || "Direct"} (${r.rate_max || 85}/hr)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Gross Margin Calculator */}
              {selectedReq && (
                <div className="rounded-lg border border-border bg-muted/20 p-3 text-xs space-y-2">
                  <div className="flex items-center justify-between font-semibold text-foreground">
                    <span className="flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5 text-emerald-500" /> Margin Calculator</span>
                    <span className="text-[11px] text-muted-foreground font-mono">160 hrs/mo</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-muted-foreground">Client Bill Rate</span>
                      <div className="font-semibold text-foreground">${billRate || 85}/hr</div>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground">Target Pay Rate</span>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-xs text-muted-foreground">$</span>
                        <Input
                          type="number"
                          value={payRate}
                          onChange={(e) => setPayRate(e.target.value)}
                          className="h-6 w-16 text-xs px-1.5"
                          placeholder="65"
                        />
                        <span className="text-[10px] text-muted-foreground">/hr</span>
                      </div>
                    </div>
                  </div>
                  {spread > 0 && (
                    <div className="rounded border border-emerald-500/20 bg-emerald-500/10 p-2 text-emerald-600 font-medium flex items-center justify-between text-[11px]">
                      <span>Gross Spread: <strong>+${spread.toFixed(2)}/hr</strong> ({marginPct}%)</span>
                      <span><strong>+${monthlyGross.toLocaleString()}/mo</strong></span>
                    </div>
                  )}
                </div>
              )}

              {/* Quick Resume Tailor Shortcut */}
              {selectedReqId && selectedConsId && (
                <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 p-2.5 text-xs">
                  <div className="flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 text-primary" />
                    <span className="text-muted-foreground">Need tailored resume?</span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-[11px] text-primary hover:text-primary font-medium"
                    onClick={() => {
                      navigate({
                        to: "/resume-tailor",
                        search: { reqId: selectedReqId, consultantId: selectedConsId },
                      });
                    }}
                  >
                    Tailor Resume <ArrowUpRight className="ml-1 h-3 w-3" />
                  </Button>
                </div>
              )}

              {/* Tailored Bullets Pitch Area */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label className="text-xs font-medium">AM Pitch Summary</Label>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[10px]"
                      onClick={handleFastNlpGenerate}
                      disabled={!selectedReq || !selectedCons || isGeneratingAI}
                      title="Generate instant offline template pitch"
                    >
                      <Zap className="mr-1 h-3 w-3 text-amber-500" /> Fast NLP
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 px-2 text-[10px] border-primary/30 text-primary hover:bg-primary/10"
                      onClick={handleGroqAiGenerate}
                      disabled={!selectedReq || !selectedCons || isGeneratingAI}
                      title="Generate deep AI pitch with Groq"
                    >
                      <Sparkles className="mr-1 h-3 w-3" /> {isGeneratingAI ? "Generating…" : "Groq AI Pitch"}
                    </Button>
                  </div>
                </div>
                <Textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  rows={6}
                  placeholder="Select both consultant and requirement to craft pitch…"
                  className="text-xs leading-relaxed"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyEmail}
                  disabled={!selectedReq || !selectedCons}
                  className="w-full"
                >
                  {copied ? <Check className="mr-1.5 h-3.5 w-3.5 text-green-500" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
                  {copied ? "Copied Email Pitch!" : "Copy Full Ready-to-Send Email"}
                </Button>

                <Button
                  size="sm"
                  onClick={handleSubmitNew}
                  disabled={!selectedReq || !selectedCons || createSubmission.isPending}
                  className="w-full"
                >
                  <Send className="mr-1.5 h-3.5 w-3.5" />
                  {createSubmission.isPending ? "Recording…" : "Record Submission to Pipeline"}
                </Button>
              </div>
            </div>
          </aside>
        </div>

        {/* Follow-up / AM Feedback Dialog */}
        {followUpSub && (
          <Dialog open={Boolean(followUpSub)} onOpenChange={(open) => !open && setFollowUpSub(null)}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Submission Follow-Up</DialogTitle>
                <DialogDescription>
                  Follow up with Account Manager regarding {followUpSub.consultant?.full_name} for {followUpSub.requirement?.title}.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs space-y-1.5">
                  <div className="font-semibold text-foreground">Account Manager Contact:</div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-3.5 w-3.5" />
                    <span>{followUpSub.requirement?.am_email || "AM Email not listed"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" />
                    <span>{followUpSub.requirement?.am_phone || "AM Phone not listed"}</span>
                  </div>
                  <div className="text-muted-foreground">
                    AM Name: <span className="text-foreground">{followUpSub.requirement?.am_name || "Account Manager"}</span>
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Log Feedback / Internal Notes</Label>
                  <Textarea
                    value={feedbackNote}
                    onChange={(e) => setFeedbackNote(e.target.value)}
                    rows={3}
                    placeholder="e.g. AM acknowledged, client interview scheduled for Thursday 2 PM..."
                    className="mt-1 text-xs"
                  />
                </div>
              </div>

              <DialogFooter className="flex sm:justify-between gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const emailSubject = `Follow-up: ${followUpSub.consultant?.full_name} for ${followUpSub.requirement?.title}`;
                    const emailBody = `Hi ${followUpSub.requirement?.am_name || "there"},\n\nFollowing up on my submission of ${followUpSub.consultant?.full_name} for the ${followUpSub.requirement?.title} position.\n\nPlease let me know if you need any additional details or candidate interview slots.\n\nThank you!`;
                    navigator.clipboard.writeText(`Subject: ${emailSubject}\n\n${emailBody}`);
                    toast.success("Follow-up email copied to clipboard!");
                  }}
                >
                  <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy Follow-Up Email
                </Button>
                <Button size="sm" onClick={handleSaveFeedback} disabled={updateSubmission.isPending}>
                  Save Notes
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}