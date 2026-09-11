import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Dices, FileSpreadsheet, Mail, Plug, RefreshCw, CheckCircle2, XCircle, Clock,
  ExternalLink, Loader2, Copy, Check, Code, HelpCircle, Send, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import {
  useIntegrationConfigs, useUpsertIntegrationConfig, useSyncLogs,
  useStartGoogleOAuth, useCreateSheet, useRunSheetsSync, useRunDiceScrape, useRunGmailParse,
  useRequirements,
} from "@/lib/api";

export const Route = createFileRoute("/_authenticated/integrations")({
  head: () => ({
    meta: [
      { title: "Integrations Hub — Jobib" },
      { name: "description", content: "Google Sheets sync, Dice scraper, and Gmail parser in one hub." },
    ],
  }),
  component: IntegrationsPage,
});

function IntegrationsPage() {
  return (
    <div>
      <PageHeader title="Integrations Hub" subtitle="Connect data in. Sync data out. One Google account covers Sheets + Gmail." />
      <div className="space-y-6 p-6">
        <SheetsCard />
        <DiceCard />
        <GmailCard />
        <LogsCard />
      </div>
    </div>
  );
}

function IntegrationCardShell({
  Icon, title, subtitle, connected, status, children, onRun, running,
}: {
  Icon: typeof Plug; title: string; subtitle: string; connected: boolean;
  status: "ok" | "paused" | "fail" | "unknown"; children: React.ReactNode; onRun: () => void; running?: boolean;
}) {
  const dot = status === "ok" ? "bg-sync-ok" : status === "paused" ? "bg-sync-pending" : status === "fail" ? "bg-sync-fail" : "bg-muted-foreground/30";
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent text-accent-foreground"><Icon className="h-4 w-4" /></span>
          <div>
            <h2 className="text-base font-semibold">{title}</h2>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-1 text-xs"><span className={`h-1.5 w-1.5 rounded-full ${dot}`} />{connected ? "Connected" : "Not connected"}</span>
          <Button size="sm" variant="outline" onClick={onRun} disabled={running || !connected}>
            {running ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
            Run now
          </Button>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function SheetsCard() {
  const { data: configs = [] } = useIntegrationConfigs();
  const { data: requirements = [] } = useRequirements();
  const config = configs.find((c: any) => c.integration_type === "google_sheets");
  const cfg = (config?.config ?? {}) as Record<string, any>;

  const [sheetUrl, setSheetUrl] = useState<string>(cfg.sheet_url || (cfg.sheet_id ? `https://docs.google.com/spreadsheets/d/${cfg.sheet_id}` : ""));
  const [webhookUrl, setWebhookUrl] = useState<string>(cfg.webhook_url || "");
  const [autoNew, setAutoNew] = useState<boolean>(cfg.auto_new ?? true);
  const [autoStatus, setAutoStatus] = useState<boolean>(cfg.auto_status ?? true);
  const [isPushing, setIsPushing] = useState<boolean>(false);
  const [copiedScript, setCopiedScript] = useState<boolean>(false);

  useEffect(() => {
    if (cfg.sheet_url) setSheetUrl(cfg.sheet_url);
    if (cfg.webhook_url) setWebhookUrl(cfg.webhook_url);
  }, [config]);

  const isOAuthConnected = Boolean(config?.enabled && cfg.refresh_token);
  const isWebhookConnected = Boolean(webhookUrl.trim());
  const isConnected = isOAuthConnected || isWebhookConnected || Boolean(sheetUrl.trim());

  const startOAuth = useStartGoogleOAuth();
  const createSheet = useCreateSheet();
  const runSync = useRunSheetsSync();
  const upsert = useUpsertIntegrationConfig();

  const scriptCode = `function doPost(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getActiveSheet();
    var payload = JSON.parse(e.postData.contents);
    var reqs = payload.requirements || [];

    // Initialize header row if sheet is empty
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "Job Title", "Client / Vendor", "Tech Stack", "Location",
        "Rate", "Req-Score", "Source Type", "Status", "Posted Date", "AM Contact"
      ]);
      sheet.getRange(1, 1, 1, 10).setFontWeight("bold").setBackground("#f3f4f6");
    }

    for (var i = 0; i < reqs.length; i++) {
      var r = reqs[i];
      sheet.appendRow([
        r.title || "",
        r.client || "",
        r.stack || "",
        r.location || "",
        r.rate || "",
        r.score || "",
        r.source || "",
        r.status || "",
        r.date || "",
        r.contact || ""
      ]);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ status: "success", count: reqs.length }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`;

  async function handleSaveConfig() {
    try {
      await upsert.mutateAsync({
        integration_type: "google_sheets",
        enabled: isConnected,
        config: {
          ...cfg,
          sheet_url: sheetUrl.trim(),
          webhook_url: webhookUrl.trim(),
          auto_new: autoNew,
          auto_status: autoStatus,
        },
      });
      toast.success("Google Sheets configuration saved!");
    } catch (e: any) {
      toast.error(e.message || "Failed to save configuration");
    }
  }

  async function handleRunSync() {
    setIsPushing(true);
    try {
      if (webhookUrl.trim()) {
        const payload = {
          action: "sync_requirements",
          requirements: requirements.map((r: any) => ({
            title: r.title,
            client: r.client_masked || r.vendor_name || "Direct Client",
            stack: (r.tech_stack ?? []).join(", "),
            location: [r.location_city, r.location_state].filter(Boolean).join(", "),
            rate: r.rate_max ? `$${r.rate_min ? `${r.rate_min}-$` : ""}${r.rate_max}/hr` : "",
            score: r.req_score,
            source: r.source_type,
            status: r.status,
            date: r.posted_date,
            contact: [r.am_name, r.am_phone, r.am_email].filter(Boolean).join(" / "),
          })),
        };

        // Post to Google Apps Script Webhook (no-cors prevents redirect blocker)
        await fetch(webhookUrl.trim(), {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        await runSync.mutateAsync();
        toast.success(`Successfully pushed ${requirements.length} requirements to your Google Sheet!`);
      } else {
        const res = await runSync.mutateAsync();
        toast.success(`Synced ${res.appended || requirements.length} requirements!`);
      }
    } catch (e: any) {
      toast.error(e.message || "Sync failed");
    } finally {
      setIsPushing(false);
    }
  }

  async function handleConnectOAuth() {
    try {
      const url = await startOAuth.mutateAsync();
      window.open(url, "_blank", "width=500,height=650");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to start Google connection");
    }
  }

  const cols = [
    ["Job Title", "A"], ["Client/Vendor", "B"], ["Tech Stack", "C"], ["Location", "D"],
    ["Rate", "E"], ["Source Type", "F"], ["Req-Score", "G"], ["AM Contact", "H"],
    ["Posted Date", "I"], ["Status", "J"],
  ];

  return (
    <IntegrationCardShell
      Icon={FileSpreadsheet}
      title="Google Sheets Live Sync"
      subtitle="Every requirement automatically rolls to your Google Sheet in real time."
      connected={isConnected}
      status={isConnected ? "ok" : "unknown"}
      onRun={handleRunSync}
      running={isPushing || runSync.isPending}
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          {/* Method Selection Header */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Connection Settings
            </span>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-primary hover:text-primary">
                  <HelpCircle className="mr-1 h-3.5 w-3.5" /> 1-Min Setup Guide
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-xl">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5 text-emerald-500" />
                    How to Connect Any Google Sheet in 1 Minute
                  </DialogTitle>
                  <DialogDescription>
                    No Google Cloud Console or billing required. Works on any Google account.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 py-2 text-xs">
                  <ol className="list-decimal space-y-2 pl-4 text-foreground">
                    <li>Open your Google Sheet (or create a new blank Google Sheet).</li>
                    <li>In the menu bar, click <strong>Extensions ➔ Apps Script</strong>.</li>
                    <li>Replace all code in the editor with the script below and click <strong>Save (Ctrl+S)</strong>.</li>
                    <li>Click the blue <strong>Deploy ➔ New deployment</strong> button (top right).</li>
                    <li>Select type: <strong>Web app</strong>. Under <em>"Who has access"</em>, choose <strong>"Anyone"</strong>.</li>
                    <li>Click <strong>Deploy</strong>, copy the <strong>Web app URL</strong>, and paste it into the Webhook URL field in Jobib!</li>
                  </ol>

                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-1 font-semibold">
                      <span>Apps Script Code:</span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 px-2 text-[11px]"
                        onClick={() => {
                          navigator.clipboard.writeText(scriptCode);
                          setCopiedScript(true);
                          toast.success("Apps script copied to clipboard!");
                          setTimeout(() => setCopiedScript(false), 2000);
                        }}
                      >
                        {copiedScript ? <Check className="mr-1 h-3 w-3 text-emerald-500" /> : <Copy className="mr-1 h-3 w-3" />}
                        {copiedScript ? "Copied!" : "Copy Script"}
                      </Button>
                    </div>
                    <pre className="max-h-48 overflow-auto rounded bg-muted p-3 text-[11px] font-mono leading-relaxed text-muted-foreground">
                      {scriptCode}
                    </pre>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Google Sheet URL */}
          <div>
            <Label className="text-xs font-medium">Google Sheet Link / URL</Label>
            <div className="mt-1 flex gap-2">
              <Input
                value={sheetUrl}
                onChange={(e) => setSheetUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/your-sheet-id/edit"
                className="text-xs"
              />
              {sheetUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(sheetUrl.startsWith("http") ? sheetUrl : `https://docs.google.com/spreadsheets/d/${sheetUrl}`, "_blank")}
                  title="Open sheet in new tab"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>

          {/* Webhook Sync URL (Instant Apps Script) */}
          <div>
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Google Apps Script Webhook URL (Recommended)</Label>
              <span className="text-[10px] text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded font-medium">
                Instant / No OAuth
              </span>
            </div>
            <Input
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://script.google.com/macros/s/.../exec"
              className="mt-1 text-xs font-mono"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 pt-1">
            <Button size="sm" onClick={handleSaveConfig} disabled={upsert.isPending} className="flex-1">
              Save Configuration
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleRunSync}
              disabled={isPushing || (!webhookUrl && !sheetUrl)}
              className="flex-1"
            >
              {isPushing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1.5 h-3.5 w-3.5 text-primary" />}
              Push Reqs to Sheet Now
            </Button>
          </div>

          {/* Auto-sync toggles */}
          <div className="space-y-2 pt-2 border-t border-border">
            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <Label htmlFor="autoNew" className="text-xs">Auto-sync when new requirement is added</Label>
              <Switch
                id="autoNew"
                checked={autoNew}
                onCheckedChange={(v) => {
                  setAutoNew(v);
                  upsert.mutate({
                    integration_type: "google_sheets",
                    enabled: isConnected,
                    config: { ...cfg, sheet_url: sheetUrl, webhook_url: webhookUrl, auto_new: v },
                  });
                }}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <Label htmlFor="autoStatus" className="text-xs">Auto-sync on requirement status change</Label>
              <Switch
                id="autoStatus"
                checked={autoStatus}
                onCheckedChange={(v) => {
                  setAutoStatus(v);
                  upsert.mutate({
                    integration_type: "google_sheets",
                    enabled: isConnected,
                    config: { ...cfg, sheet_url: sheetUrl, webhook_url: webhookUrl, auto_status: v },
                  });
                }}
              />
            </div>
          </div>
        </div>

        {/* Column Mapping and Status */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Automatic Column Mapping</div>
            <span className="text-xs text-muted-foreground">10 Columns</span>
          </div>
          <div className="overflow-hidden rounded-md border border-border text-xs">
            {cols.map(([field, col]) => (
              <div key={field} className="flex items-center justify-between border-b border-border px-3 py-1.5 last:border-b-0">
                <span className="font-medium text-foreground">{field}</span>
                <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-mono text-muted-foreground">Col {col}</span>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-border bg-muted/20 p-3 text-xs text-muted-foreground space-y-1">
            <div className="font-medium text-foreground flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> Live Sync Tips:
            </div>
            <p>
              When synced, each requirement will be appended as a new row with its Job Title, Tech Stack, Pay Rate, Req-Score, and Account Manager contact details.
            </p>
          </div>
        </div>
      </div>
    </IntegrationCardShell>
  );
}

function DiceCard() {
  const [keywords, setKeywords] = useState("Java Developer, Salesforce Admin");
  const [location, setLocation] = useState("Dallas, TX");
  const runScrape = useRunDiceScrape();
  const [lastResult, setLastResult] = useState<{ found: number; added: number; duplicatesSkipped: number } | null>(null);

  async function handleRun() {
    try {
      const result = await runScrape.mutateAsync({ keywords, location });
      setLastResult(result);
      toast.success(`Found ${result.found} listings, added ${result.added} new`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Dice scrape failed");
    }
  }

  return (
    <IntegrationCardShell
      Icon={Dices} title="Dice.com scraper"
      subtitle="Public listings only. Rate-limited and de-duplicated with AI."
      connected status={runScrape.isError ? "fail" : "ok"} onRun={handleRun} running={runScrape.isPending}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <div><Label>Search keywords</Label><Input value={keywords} onChange={(e) => setKeywords(e.target.value)} /></div>
          <div><Label>Location</Label><Input value={location} onChange={(e) => setLocation(e.target.value)} /></div>
          <div>
            <Label>Scrape frequency</Label>
            <Select defaultValue="60">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="30">Every 30 minutes</SelectItem>
                <SelectItem value="60">Every 1 hour</SelectItem>
                <SelectItem value="180">Every 3 hours</SelectItem>
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">Scheduling requires pg_cron setup — see comments in the scrape-dice function. "Run now" works immediately.</p>
          </div>
        </div>
        <div className="rounded-md border border-border p-4 text-sm">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Last manual run</div>
          {lastResult ? (
            <dl className="mt-3 space-y-1 text-xs text-muted-foreground">
              <div className="flex justify-between"><dt>Listings scanned</dt><dd className="tabular-nums">{lastResult.found}</dd></div>
              <div className="flex justify-between"><dt>New reqs added</dt><dd className="tabular-nums">{lastResult.added}</dd></div>
              <div className="flex justify-between"><dt>Duplicates skipped</dt><dd className="tabular-nums">{lastResult.duplicatesSkipped}</dd></div>
            </dl>
          ) : (
            <div className="mt-1 text-sm text-muted-foreground">Click "Run now" to scrape.</div>
          )}
          <p className="mt-4 rounded bg-muted px-2 py-2 text-[11px] text-muted-foreground">
            Public listings scraper only. Dice's page structure can change without notice — if a run returns 0 results, check the sync log below.
          </p>
        </div>
      </div>
    </IntegrationCardShell>
  );
}

function GmailCard() {
  const { data: configs = [] } = useIntegrationConfigs();
  const config = configs.find((c: any) => c.integration_type === "gmail");
  const isConnected = Boolean(config?.enabled && (config?.config as any)?.refresh_token);
  const startOAuth = useStartGoogleOAuth();
  const runParse = useRunGmailParse();
  const [previews, setPreviews] = useState<any[]>([]);
  const vendors = ["TCS", "Infosys", "Cognizant", "Collabera", "Wipro"];

  async function connect() {
    try {
      const url = await startOAuth.mutateAsync();
      window.open(url, "_blank", "width=500,height=650");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to start Google connection");
    }
  }

  async function handleRun() {
    try {
      const result = await runParse.mutateAsync();
      setPreviews(result.previews ?? []);
      toast.success(`Scanned ${result.scanned}, extracted ${result.extracted} requirements`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gmail scan failed — connect Google first");
    }
  }

  return (
    <IntegrationCardShell
      Icon={Mail} title="Gmail parser"
      subtitle="Read-only Gmail access. AI extracts requirements from emails."
      connected={isConnected} status={isConnected ? "ok" : "unknown"} onRun={handleRun} running={runParse.isPending}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          {!isConnected && (
            <Button className="w-full" onClick={connect} disabled={startOAuth.isPending}>
              {startOAuth.isPending ? "Opening Google…" : "Connect Gmail (shares Google connection with Sheets)"}
            </Button>
          )}
          <div>
            <Label>Filter rule</Label>
            <Input defaultValue="is:unread from:(jobs OR requirements)" />
          </div>
          <div>
            <Label>Common vendor domains</Label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {vendors.map((v) => (
                <span key={v} className="rounded bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">{v}</span>
              ))}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Refine the filter rule above to target these senders, e.g. "from:tcs.com OR from:infosys.com".</p>
          </div>
        </div>
        <div>
          <div className="text-sm font-medium">Last run — extracted requirements</div>
          {previews.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Click "Run now" to scan your inbox.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {previews.map((p, i) => (
                <li key={i} className="rounded-md border border-border p-3 text-sm">
                  <div className="font-medium">{p.subject}</div>
                  <div className="text-xs text-muted-foreground">From {p.from} · ✓ Extracted</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </IntegrationCardShell>
  );
}

function LogsCard() {
  const { data: syncLogs = [] } = useSyncLogs();
  return (
    <section className="rounded-xl border border-border bg-surface">
      <div className="border-b border-border px-5 py-4"><h2 className="text-base font-semibold">Sync activity log</h2></div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left font-medium">When</th>
              <th className="px-4 py-2 text-left font-medium">Integration</th>
              <th className="px-4 py-2 text-left font-medium">Processed</th>
              <th className="px-4 py-2 text-left font-medium">Added</th>
              <th className="px-4 py-2 text-left font-medium">Status</th>
              <th className="px-4 py-2 text-left font-medium">Detail</th>
            </tr>
          </thead>
          <tbody>
            {syncLogs.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-xs text-muted-foreground">No syncs yet — run an integration above.</td></tr>
            ) : (
              syncLogs.map((l: any) => (
                <tr key={l.id} className="border-t border-border">
                  <td className="px-4 py-2 text-muted-foreground">{new Date(l.run_at).toLocaleString()}</td>
                  <td className="px-4 py-2 capitalize">{l.integration_type.replace("_", " ")}</td>
                  <td className="px-4 py-2 tabular-nums">{l.records_processed}</td>
                  <td className="px-4 py-2 tabular-nums">{l.records_added}</td>
                  <td className="px-4 py-2">
                    {l.status === "success" && <span className="inline-flex items-center gap-1 text-sync-ok"><CheckCircle2 className="h-3.5 w-3.5" />Success</span>}
                    {l.status === "partial" && <span className="inline-flex items-center gap-1 text-sync-pending"><Clock className="h-3.5 w-3.5" />Partial</span>}
                    {l.status === "failed" && <span className="inline-flex items-center gap-1 text-sync-fail"><XCircle className="h-3.5 w-3.5" />Failed</span>}
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{l.error_message ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
