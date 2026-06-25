import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { OriginIcon, ScoreBadge, SourceBadge, StatusPill, SyncStatusBadge } from "@/components/req-badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { Requirement } from "@/lib/mock-data";
import { useRequirements, useCreateRequirement, useMarketRates } from "@/lib/api";
import { scoreRequirement, checkGhostJob } from "@/lib/scoring";
import { toast } from "sonner";
import { AlertTriangle, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

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
  const { data: seed = [], isLoading } = useRequirements();

  const filtered = useMemo(() => {
    return seed.filter((r) => {
      if (query && !`${r.title} ${r.tech_stack.join(" ")} ${r.location_city}`.toLowerCase().includes(query.toLowerCase())) return false;
      if (origin !== "all" && r.origin_channel !== origin) return false;
      if (scoreBand === "high" && r.req_score <= 70) return false;
      if (scoreBand === "mid" && (r.req_score < 50 || r.req_score > 70)) return false;
      if (scoreBand === "low" && r.req_score >= 50) return false;
      return true;
    });
  }, [query, origin, scoreBand]);

  const open = filtered.find((r) => r.id === openId) ?? null;

  return (
    <div>
      <PageHeader
        title="Requirements Pipeline"
        subtitle={`${filtered.length} of ${seed.length} requirements`}
        actions={
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="mr-1.5 h-4 w-4" />Add requirement</Button>
            </DialogTrigger>
            <AddRequirementModal onDone={() => setAddOpen(false)} />
          </Dialog>
        }
      />
      <div className="space-y-4 p-6">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface p-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search title, stack, city…" className="pl-9" />
          </div>
          <Select value={origin} onValueChange={setOrigin}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Origin" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All origins</SelectItem>
              <SelectItem value="dice">Dice</SelectItem>
              <SelectItem value="gmail">Gmail</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
            </SelectContent>
          </Select>
          <Select value={scoreBand} onValueChange={setScoreBand}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Score" /></SelectTrigger>
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
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-t border-border transition-colors hover:bg-accent/40">
                    <td className="px-4 py-3">
                      <div className="font-medium">{r.title}</div>
                      <div className="text-xs text-muted-foreground">{r.client_masked}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {r.tech_stack.slice(0, 3).map((t) => (
                          <span key={t} className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{t}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{r.location_city}, {r.location_state}</td>
                    <td className="px-4 py-3 tabular-nums">${r.rate_min}–${r.rate_max}</td>
                    <td className="px-4 py-3"><SourceBadge source={r.source_type} /></td>
                    <td className="px-4 py-3"><OriginIcon channel={r.origin_channel} withLabel /></td>
                    <td className="px-4 py-3 text-muted-foreground">{r.posted_date}</td>
                    <td className="px-4 py-3"><ScoreBadge score={r.req_score} /></td>
                    <td className="px-4 py-3"><StatusPill status={r.status} /></td>
                    <td className="px-4 py-3"><SyncStatusBadge status={r.sheet_sync_status} /></td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="ghost" onClick={() => setOpenId(r.id)}>View</Button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={11} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    {isLoading ? "Loading…" : seed.length === 0 ? "No requirements yet. Add one or seed demo data from the Dashboard." : "No requirements match your filters."}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Sheet open={!!open} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {open && <ReqDetail r={open} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function ReqDetail({ r }: { r: any }) {
  const { data: marketRates = [] } = useMarketRates();
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
  return (
    <div>
      <SheetHeader>
        <SheetTitle className="text-lg">{r.title}</SheetTitle>
      </SheetHeader>
      <div className="mt-1 text-sm text-muted-foreground">
        {r.client_masked} · {r.location_city}, {r.location_state} · ${r.rate_min}–${r.rate_max}/hr
      </div>

      <div className="mt-6 rounded-lg border border-border p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Req-Score breakdown</h3>
          <ScoreBadge score={total} />
        </div>
        <table className="mt-3 w-full text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr><th className="py-1 text-left font-normal">Criteria</th><th className="text-left font-normal">Weight</th><th className="text-left font-normal">Value</th><th className="text-right font-normal">Weighted</th></tr>
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

      <div className="mt-4 rounded-lg border border-border p-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <AlertTriangle className="h-4 w-4 text-score-mid" />
          Ghost job indicators
        </div>
        <ul className="mt-3 space-y-2 text-sm">
          {[
            ["Posted >30 days with no update", ghost.reasons.includes("Posted >30 days with no update")],
            ["No AM contact info — email-only lead", ghost.reasons.includes("No AM contact info — email-only lead")],
            ["JD is unusually short / generic-looking", ghost.reasons.includes("JD is unusually short / generic-looking")],
          ].map(([label, checked]) => (
            <li key={label as string} className="flex items-center gap-2">
              <Checkbox checked={checked as boolean} disabled />
              <span>{label}</span>
            </li>
          ))}
        </ul>
        {ghost.isGhost && (
          <div className="mt-3 rounded bg-score-low/10 px-3 py-2 text-xs font-medium text-score-low">
            Likely Ghost Job — Skip
          </div>
        )}
      </div>

      <div className="mt-4 rounded-lg border border-border p-4">
        <h3 className="text-sm font-semibold">JD</h3>
        <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{r.jd_text}</p>
      </div>

      <div className="mt-4 flex gap-2">
        <Button className="flex-1">Submit consultant</Button>
        <Button variant="outline" className="flex-1">Tailor resume</Button>
      </div>
    </div>
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

  // Live preview so the recruiter sees the score *before* saving —
  // recalculated on every keystroke from the same scoring.ts logic
  // that the detail drawer uses, so there's never a mismatch.
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
      toast.error(e instanceof Error ? e.message : "Failed to add");
    }
  }

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>Add requirement</DialogTitle>
      </DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><Label>Job title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Senior Java Developer" /></div>
        <div><Label>Client / vendor</Label><Input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Apex Systems" /></div>
        <div><Label>Tech stack (comma separated)</Label><Input value={stack} onChange={(e) => setStack(e.target.value)} placeholder="Java, Spring Boot, AWS" /></div>
        <div><Label>City</Label><Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Dallas" /></div>
        <div><Label>State</Label><Input value={state} onChange={(e) => setState(e.target.value)} placeholder="TX" /></div>
        <div><Label>Rate min ($/hr)</Label><Input type="number" value={rateMin} onChange={(e) => setRateMin(e.target.value)} placeholder="65" /></div>
        <div><Label>Rate max ($/hr)</Label><Input type="number" value={rateMax} onChange={(e) => setRateMax(e.target.value)} placeholder="95" /></div>
        <div><Label>Source type</Label>
          <Select value={sourceType} onValueChange={(v) => setSourceType(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="direct">Direct</SelectItem>
              <SelectItem value="tier1">Tier-1</SelectItem>
              <SelectItem value="jobboard">Job Board</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label>Posted date</Label><Input type="date" value={postedDate} onChange={(e) => setPostedDate(e.target.value)} /></div>
        <div><Label>AM name</Label><Input value={amName} onChange={(e) => setAmName(e.target.value)} placeholder="Priya Shah" /></div>
        <div><Label>AM phone</Label><Input value={amPhone} onChange={(e) => setAmPhone(e.target.value)} placeholder="+1 (469) 555-1010" /></div>
        <div className="sm:col-span-2"><Label>JD</Label><Textarea rows={5} value={jd} onChange={(e) => setJd(e.target.value)} placeholder="Paste the JD here…" /></div>
      </div>
      <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2">
        <span className="text-xs text-muted-foreground">Live Req-Score preview</span>
        <ScoreBadge score={livePreviewScore} />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onDone}>Cancel</Button>
        <Button onClick={save} disabled={create.isPending}>{create.isPending ? "Saving…" : "Save requirement"}</Button>
      </div>
    </DialogContent>
  );
}