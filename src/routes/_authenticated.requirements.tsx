import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { OriginIcon, ScoreBadge, SourceBadge, StatusPill, SyncStatusBadge } from "@/components/req-badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useRequirements, useCreateRequirement, useUpdateRequirement, useMarketRates, useConsultants, useScrapeVendorPortals } from "@/lib/api";
import { scoreRequirement, checkGhostJob } from "@/lib/scoring";
import { matchRequirementToConsultants } from "@/lib/matching";
import { toast } from "sonner";
import { AlertTriangle, Plus, Search, Edit3, ArrowUpRight, FileText, Send, Users, Sparkles, Globe, Loader2, RefreshCw } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { VendorPortalScraperModal } from "@/components/vendor-portal-scraper-modal";

export const Route = createFileRoute("/_authenticated/requirements")({
  head: () => ({
    meta: [
      { title: "Requirements Pipeline — Jobib" },
      { name: "description", content: "Filter, score, and act on every requirement in your pipeline." },
    ],
  }),
  component: RequirementsPage,
});

function RequirementsPage() {
  const [query, setQuery] = useState("");
  const [origin, setOrigin] = useState<string>("all");
  const [scoreBand, setScoreBand] = useState<string>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [scraperOpen, setScraperOpen] = useState(false);
  const { data: seed = [], isLoading } = useRequirements();

  // Continuous Auto-Analysis & Auto-Sync State
  const [autoScrapeEnabled, setAutoScrapeEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const val = localStorage.getItem("jobib_auto_scrape_enabled");
    return val === null ? true : val === "true";
  });
  const [autoIntervalMins, setAutoIntervalMins] = useState<number>(() => {
    if (typeof window === "undefined") return 15;
    return Number(localStorage.getItem("jobib_auto_scrape_interval")) || 15;
  });
  const [lastAutoRun, setLastAutoRun] = useState<string | null>(null);
  const [isAutoRunning, setIsAutoRunning] = useState(false);

  const scrapePortalsMutation = useScrapeVendorPortals();

  // Background Auto-Scraper & Google Sheets Sync Interval
  useEffect(() => {
    if (!autoScrapeEnabled) return;

    const runAutoCycle = async () => {
      try {
        setIsAutoRunning(true);
        const res = await scrapePortalsMutation.mutateAsync({ count: 5 });
        setLastAutoRun(new Date().toLocaleTimeString());
        toast.info(
          `⚡ Auto-Analysis: Scanned vendor portals & synced ${res.added} new jobs to pipeline and Google Sheet.`,
          { duration: 4000 }
        );
      } catch (e) {
        // silent background
      } finally {
        setIsAutoRunning(false);
      }
    };

    const intervalMs = autoIntervalMins * 60 * 1000;
    const timer = setInterval(runAutoCycle, intervalMs);

    return () => clearInterval(timer);
  }, [autoScrapeEnabled, autoIntervalMins]);

  const filtered = useMemo(() => {
    return seed.filter((r) => {
      if (
        query &&
        !`${r.title} ${r.tech_stack?.join(" ")} ${r.location_city} ${r.vendor_name || ""}`
          .toLowerCase()
          .includes(query.toLowerCase())
      )
        return false;
      if (origin !== "all" && r.origin_channel !== origin) return false;
      if (scoreBand === "high" && r.req_score <= 70) return false;
      if (scoreBand === "mid" && (r.req_score < 50 || r.req_score > 70)) return false;
      if (scoreBand === "low" && r.req_score >= 50) return false;
      return true;
    });
  }, [query, origin, scoreBand, seed]);

  const open = seed.find((r) => r.id === openId) ?? null;

  return (
    <div>
      <PageHeader
        title="Requirements Pipeline"
        subtitle={`${filtered.length} of ${seed.length} requirements`}
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => setScraperOpen(true)}
              className="gap-1.5 font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
            >
              <Sparkles className="h-4 w-4 text-amber-300" />
              Scrape Vendor Portals
            </Button>
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="mr-1.5 h-4 w-4" /> Add requirement
                </Button>
              </DialogTrigger>
              <AddRequirementModal onDone={() => setAddOpen(false)} />
            </Dialog>
          </div>
        }
      />
      <div className="space-y-4 p-6">
        {/* Continuous Portal Analysis & Auto-Sync Banner */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5 text-xs">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              {autoScrapeEnabled && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              )}
              <span
                className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                  autoScrapeEnabled ? "bg-emerald-500" : "bg-muted-foreground"
                }`}
              />
            </span>
            <div>
              <span className="font-semibold text-foreground">
                {autoScrapeEnabled ? "Continuous Portal Analysis & Live Sync: Active" : "Continuous Portal Analysis: Paused"}
              </span>
              <span className="text-muted-foreground ml-2">
                Analyzing 802 vendor portals every {autoIntervalMins}m & auto-syncing to Google Sheet.
                {lastAutoRun && ` (Last run: ${lastAutoRun})`}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Select
              value={String(autoIntervalMins)}
              onValueChange={(v) => {
                const num = Number(v);
                setAutoIntervalMins(num);
                localStorage.setItem("jobib_auto_scrape_interval", String(num));
              }}
            >
              <SelectTrigger className="h-7 text-[11px] w-28 bg-surface">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">Every 5 mins</SelectItem>
                <SelectItem value="15">Every 15 mins</SelectItem>
                <SelectItem value="30">Every 30 mins</SelectItem>
                <SelectItem value="60">Every 1 hour</SelectItem>
              </SelectContent>
            </Select>

            <Button
              size="sm"
              variant="outline"
              disabled={isAutoRunning}
              className="h-7 text-[11px] px-2.5"
              onClick={async () => {
                try {
                  setIsAutoRunning(true);
                  const res = await scrapePortalsMutation.mutateAsync({ count: 5 });
                  setLastAutoRun(new Date().toLocaleTimeString());
                  toast.success(`Scanned portals & auto-synced ${res.added} new jobs!`);
                } catch (e: any) {
                  toast.error(e?.message || "Scan failed");
                } finally {
                  setIsAutoRunning(false);
                }
              }}
            >
              {isAutoRunning ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
              Scan Now
            </Button>

            <Button
              size="sm"
              variant={autoScrapeEnabled ? "ghost" : "default"}
              className="h-7 text-[11px] px-2.5"
              onClick={() => {
                const next = !autoScrapeEnabled;
                setAutoScrapeEnabled(next);
                localStorage.setItem("jobib_auto_scrape_enabled", String(next));
                toast.info(next ? "Continuous auto-analysis resumed" : "Continuous auto-analysis paused");
              }}
            >
              {autoScrapeEnabled ? "Pause" : "Resume"}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface p-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title, stack, client, city…"
              className="pl-9"
            />
          </div>
          <Select value={origin} onValueChange={setOrigin}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Origin" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All origins</SelectItem>
              <SelectItem value="dice">Dice</SelectItem>
              <SelectItem value="gmail">Gmail</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="sheets">Sheets</SelectItem>
            </SelectContent>
          </Select>
          <Select value={scoreBand} onValueChange={setScoreBand}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Score" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All scores</SelectItem>
              <SelectItem value="high">High (&gt;70)</SelectItem>
              <SelectItem value="mid">Mid (50–70)</SelectItem>
              <SelectItem value="low">Low (&lt;50)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Requirement</th>
                  <th className="px-4 py-3 text-left font-medium">Tech Stack</th>
                  <th className="px-4 py-3 text-left font-medium">Location</th>
                  <th className="px-4 py-3 text-left font-medium">Rate</th>
                  <th className="px-4 py-3 text-left font-medium">Source</th>
                  <th className="px-4 py-3 text-left font-medium">Origin</th>
                  <th className="px-4 py-3 text-left font-medium">Posted</th>
                  <th className="px-4 py-3 text-left font-medium">Score</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Sync</th>
                  <th className="px-4 py-3 text-right" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-t border-border transition-colors hover:bg-accent/40">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{r.title}</div>
                      <div className="text-xs text-muted-foreground">{r.client_masked || r.vendor_name || "Direct"}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(r.tech_stack ?? []).slice(0, 3).map((t: string) => (
                          <span
                            key={t}
                            className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {[r.location_city, r.location_state].filter(Boolean).join(", ") || "Remote/Unspecified"}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {r.rate_max ? `$${r.rate_min ? `${r.rate_min}–$` : ""}${r.rate_max}/hr` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <SourceBadge source={r.source_type} />
                    </td>
                    <td className="px-4 py-3">
                      <OriginIcon channel={r.origin_channel} withLabel />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground tabular-nums">{r.posted_date || "—"}</td>
                    <td className="px-4 py-3">
                      <ScoreBadge score={r.req_score} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={r.status} />
                    </td>
                    <td className="px-4 py-3">
                      <SyncStatusBadge status={r.sheet_sync_status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="ghost" onClick={() => setOpenId(r.id)}>
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-4 py-16 text-center">
                      {isLoading ? (
                        <div className="flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                          <span>Loading requirements pipeline...</span>
                        </div>
                      ) : seed.length === 0 ? (
                        <div className="max-w-md mx-auto space-y-4">
                          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary border border-primary/20">
                            <Globe className="h-7 w-7 animate-pulse" />
                          </div>
                          <div>
                            <h3 className="text-base font-bold text-foreground">No Requirements in Pipeline Yet</h3>
                            <p className="text-xs text-muted-foreground mt-1">
                              Scrape live C2C & W2 requirements directly from 1,000+ US IT staffing portals (Apex Systems, Aerotek, Beacon Hill, Collabera, Bullhorn ATS, JobDiva) or add one manually.
                            </p>
                          </div>
                          <div className="flex items-center justify-center gap-3 pt-2">
                            <Button
                              size="sm"
                              onClick={() => setScraperOpen(true)}
                              className="gap-1.5 font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
                            >
                              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                              Scrape Vendor Portals
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
                              <Plus className="mr-1.5 h-3.5 w-3.5" />
                              Add Manually
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">
                          No requirements match your search filters.
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Sheet open={!!open} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {open && <ReqDetail r={open} onClose={() => setOpenId(null)} />}
        </SheetContent>
      </Sheet>

      <VendorPortalScraperModal open={scraperOpen} onOpenChange={setScraperOpen} />
    </div>
  );
}

function ReqDetail({ r, onClose }: { r: any; onClose: () => void }) {
  const navigate = useNavigate();
  const { data: marketRates = [] } = useMarketRates();
  const { data: consultants = [] } = useConsultants();
  const [editOpen, setEditOpen] = useState(false);

  const { criteria, total } = scoreRequirement(
    {
      source_type: r.source_type,
      rate_max: r.rate_max,
      jd_text: r.jd_text,
      am_name: r.am_name,
      am_phone: r.am_phone,
      posted_date: r.posted_date,
      tech_stack: r.tech_stack,
    },
    marketRates,
  );

  const ghost = checkGhostJob({
    source_type: r.source_type,
    rate_max: r.rate_max,
    jd_text: r.jd_text,
    am_name: r.am_name,
    am_phone: r.am_phone,
    posted_date: r.posted_date,
  });

  const candidateMatches = useMemo(
    () => matchRequirementToConsultants(r, consultants).slice(0, 3),
    [r, consultants],
  );

  return (
    <div className="space-y-5">
      <SheetHeader className="space-y-1">
        <div className="flex items-center justify-between">
          <SheetTitle className="text-lg font-bold">{r.title}</SheetTitle>
          <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
            <Edit3 className="mr-1.5 h-3.5 w-3.5" /> Edit
          </Button>
        </div>
      </SheetHeader>

      <div className="text-xs text-muted-foreground space-y-1 border-b border-border pb-3">
        <div>
          Client / Vendor: <strong className="text-foreground">{r.client_masked || r.vendor_name || "Direct Client"}</strong>
        </div>
        <div>
          Location: <strong className="text-foreground">{[r.location_city, r.location_state].filter(Boolean).join(", ") || "Remote/Unspecified"}</strong>
        </div>
        <div>
          Budget Rate: <strong className="text-foreground">{r.rate_max ? `$${r.rate_min ? `${r.rate_min}–$` : ""}${r.rate_max}/hr` : "Open"}</strong>
        </div>
        <div>
          Current Pipeline Status: <span className="capitalize font-semibold text-foreground">{r.status}</span>
        </div>
      </div>

      {/* Top Matching Bench Candidates */}
      {consultants.length > 0 && (
        <div className="rounded-lg border border-border p-4 bg-muted/20 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-primary" /> Top Bench Matches
            </h3>
            <span className="text-[11px] text-muted-foreground font-mono">
              {candidateMatches.length} candidates evaluated
            </span>
          </div>

          <div className="space-y-2">
            {candidateMatches.map((m) => (
              <div
                key={m.consultant.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface p-2.5 text-xs transition-colors hover:border-primary/40"
              >
                <div>
                  <div className="font-semibold text-foreground flex items-center gap-2">
                    <span>{m.consultant.full_name}</span>
                    <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 border border-emerald-500/20">
                      {m.matchPercentage}% match
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {m.consultant.years_experience}y exp · {m.matchedSkills.slice(0, 3).join(", ") || "Stack overlap"}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-[10px]"
                    onClick={() => {
                      onClose();
                      navigate({
                        to: "/resume-tailor",
                        search: { reqId: r.id, consultantId: m.consultant.id },
                      });
                    }}
                    title="Tailor resume for this match"
                  >
                    <FileText className="mr-1 h-3 w-3" /> Tailor
                  </Button>
                  <Button
                    size="sm"
                    className="h-6 px-2 text-[10px]"
                    onClick={() => {
                      onClose();
                      navigate({
                        to: "/submit",
                        search: { reqId: r.id, consultantId: m.consultant.id },
                      });
                    }}
                    title="Submit this consultant"
                  >
                    <Send className="mr-1 h-3 w-3" /> Submit
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Req-Score Breakdown</h3>
          <ScoreBadge score={total} />
        </div>
        <table className="mt-3 w-full text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr>
              <th className="py-1 text-left font-normal">Criteria</th>
              <th className="text-left font-normal">Weight</th>
              <th className="text-left font-normal">Value</th>
              <th className="text-right font-normal">Weighted</th>
            </tr>
          </thead>
          <tbody>
            {criteria.map((c) => (
              <tr key={c.label} className="border-t border-border">
                <td className="py-2 font-medium">{c.label}</td>
                <td className="py-2 text-muted-foreground">{c.weight}%</td>
                <td className="py-2 text-muted-foreground">{c.value}</td>
                <td className="py-2 text-right tabular-nums">{Math.round((c.raw * c.weight) / 100)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-3 rounded bg-muted px-3 py-2 text-xs font-medium">
          {total > 70 ? "✓ WORK THIS REQ — strike zone" : "LOW PRIORITY — focus on higher-scoring reqs"}
        </div>
      </div>

      <div className="rounded-lg border border-border p-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <AlertTriangle className="h-4 w-4 text-score-mid" />
          Ghost Job Indicators
        </div>
        <ul className="mt-3 space-y-2 text-sm">
          {[
            ["Posted >30 days with no update", ghost.reasons.includes("Posted >30 days with no update")],
            ["No AM contact info — email-only lead", ghost.reasons.includes("No AM contact info — email-only lead")],
            ["JD is unusually short / generic-looking", ghost.reasons.includes("JD is unusually short / generic-looking")],
          ].map(([label, checked]) => (
            <li key={label as string} className="flex items-center gap-2">
              <Checkbox checked={checked as boolean} disabled />
              <span className="text-xs">{label}</span>
            </li>
          ))}
        </ul>
        {ghost.isGhost && (
          <div className="mt-3 rounded bg-score-low/10 px-3 py-2 text-xs font-medium text-score-low">
            Likely Ghost Job — High risk of resume harvesting
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border p-4">
        <h3 className="text-sm font-semibold">Job Description</h3>
        <p className="mt-2 whitespace-pre-line text-xs text-muted-foreground leading-relaxed">
          {r.jd_text || "No job description text provided."}
        </p>
      </div>

      <div className="flex gap-2 pt-2">
        <Button
          className="flex-1"
          onClick={() => {
            onClose();
            navigate({
              to: "/submit",
              search: { reqId: r.id },
            });
          }}
        >
          <Send className="mr-1.5 h-4 w-4" /> Submit Consultant
        </Button>
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => {
            onClose();
            navigate({
              to: "/resume-tailor",
              search: { reqId: r.id },
            });
          }}
        >
          <FileText className="mr-1.5 h-4 w-4" /> Tailor Resume
        </Button>
      </div>

      {editOpen && (
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <EditRequirementModal
            r={r}
            onDone={() => {
              setEditOpen(false);
            }}
          />
        </Dialog>
      )}
    </div>
  );
}

function EditRequirementModal({ r, onDone }: { r: any; onDone: () => void }) {
  const update = useUpdateRequirement();
  const { data: marketRates = [] } = useMarketRates();

  const [title, setTitle] = useState(r.title || "");
  const [vendor, setVendor] = useState(r.vendor_name || r.client_masked || "");
  const [stack, setStack] = useState((r.tech_stack ?? []).join(", "));
  const [city, setCity] = useState(r.location_city || "");
  const [state, setState] = useState(r.location_state || "");
  const [rateMin, setRateMin] = useState(r.rate_min ? String(r.rate_min) : "");
  const [rateMax, setRateMax] = useState(r.rate_max ? String(r.rate_max) : "");
  const [sourceType, setSourceType] = useState<"direct" | "tier1" | "jobboard">(r.source_type || "tier1");
  const [status, setStatus] = useState(r.status || "new");
  const [amName, setAmName] = useState(r.am_name || "");
  const [amPhone, setAmPhone] = useState(r.am_phone || "");
  const [postedDate, setPostedDate] = useState(r.posted_date || "");
  const [jd, setJd] = useState(r.jd_text || "");

  const techStackList = stack.split(",").map((s) => s.trim()).filter(Boolean);
  const rateMaxNum = rateMax ? Number(rateMax) : null;

  const { total: livePreviewScore } = scoreRequirement(
    {
      source_type: sourceType,
      rate_max: rateMaxNum,
      jd_text: jd,
      am_name: amName,
      am_phone: amPhone,
      posted_date: postedDate,
      tech_stack: techStackList,
    },
    marketRates,
  );

  async function handleSave() {
    if (!title.trim()) return toast.error("Title is required");

    const scoringInput = {
      source_type: sourceType,
      rate_max: rateMaxNum,
      jd_text: jd,
      am_name: amName,
      am_phone: amPhone,
      posted_date: postedDate,
      tech_stack: techStackList,
    };
    const { total } = scoreRequirement(scoringInput, marketRates);
    const ghost = checkGhostJob(scoringInput);

    try {
      await update.mutateAsync({
        id: r.id,
        patch: {
          title: title.trim(),
          vendor_name: vendor || null,
          client_masked: vendor || null,
          tech_stack: techStackList,
          location_city: city || null,
          location_state: state || null,
          rate_min: rateMin ? Number(rateMin) : null,
          rate_max: rateMaxNum,
          source_type: sourceType,
          status,
          jd_text: jd || null,
          am_name: amName || null,
          am_phone: amPhone || null,
          posted_date: postedDate || null,
          req_score: total,
          is_ghost: ghost.isGhost,
          ghost_reasons: ghost.reasons,
        },
      });
      toast.success("Requirement updated successfully!");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update requirement");
    }
  }

  return (
    <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Edit Requirement</DialogTitle>
      </DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label>Job title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <Label>Client / Vendor</Label>
          <Input value={vendor} onChange={(e) => setVendor(e.target.value)} />
        </div>
        <div>
          <Label>Pipeline Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="reviewing">Reviewing</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="interview">Interview</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Label>Tech stack (comma separated)</Label>
          <Input value={stack} onChange={(e) => setStack(e.target.value)} />
        </div>
        <div>
          <Label>City</Label>
          <Input value={city} onChange={(e) => setCity(e.target.value)} />
        </div>
        <div>
          <Label>State</Label>
          <Input value={state} onChange={(e) => setState(e.target.value)} />
        </div>
        <div>
          <Label>Rate min ($/hr)</Label>
          <Input type="number" value={rateMin} onChange={(e) => setRateMin(e.target.value)} />
        </div>
        <div>
          <Label>Rate max ($/hr)</Label>
          <Input type="number" value={rateMax} onChange={(e) => setRateMax(e.target.value)} />
        </div>
        <div>
          <Label>Source type</Label>
          <Select value={sourceType} onValueChange={(v) => setSourceType(v as any)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="direct">Direct</SelectItem>
              <SelectItem value="tier1">Tier-1</SelectItem>
              <SelectItem value="jobboard">Job Board</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Posted date</Label>
          <Input type="date" value={postedDate} onChange={(e) => setPostedDate(e.target.value)} />
        </div>
        <div>
          <Label>AM name</Label>
          <Input value={amName} onChange={(e) => setAmName(e.target.value)} />
        </div>
        <div>
          <Label>AM phone</Label>
          <Input value={amPhone} onChange={(e) => setAmPhone(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <Label>Job Description (JD)</Label>
          <Textarea rows={5} value={jd} onChange={(e) => setJd(e.target.value)} />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2">
        <span className="text-xs text-muted-foreground">Recalculated Req-Score preview</span>
        <ScoreBadge score={livePreviewScore} />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={update.isPending}>
          {update.isPending ? "Saving…" : "Save Changes"}
        </Button>
      </div>
    </DialogContent>
  );
}

function AddRequirementModal({ onDone }: { onDone: () => void }) {
  const create = useCreateRequirement();
  const { data: marketRates = [] } = useMarketRates();
  const [title, setTitle] = useState("");
  const [vendor, setVendor] = useState("");
  const [stack, setStack] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [rateMin, setRateMin] = useState("");
  const [rateMax, setRateMax] = useState("");
  const [sourceType, setSourceType] = useState<"direct" | "tier1" | "jobboard">("tier1");
  const [amName, setAmName] = useState("");
  const [amPhone, setAmPhone] = useState("");
  const [postedDate, setPostedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [jd, setJd] = useState("");

  const techStackList = stack.split(",").map((s) => s.trim()).filter(Boolean);
  const rateMaxNum = rateMax ? Number(rateMax) : null;

  const { total: livePreviewScore } = scoreRequirement(
    {
      source_type: sourceType,
      rate_max: rateMaxNum,
      jd_text: jd,
      am_name: amName,
      am_phone: amPhone,
      posted_date: postedDate,
      tech_stack: techStackList,
    },
    marketRates,
  );

  async function save() {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    const scoringInput = {
      source_type: sourceType,
      rate_max: rateMaxNum,
      jd_text: jd,
      am_name: amName,
      am_phone: amPhone,
      posted_date: postedDate,
      tech_stack: techStackList,
    };
    const { total } = scoreRequirement(scoringInput, marketRates);
    const ghost = checkGhostJob(scoringInput);

    try {
      await create.mutateAsync({
        title: title.trim(),
        vendor_name: vendor || null,
        client_masked: vendor || null,
        tech_stack: techStackList,
        location_city: city || null,
        location_state: state || null,
        rate_min: rateMin ? Number(rateMin) : null,
        rate_max: rateMaxNum,
        source_type: sourceType,
        origin_channel: "manual",
        jd_text: jd || null,
        am_name: amName || null,
        am_phone: amPhone || null,
        posted_date: postedDate || null,
        req_score: total,
        is_ghost: ghost.isGhost,
        ghost_reasons: ghost.reasons,
      });
      toast.success(`Requirement added — Req-Score ${total}${ghost.isGhost ? " (flagged as likely ghost job)" : ""}`);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add requirement");
    }
  }

  return (
    <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Add requirement</DialogTitle>
      </DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label>Job title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Senior Java Developer" />
        </div>
        <div>
          <Label>Client / vendor</Label>
          <Input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Apex Systems" />
        </div>
        <div>
          <Label>Tech stack (comma separated)</Label>
          <Input value={stack} onChange={(e) => setStack(e.target.value)} placeholder="Java, Spring Boot, AWS" />
        </div>
        <div>
          <Label>City</Label>
          <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Dallas" />
        </div>
        <div>
          <Label>State</Label>
          <Input value={state} onChange={(e) => setState(e.target.value)} placeholder="TX" />
        </div>
        <div>
          <Label>Rate min ($/hr)</Label>
          <Input type="number" value={rateMin} onChange={(e) => setRateMin(e.target.value)} placeholder="65" />
        </div>
        <div>
          <Label>Rate max ($/hr)</Label>
          <Input type="number" value={rateMax} onChange={(e) => setRateMax(e.target.value)} placeholder="95" />
        </div>
        <div>
          <Label>Source type</Label>
          <Select value={sourceType} onValueChange={(v) => setSourceType(v as any)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="direct">Direct</SelectItem>
              <SelectItem value="tier1">Tier-1</SelectItem>
              <SelectItem value="jobboard">Job Board</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Posted date</Label>
          <Input type="date" value={postedDate} onChange={(e) => setPostedDate(e.target.value)} />
        </div>
        <div>
          <Label>AM name</Label>
          <Input value={amName} onChange={(e) => setAmName(e.target.value)} placeholder="Priya Shah" />
        </div>
        <div>
          <Label>AM phone</Label>
          <Input value={amPhone} onChange={(e) => setAmPhone(e.target.value)} placeholder="+1 (469) 555-1010" />
        </div>
        <div className="sm:col-span-2">
          <Label>JD</Label>
          <Textarea rows={5} value={jd} onChange={(e) => setJd(e.target.value)} placeholder="Paste the JD here…" />
        </div>
      </div>
      <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2">
        <span className="text-xs text-muted-foreground">Live Req-Score preview</span>
        <ScoreBadge score={livePreviewScore} />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button onClick={save} disabled={create.isPending}>
          {create.isPending ? "Saving…" : "Save requirement"}
        </Button>
      </div>
    </DialogContent>
  );
}