import { createFileRoute } from "@tanstack/react-router";
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
import { Sparkles, Copy, Check, Send, Phone, Mail, Trash2, ArrowUpRight, MessageSquareCode } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  useSubmissions, useRequirements, useConsultants,
  useCreateSubmission, useUpdateSubmission, useDeleteSubmission,
} from "@/lib/api";
import { generateAMPitch } from "@/lib/matching";

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
  const { data: submissions = [], isLoading: subsLoading } = useSubmissions();
  const { data: requirements = [], isLoading: reqsLoading } = useRequirements();
  const { data: consultants = [], isLoading: consLoading } = useConsultants();

  const createSubmission = useCreateSubmission();
  const updateSubmission = useUpdateSubmission();
  const deleteSubmission = useDeleteSubmission();

  // Active form state
  const [selectedReqId, setSelectedReqId] = useState<string>(search.reqId ?? "");
  const [selectedConsId, setSelectedConsId] = useState<string>(search.consultantId ?? "");
  const [summary, setSummary] = useState("");
  const [fullEmail, setFullEmail] = useState("");
  const [copied, setCopied] = useState(false);

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

  // Automatically generate pitch when both consultant and req are chosen
  useEffect(() => {
    if (selectedCons && selectedReq) {
      const pitch = generateAMPitch(selectedCons, selectedReq);
      setSummary(pitch.bullets);
      setFullEmail(pitch.fullEmail);
    }
  }, [selectedReqId, selectedConsId]);

  function handleManualGenerate() {
    if (!selectedReq || !selectedCons) {
      toast.error("Please select both a Consultant and a Requirement first");
      return;
    }
    const pitch = generateAMPitch(selectedCons, selectedReq);
    setSummary(pitch.bullets);
    setFullEmail(pitch.fullEmail);
    toast.success("Dynamic AM pitch generated");
  }

  async function handleCopyEmail() {
    if (!fullEmail) {
      handleManualGenerate();
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
      toast.success("Submission successfully created!");
      // Reset after submission
      setSelectedReqId("");
      setSelectedConsId("");
      setSummary("");
      setFullEmail("");
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

  const pending = submissions.filter((s: any) => s.status === "submitted" || s.status === "in_review");
  const history = submissions;

  return (
    <div>
      <PageHeader
        title="Submission Manager"
        subtitle={`${pending.length} pending · ${history.length} total submissions in pipeline`}
      />

      <div className="grid gap-6 p-6 lg:grid-cols-3">
        {/* Left 2 cols: Submissions list */}
        <section className="lg:col-span-2 space-y-6">
          {/* Pending Submissions */}
          <div className="rounded-xl border border-border bg-surface">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h2 className="text-base font-semibold">Active / Pending Submissions</h2>
                <p className="text-xs text-muted-foreground">Submissions awaiting client review or scheduling</p>
              </div>
              <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-accent-foreground">
                {pending.length} Active
              </span>
            </div>

            {subsLoading && <p className="px-5 py-8 text-center text-sm text-muted-foreground">Loading submissions…</p>}

            {!subsLoading && pending.length === 0 && (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                No pending submissions right now. Select a consultant and requirement on the right to submit!
              </p>
            )}

            <ul className="divide-y divide-border">
              {pending.map((s: any) => {
                const r = s.requirement ?? {};
                const c = s.consultant ?? {};
                return (
                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-accent/20">
                    <div className="min-w-[200px] flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">{c.full_name || "Consultant"}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="font-medium text-foreground">{r.title || "Requirement"}</span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {r.client_masked || "Direct Client"} · Submitted on {s.submitted_date}
                        {s.am_feedback && (
                          <span className="ml-2 inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[11px] text-foreground font-medium">
                            Note: {s.am_feedback}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Select value={s.status} onValueChange={(val) => handleStatusChange(s.id, val)}>
                        <SelectTrigger className="h-8 w-36 text-xs capitalize">
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
                        onClick={() => {
                          setFollowUpSub(s);
                          setFeedbackNote(s.am_feedback || "");
                        }}
                      >
                        Follow up
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Submission History Table */}
          <div className="rounded-xl border border-border bg-surface">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-base font-semibold">All Submissions History</h2>
              <p className="text-xs text-muted-foreground">Complete record across all statuses</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Consultant</th>
                    <th className="px-4 py-3 text-left font-medium">Requirement</th>
                    <th className="px-4 py-3 text-left font-medium">Submitted</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((s: any) => {
                    const r = s.requirement ?? {};
                    const c = s.consultant ?? {};
                    return (
                      <tr key={s.id} className="border-t border-border hover:bg-accent/10">
                        <td className="px-4 py-3 font-medium">{c.full_name || "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{r.title || "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground tabular-nums">{s.submitted_date}</td>
                        <td className="px-4 py-3">
                          <Select value={s.status} onValueChange={(val) => handleStatusChange(s.id, val)}>
                            <SelectTrigger className="h-7 w-32 text-[11px] capitalize">
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
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDeleteSub(s.id)}
                            title="Delete submission"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                  {!subsLoading && history.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center text-sm text-muted-foreground">
                        No submissions recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Right col: New Submission & AM Pitch Generator */}
        <aside className="space-y-6">
          <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <Sparkles className="h-4 w-4 text-primary" />
              <h2 className="text-base font-semibold">New Submission & Pitch</h2>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Select an active requirement and a bench consultant to auto-generate a tailored submission pitch.
            </p>

            <div className="mt-4 space-y-3">
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

              <div className="pt-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">Tailored 3-Bullet Summary</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[11px]"
                    onClick={handleManualGenerate}
                    disabled={!selectedReq || !selectedCons}
                  >
                    <Sparkles className="mr-1 h-3 w-3" /> Refresh Pitch
                  </Button>
                </div>
                <Textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  rows={6}
                  placeholder="Select both consultant and requirement to craft pitch…"
                  className="mt-1.5 text-xs leading-relaxed"
                />
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyEmail}
                  disabled={!selectedReq || !selectedCons}
                  className="w-full"
                >
                  {copied ? <Check className="mr-1.5 h-3.5 w-3.5 text-green-500" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
                  {copied ? "Copied Email Pitch!" : "Copy Ready-to-Send Email"}
                </Button>

                <Button
                  size="sm"
                  onClick={handleSubmitNew}
                  disabled={!selectedReq || !selectedCons || createSubmission.isPending}
                  className="w-full"
                >
                  <Send className="mr-1.5 h-3.5 w-3.5" />
                  {createSubmission.isPending ? "Submitting…" : "Record Submission"}
                </Button>
              </div>
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
                <div className="font-semibold text-foreground">Requirement Contact Info:</div>
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
                  const emailBody = `Hi ${followUpSub.requirement?.am_name || "there"},\n\nFollowing up on my submission of ${followUpSub.consultant?.full_name} for the ${followUpSub.requirement?.title} position.\n\nPlease let me know if you need any additional details.\n\nThank you!`;
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
  );
}