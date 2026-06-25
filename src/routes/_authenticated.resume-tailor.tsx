import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Sparkles, CheckCircle2, Loader2 } from "lucide-react";
import { useState } from "react";
import { useConsultants, useAnalyzeJD, type JDAnalysisResult } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/resume-tailor")({
  head: () => ({
    meta: [
      { title: "Resume Tailor — Jobib" },
      { name: "description", content: "AI-tailored resume bullets matched to each requirement." },
    ],
  }),
  component: ResumeTailorPage,
});

function ResumeTailorPage() {
  const [jd, setJd] = useState("");
  const [consultantId, setConsultantId] = useState<string>("none");
  const [result, setResult] = useState<JDAnalysisResult | null>(null);
  const { data: consultants = [] } = useConsultants();
  const analyze = useAnalyzeJD();

  async function runAnalysis() {
    const consultant = consultants.find((c: any) => c.id === consultantId);
    try {
      const data = await analyze.mutateAsync({
        jd_text: jd,
        consultant: consultant
          ? {
              full_name: consultant.full_name,
              tech_stack: consultant.tech_stack ?? [],
              years_experience: consultant.years_experience,
              last_project_title: consultant.last_project_title,
              last_client_type: consultant.last_client_type,
              last_project_duration: consultant.last_project_duration,
            }
          : undefined,
      });
      setResult(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Analysis failed — check Groq API key is set in Supabase secrets");
    }
  }

  return (
    <div>
      <PageHeader title="AI Resume Tailor" subtitle="Paste the JD, get tailored bullets and a ghost-job verdict." />
      <div className="grid gap-6 p-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-5">
          <h2 className="text-sm font-semibold">Job description</h2>
          <Textarea value={jd} onChange={(e) => setJd(e.target.value)} rows={12} placeholder="Paste the JD here…" className="mt-3" />

          <div className="mt-3">
            <label className="text-xs font-medium text-muted-foreground">Consultant to tailor for (optional)</label>
            <Select value={consultantId} onValueChange={setConsultantId}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="No consultant selected" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Skills/domain analysis only</SelectItem>
                {consultants.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.full_name} — {(c.tech_stack ?? []).slice(0, 2).join(", ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button className="mt-3 w-full" onClick={runAnalysis} disabled={!jd.trim() || analyze.isPending}>
            {analyze.isPending ? (
              <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Analyzing…</>
            ) : (
              <><Sparkles className="mr-1.5 h-4 w-4" />Analyze & tailor</>
            )}
          </Button>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-surface p-5">
            <h2 className="text-sm font-semibold">JD analysis</h2>
            {!result ? (
              <p className="mt-3 text-sm text-muted-foreground">Run an analysis to see required skills, domain, and pain points.</p>
            ) : (
              <div className="mt-3 space-y-3 text-sm">
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Must-have skills</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {result.must_have_skills.map((s) => (
                      <span key={s} className="rounded bg-primary/15 px-1.5 py-0.5 text-[11px] font-medium text-primary">{s}</span>
                    ))}
                  </div>
                </div>
                {result.nice_to_have_skills.length > 0 && (
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Nice-to-have</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {result.nice_to_have_skills.map((s) => (
                        <span key={s} className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex gap-4 text-xs">
                  <div><span className="text-muted-foreground">Domain: </span><span className="font-medium">{result.domain}</span></div>
                  <div><span className="text-muted-foreground">Seniority: </span><span className="font-medium">{result.seniority}</span></div>
                </div>
                {result.pain_points.length > 0 && (
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Client pain points</div>
                    <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
                      {result.pain_points.map((p) => <li key={p}>{p}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-surface p-5">
            <h2 className="text-sm font-semibold">Tailored bullets (before → after)</h2>
            {!result ? (
              <p className="mt-3 text-sm text-muted-foreground">Select a consultant and run analysis to see suggestions.</p>
            ) : result.tailored_bullets.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No consultant selected — pick one above to generate tailored bullets.</p>
            ) : (
              <div className="mt-3 space-y-3 text-sm">
                {result.tailored_bullets.map((b, i) => (
                  <div key={i} className="grid gap-2 sm:grid-cols-2">
                    <div className="rounded border border-border bg-muted/40 p-2 text-xs text-muted-foreground line-through">{b.original}</div>
                    <div className="rounded border border-primary/30 bg-primary/5 p-2 text-xs">
                      <CheckCircle2 className="mr-1 inline h-3 w-3 text-primary" />{b.tailored}
                    </div>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    navigator.clipboard.writeText(result.tailored_bullets.map((b) => `• ${b.tailored}`).join("\n"));
                    toast.success("Tailored bullets copied");
                  }}
                >
                  Copy all
                </Button>
              </div>
            )}
          </div>

          <div className={`rounded-xl border p-5 ${result?.ghost_job.is_ghost ? "border-score-low/30 bg-score-low/5" : "border-score-mid/30 bg-score-mid/5"}`}>
            <div className={`flex items-center gap-2 ${result?.ghost_job.is_ghost ? "text-score-low" : "text-score-mid"}`}>
              <AlertTriangle className="h-4 w-4" />
              <h2 className="text-sm font-semibold">Ghost job verdict</h2>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {!result
                ? "Run analysis to evaluate."
                : result.ghost_job.is_ghost
                  ? `Likely ghost job (${result.ghost_job.confidence}% confidence). ${result.ghost_job.reasons.join(" · ")}`
                  : `Likely genuine (${result.ghost_job.confidence}% confidence). ${result.ghost_job.reasons.join(" · ") || "No red flags detected."}`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
