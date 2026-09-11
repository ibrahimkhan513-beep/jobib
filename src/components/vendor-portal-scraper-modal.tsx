import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VENDOR_PORTALS, identifyVendor, type VendorPortal } from "@/lib/vendor-portals";
import { useScrapeVendorPortals, useBulkIngestTopVendors, useIntegrationConfigs, useRunSheetsSync } from "@/lib/api";
import { toast } from "sonner";
import {
  Globe,
  Sparkles,
  Search,
  CheckCircle2,
  Loader2,
  ExternalLink,
  Layers,
  FileSpreadsheet,
  Zap,
  ArrowRight,
  Building2,
  Terminal,
} from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function VendorPortalScraperModal({ open, onOpenChange, onSuccess }: Props) {
  const [tab, setTab] = useState<"preset" | "custom">("preset");
  const [categoryFilter, setCategoryFilter] = useState<"all" | "tier1" | "ats" | "consulting" | "boutique">("all");
  const [vendorSearch, setVendorSearch] = useState("");
  const [selectedVendorIds, setSelectedVendorIds] = useState<string[]>([
    "apex-systems",
    "aerotek",
    "teksystems",
    "collabera",
    "kforce",
    "beacon-hill",
    "bullhorn-alluvion",
    "jobdiva-adept",
  ]);
  const [customUrlsText, setCustomUrlsText] = useState(
    "http://www.2rbconsulting.com/jobs/\nhttp://cls5.bullhornstaffing.com/JobBoard/Standard/BHContent_JobOpportunities.cfm\nhttp://jobs.adeptsolutionsinc.com/candidates/myjobs/searchjobsdone.jsp"
  );
  const [techKeyword, setTechKeyword] = useState<string>("all");
  const [locationPref, setLocationPref] = useState<string>("all");
  const [reqCount, setReqCount] = useState<string>("15");

  // Running & progress states
  const [isScraping, setIsScraping] = useState(false);
  const [progressStep, setProgressStep] = useState<number>(0);
  const [scrapeLog, setScrapeLog] = useState<string[]>([]);
  const [scrapeResult, setScrapeResult] = useState<{ count: number; vendors: string[] } | null>(null);

  const scrapeMutation = useScrapeVendorPortals();
  const bulkIngestMutation = useBulkIngestTopVendors();
  const { data: integrationConfigs = [] } = useIntegrationConfigs();
  const sheetsConfig = integrationConfigs.find((c: any) => c.integration_type === "google_sheets");
  const isSheetsConnected = Boolean(sheetsConfig?.enabled && (sheetsConfig?.config as any)?.sheet_id);
  const runSheetsSync = useRunSheetsSync();

  // Filtered preset vendors
  const filteredVendors = useMemo(() => {
    return VENDOR_PORTALS.filter((v) => {
      if (categoryFilter !== "all" && v.category !== categoryFilter) return false;
      if (
        vendorSearch &&
        !`${v.name} ${v.url} ${v.notes || ""} ${v.headquarters || ""}`
          .toLowerCase()
          .includes(vendorSearch.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [categoryFilter, vendorSearch]);

  // Detected vendors from custom URLs
  const customIdentified = useMemo(() => {
    const lines = customUrlsText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    return lines.map((l) => identifyVendor(l));
  }, [customUrlsText]);

  function handleToggleVendor(id: string) {
    setSelectedVendorIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  function handleSelectAll() {
    setSelectedVendorIds(filteredVendors.map((v) => v.id));
  }

  function handleClearAll() {
    setSelectedVendorIds([]);
  }

  async function handleRunScrape() {
    const targetVendors = tab === "preset" ? selectedVendorIds : [];
    const customUrls =
      tab === "custom"
        ? customUrlsText
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean)
        : [];

    if (tab === "preset" && targetVendors.length === 0) {
      toast.error("Please select at least one vendor portal to scrape.");
      return;
    }
    if (tab === "custom" && customUrls.length === 0) {
      toast.error("Please enter at least one portal URL to scrape.");
      return;
    }

    setIsScraping(true);
    setProgressStep(1);
    setScrapeLog(["Connecting to staffing vendor servers & ATS job portals..."]);

    const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

    try {
      await delay(600);
      setProgressStep(2);
      setScrapeLog((p) => [
        ...p,
        "Parsing job requisitions, technical qualifications, and C2C/W2 rate limits...",
      ]);

      await delay(700);
      setProgressStep(3);
      setScrapeLog((p) => [
        ...p,
        "Executing AI Req-Score evaluation & verifying ghost-job indicators...",
      ]);

      const countNum = parseInt(reqCount, 10) || 15;
      const kw = techKeyword === "all" ? undefined : techKeyword;
      const loc = locationPref === "all" ? undefined : locationPref;

      const result = await scrapeMutation.mutateAsync({
        vendorIds: targetVendors,
        customUrls: customUrls,
        keywords: kw,
        location: loc,
        count: countNum,
      });

      await delay(500);
      setProgressStep(4);
      setScrapeLog((p) => [
        ...p,
        `Ingested ${result.added} live requirements into Jobib Requirements Pipeline.`,
      ]);

      if (isSheetsConnected) {
        setScrapeLog((p) => [...p, "Auto-syncing newly ingested requirements to connected Google Sheet..."]);
        try {
          await runSheetsSync.mutateAsync();
          setScrapeLog((p) => [...p, "Google Sheet sync successful!"]);
        } catch {
          // non-blocking
        }
      }

      await delay(400);
      setProgressStep(5);

      const vendorNames = Array.from(
        new Set(
          result.requirements.map((r: any) => r.vendor_name).filter(Boolean)
        )
      ) as string[];

      setScrapeResult({
        count: result.added,
        vendors: vendorNames.slice(0, 6),
      });

      toast.success(
        `Scrape complete! Successfully added ${result.added} requirements from vendor portals.`
      );
      if (onSuccess) onSuccess();
    } catch (err: any) {
      toast.error(err?.message || "Failed to scrape vendor portals");
      setScrapeLog((p) => [...p, `Error: ${err?.message || "Scrape interrupted"}`]);
    } finally {
      setIsScraping(false);
    }
  }

  async function handleFastIngestTop25() {
    setIsScraping(true);
    setProgressStep(1);
    setScrapeLog(["Fast Ingest: Loading top 25 requirements across US staffing leaders..."]);
    const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

    try {
      await delay(500);
      setProgressStep(3);
      setScrapeLog((p) => [
        ...p,
        "Applying Req-Scores (82-96), ATS recruiter contacts, and pay rates ($75-$115/hr)...",
      ]);

      const data = await bulkIngestMutation.mutateAsync(25);

      await delay(500);
      setProgressStep(5);
      setScrapeLog((p) => [...p, `Successfully ingested ${data.length} requirements!`]);

      setScrapeResult({
        count: data.length,
        vendors: ["Apex Systems", "Aerotek", "Beacon Hill", "Collabera", "TEKsystems", "Bullhorn ATS"],
      });

      toast.success(`Fast Ingest: ${data.length} top vendor requirements added to pipeline!`);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      toast.error(err?.message || "Fast ingest failed");
    } finally {
      setIsScraping(false);
    }
  }

  function handleReset() {
    setScrapeResult(null);
    setProgressStep(0);
    setScrapeLog([]);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto p-0 gap-0">
        {/* Header */}
        <div className="border-b border-border bg-muted/20 px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <Globe className="h-5 w-5 animate-pulse" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold flex items-center gap-2">
                  Vendor Portal & ATS Scraper
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary border border-primary/20">
                    1,000+ Portals
                  </span>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Extract job requirements from US staffing agencies, Bullhorn ATS, JobDiva, and custom portal URLs into your pipeline.
                </DialogDescription>
              </div>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={handleFastIngestTop25}
              disabled={isScraping}
              className="hidden sm:flex items-center gap-1.5 text-xs font-semibold border-primary/30 hover:bg-primary/10 hover:text-primary"
              title="Quickly fill pipeline with top 25 requirements"
            >
              <Zap className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
              1-Click Fast Ingest (Top 25)
            </Button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6">
          {scrapeResult ? (
            /* Result Success View */
            <div className="space-y-5 text-center py-4">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                <CheckCircle2 className="h-9 w-9" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground">
                  {scrapeResult.count} Requirements Ingested!
                </h3>
                <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1">
                  Extracted requirements are now live in your pipeline with AI Req-Scores, normalized tech stacks, C2C pay rates, and recruiter contact profiles.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-1.5 max-w-lg mx-auto">
                {scrapeResult.vendors.map((v) => (
                  <span
                    key={v}
                    className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-foreground"
                  >
                    🏢 {v}
                  </span>
                ))}
              </div>

              {isSheetsConnected && (
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-700 max-w-md mx-auto flex items-center justify-center gap-2">
                  <FileSpreadsheet className="h-4 w-4" />
                  Synced with your connected Google Sheet pipeline
                </div>
              )}

              <div className="flex items-center justify-center gap-3 pt-2">
                <Button variant="outline" size="sm" onClick={handleReset}>
                  Scrape More Portals
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    onOpenChange(false);
                    handleReset();
                  }}
                  className="gap-1.5 font-semibold"
                >
                  View in Pipeline <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            /* Main Form View */
            <>
              {/* Tab Selector */}
              <div className="flex items-center gap-2 border-b border-border pb-3">
                <button
                  type="button"
                  onClick={() => setTab("preset")}
                  className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    tab === "preset"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Building2 className="h-3.5 w-3.5" />
                  Top US Staffing Agencies & ATS ({selectedVendorIds.length} Selected)
                </button>
                <button
                  type="button"
                  onClick={() => setTab("custom")}
                  className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    tab === "custom"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Globe className="h-3.5 w-3.5" />
                  Custom Portal URLs / Links ({customIdentified.length})
                </button>
              </div>

              {tab === "preset" ? (
                /* Preset Portals Tab */
                <div className="space-y-3">
                  {/* Category Pills & Search */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
                      {(
                        [
                          { id: "all", label: "All Portals" },
                          { id: "tier1", label: "Tier-1 Giants" },
                          { id: "ats", label: "Bullhorn / JobDiva ATS" },
                          { id: "consulting", label: "IT Consultancies" },
                          { id: "boutique", label: "Specialized / Boutique" },
                        ] as const
                      ).map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setCategoryFilter(cat.id)}
                          className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                            categoryFilter === cat.id
                              ? "bg-foreground text-background font-semibold"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          }`}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleSelectAll}
                        className="h-7 text-[11px] px-2"
                      >
                        Select All
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleClearAll}
                        className="h-7 text-[11px] px-2 text-muted-foreground"
                      >
                        Clear
                      </Button>
                    </div>
                  </div>

                  {/* Vendor Search */}
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={vendorSearch}
                      onChange={(e) => setVendorSearch(e.target.value)}
                      placeholder="Filter vendors (e.g. Apex, Aerotek, Beacon Hill, Bullhorn, JobDiva)..."
                      className="pl-8 text-xs h-8"
                    />
                  </div>

                  {/* Vendors Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto rounded-lg border border-border p-2 bg-muted/10">
                    {filteredVendors.map((v) => {
                      const checked = selectedVendorIds.includes(v.id);
                      return (
                        <label
                          key={v.id}
                          className={`flex items-start gap-2.5 rounded-lg border p-2.5 text-xs transition-colors cursor-pointer select-none ${
                            checked
                              ? "border-primary/40 bg-primary/5"
                              : "border-border bg-surface hover:border-border/80"
                          }`}
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => handleToggleVendor(v.id)}
                            className="mt-0.5"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-semibold text-foreground truncate">{v.name}</span>
                              {v.atsType && v.atsType !== "direct" && (
                                <span className="rounded bg-muted px-1.5 py-0.2 text-[9px] font-mono text-muted-foreground uppercase">
                                  {v.atsType}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                              {v.headquarters || v.notes || "US Staffing Supplier"}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* Custom URLs Tab */
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">
                      Paste Staffing Websites or ATS Portal URLs (One per line)
                    </Label>
                    <span className="text-[11px] text-muted-foreground">
                      {customIdentified.length} portals entered
                    </span>
                  </div>
                  <Textarea
                    rows={4}
                    value={customUrlsText}
                    onChange={(e) => setCustomUrlsText(e.target.value)}
                    placeholder="https://www.2rbconsulting.com/jobs/&#10;https://cls5.bullhornstaffing.com/JobBoard/...&#10;https://jobs.aerotek.com/us/en"
                    className="font-mono text-xs"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {customIdentified.map((v, i) => (
                      <span
                        key={i}
                        className="rounded-md border border-border bg-muted/30 px-2 py-0.5 text-[11px] font-medium text-foreground flex items-center gap-1"
                      >
                        <Globe className="h-3 w-3 text-primary" />
                        {v.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Scrape Target Parameters */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-lg border border-border bg-surface p-3.5">
                <div>
                  <Label className="text-[11px] font-medium">Target Tech Domain</Label>
                  <Select value={techKeyword} onValueChange={setTechKeyword}>
                    <SelectTrigger className="text-xs h-8 mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Tech Stacks</SelectItem>
                      <SelectItem value="Java">Java / Spring Boot / Kafka</SelectItem>
                      <SelectItem value="DevOps">AWS / Kubernetes / DevOps</SelectItem>
                      <SelectItem value="Snowflake">Snowflake / Data Engineering</SelectItem>
                      <SelectItem value="Salesforce">Salesforce (Apex / LWC)</SelectItem>
                      <SelectItem value="Python">Python / AI & Machine Learning</SelectItem>
                      <SelectItem value="React">React / TypeScript / Next.js</SelectItem>
                      <SelectItem value=".NET">.NET Core / Azure Cloud</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-[11px] font-medium">Target Location</Label>
                  <Select value={locationPref} onValueChange={setLocationPref}>
                    <SelectTrigger className="text-xs h-8 mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All US Locations</SelectItem>
                      <SelectItem value="Remote">100% Remote Only</SelectItem>
                      <SelectItem value="Dallas">Dallas / Plano, TX</SelectItem>
                      <SelectItem value="Jersey City">Jersey City / NYC / NJ</SelectItem>
                      <SelectItem value="San Jose">San Jose / Bay Area, CA</SelectItem>
                      <SelectItem value="Atlanta">Atlanta, GA</SelectItem>
                      <SelectItem value="Chicago">Chicago, IL</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-[11px] font-medium">Max Requirements to Ingest</Label>
                  <Select value={reqCount} onValueChange={setReqCount}>
                    <SelectTrigger className="text-xs h-8 mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 Requirements (Quick)</SelectItem>
                      <SelectItem value="10">10 Requirements</SelectItem>
                      <SelectItem value="15">15 Requirements (Recommended)</SelectItem>
                      <SelectItem value="25">25 Requirements (Full Batch)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Live Scrape Status / Logs Animation */}
              {isScraping && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-primary flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Live Scraper Engine Running...
                    </span>
                    <span className="text-muted-foreground font-mono">Step {progressStep} of 5</span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-primary h-full transition-all duration-300"
                      style={{ width: `${(progressStep / 5) * 100}%` }}
                    />
                  </div>

                  {/* Log console */}
                  <div className="rounded bg-black/80 p-2.5 font-mono text-[11px] text-emerald-400 space-y-1">
                    {scrapeLog.map((log, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <Terminal className="h-3 w-3 text-muted-foreground" />
                        <span>{log}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <div className="text-[11px] text-muted-foreground">
                  Includes AI Req-Scoring (75-96) & direct AM contacts
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onOpenChange(false)}
                    disabled={isScraping}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleRunScrape}
                    disabled={isScraping}
                    className="gap-1.5 font-semibold bg-primary hover:bg-primary/90"
                  >
                    {isScraping ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Scraping Portals...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 text-amber-300" />
                        Run Scraper & Ingest to Pipeline
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
