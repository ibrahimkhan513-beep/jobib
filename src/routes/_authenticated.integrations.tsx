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

function startGoogleOAuth(includeGmail = false) {
  const clientId =
    (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID ||
    "756858024939-gv1l0jlli08batkho4nql3et875sd63m.apps.googleusercontent.com";
  const redirectUri = `${window.location.origin}/integrations`;
  const scopes = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/userinfo.email",
  ];
  if (includeGmail) {
    scopes.push("https://www.googleapis.com/auth/gmail.readonly");
  }
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&response_type=token&scope=${encodeURIComponent(scopes.join(" "))}&prompt=consent`;

  window.location.href = authUrl;
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

  const upsert = useUpsertIntegrationConfig();
  const runSync = useRunSheetsSync();

  useEffect(() => {
    if (cfg.sheet_url) setSheetUrl(cfg.sheet_url);
    if (cfg.webhook_url) setWebhookUrl(cfg.webhook_url);
  }, [config]);

  // Handle Google OAuth Redirect Callback (#access_token=...)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (hash && hash.includes("access_token")) {
      const params = new URLSearchParams(hash.substring(1));
      const token = params.get("access_token");
      if (token) {
        window.history.replaceState(null, "", window.location.pathname);
        finalizeOAuthConnection(token);
      }
    }
  }, []);

  async function finalizeOAuthConnection(token: string) {
    const toastId = toast.loading("Finalizing Google account connection…");
    try {
      let userEmail = "Connected Google Account";
      try {
        const uRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (uRes.ok) {
          const uData = await uRes.json();
          if (uData.email) userEmail = uData.email;
        }
      } catch (e) {
        console.warn("Could not fetch Google profile", e);
      }

      let createdId = cfg.sheet_id || "";
      let createdUrl = cfg.sheet_url || "";

      // If no sheet yet, automatically create one in user's Google Drive
      if (!createdId) {
        try {
          const sRes = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              properties: { title: "Jobib — Requirements Pipeline" },
            }),
          });
          if (sRes.ok) {
            const sJson = await sRes.json();
            createdId = sJson.spreadsheetId;
            createdUrl = `https://docs.google.com/spreadsheets/d/${createdId}/edit`;
            setSheetUrl(createdUrl);
          }
        } catch (sErr) {
          console.warn("Auto sheet creation error", sErr);
        }
      }

      // Upsert both Google Sheets and Gmail configurations together
      await Promise.all([
        upsert.mutateAsync({
          integration_type: "google_sheets",
          enabled: true,
          config: {
            ...cfg,
            access_token: token,
            email: userEmail,
            sheet_id: createdId,
            sheet_url: createdUrl,
            auto_new: true,
            auto_status: true,
          },
        }),
        upsert.mutateAsync({
          integration_type: "gmail",
          enabled: true,
          config: {
            access_token: token,
            email: userEmail,
            connected_at: new Date().toISOString(),
          },
        }),
      ]);

      toast.success(`Connected as ${userEmail}!`, { id: toastId });
    } catch (err: any) {
      toast.error(err.message || "Failed to finalize connection", { id: toastId });
    }
  }

  function handleConnectGoogleOAuth() {
    startGoogleOAuth(false);
  }

  async function handleDisconnectOAuth() {
    try {
      await Promise.all([
        upsert.mutateAsync({
          integration_type: "google_sheets",
          enabled: false,
          config: {
            ...cfg,
            access_token: null,
            email: null,
          },
        }),
        upsert.mutateAsync({
          integration_type: "gmail",
          enabled: false,
          config: {
            access_token: null,
            email: null,
          },
        }),
      ]);
      toast.success("Google account disconnected");
    } catch (e: any) {
      toast.error(e.message || "Failed to disconnect");
    }
  }

  const isOAuthConnected = Boolean(cfg.access_token || cfg.email);
  const isWebhookConnected = Boolean(webhookUrl.trim());
  const isConnected = isOAuthConnected || isWebhookConnected || Boolean(sheetUrl.trim());

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
      // 1. If Google OAuth token exists and sheet ID exists, push directly via official Google Sheets API v4
      if (cfg.access_token && cfg.sheet_id) {
        const rows = requirements.map((r: any) => [
          r.title,
          r.client_masked || r.vendor_name || "Direct Client",
          (r.tech_stack ?? []).join(", "),
          [r.location_city, r.location_state].filter(Boolean).join(", "),
          r.rate_max ? `$${r.rate_min ? `${r.rate_min}-$` : ""}${r.rate_max}/hr` : "",
          r.req_score,
          r.source_type,
          r.status,
          r.posted_date,
          [r.am_name, r.am_phone, r.am_email].filter(Boolean).join(" / "),
        ]);

        const appendRes = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${cfg.sheet_id}/values/Sheet1!A1:append?valueInputOption=USER_ENTERED`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${cfg.access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ values: rows }),
          }
        );

        if (!appendRes.ok) {
          throw new Error("Could not append rows to Google Sheet via API");
        }

        await runSync.mutateAsync();
        toast.success(`Pushed ${rows.length} requirements directly to your Google Sheet!`);
      } else if (webhookUrl.trim()) {
        // 2. Push via Google Apps Script Webhook
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
          {/* Method 1: Official 1-Click Google OAuth */}
          <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                1-Click Google Account (SaaS Ready)
              </span>
              {isOAuthConnected && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                  <CheckCircle2 className="h-3 w-3" /> Live
                </span>
              )}
            </div>

            {isOAuthConnected ? (
              <div className="flex items-center justify-between rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs">
                <div>
                  <div className="font-semibold text-foreground">Connected with Google</div>
                  <div className="text-muted-foreground">{cfg.email || "Google Account Connected"}</div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-muted-foreground hover:text-destructive"
                  onClick={handleDisconnectOAuth}
                >
                  Disconnect
                </Button>
              </div>
            ) : (
              <Button
                className="w-full flex items-center justify-center gap-2"
                onClick={handleConnectGoogleOAuth}
              >
                <FileSpreadsheet className="h-4 w-4" /> Connect Google Account (1-Click OAuth)
              </Button>
            )}
          </div>

          {/* Method 2: Google Sheet Link & Manual Webhook */}
          <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Sheet Link & Webhook Option
              </span>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 text-[11px] text-primary hover:text-primary">
                    <HelpCircle className="mr-1 h-3 w-3" /> 1-Min Script Guide
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-xl">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <FileSpreadsheet className="h-5 w-5 text-emerald-500" />
                      How to Connect Any Google Sheet in 1 Minute
                    </DialogTitle>
                    <DialogDescription>
                      Works with any Google Sheet without needing Google Cloud setup.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-3 py-2 text-xs">
                    <ol className="list-decimal space-y-2 pl-4 text-foreground">
                      <li>Open your Google Sheet (or create a new blank Google Sheet).</li>
                      <li>In the menu bar, click <strong>Extensions ➔ Apps Script</strong>.</li>
                      <li>Replace all code with the script below and click <strong>Save (Ctrl+S)</strong>.</li>
                      <li>Click the blue <strong>Deploy ➔ New deployment</strong> button (top right).</li>
                      <li>Select type: <strong>Web app</strong>. Under <em>"Who has access"</em>, choose <strong>"Anyone"</strong>.</li>
                      <li>Click <strong>Deploy</strong>, copy the <strong>Web app URL</strong>, and paste it into the Webhook URL field!</li>
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

            {/* Webhook Sync URL */}
            <div>
              <Label className="text-xs font-medium">Google Apps Script Webhook URL (Optional)</Label>
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
                disabled={isPushing || (!isConnected)}
                className="flex-1"
              >
                {isPushing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1.5 h-3.5 w-3.5 text-primary" />}
                Push Reqs to Sheet Now
              </Button>
            </div>
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
  const sheetsConfig = configs.find((c: any) => c.integration_type === "google_sheets");
  const gmailConfig = configs.find((c: any) => c.integration_type === "gmail");
  const upsert = useUpsertIntegrationConfig();

  const userEmail = (gmailConfig?.config as any)?.email || (sheetsConfig?.config as any)?.email;
  const isConnected = Boolean(
    (gmailConfig?.enabled && ((gmailConfig?.config as any)?.email || (gmailConfig?.config as any)?.access_token)) ||
    (sheetsConfig?.enabled && (sheetsConfig?.config as any)?.email)
  );

  const runParse = useRunGmailParse();
  const [previews, setPreviews] = useState<any[]>([]);
  const [filterRule, setFilterRule] = useState("is:unread from:(jobs OR requirements)");
  const vendors = ["TCS", "Infosys", "Cognizant", "Collabera", "Wipro"];

  async function handleDisconnect() {
    try {
      await upsert.mutateAsync({
        integration_type: "gmail",
        enabled: false,
        config: { access_token: null, email: null },
      });
      toast.success("Gmail integration disconnected");
    } catch (e: any) {
      toast.error(e.message || "Failed to disconnect");
    }
  }

  async function handleRun() {
    try {
      const result = await runParse.mutateAsync();
      setPreviews(result.previews ?? []);
      toast.success(`Scanned ${result.scanned} emails, extracted ${result.extracted} requirements`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gmail scan failed");
    }
  }

  return (
    <IntegrationCardShell
      Icon={Mail}
      title="Gmail parser"
      subtitle="Read-only Gmail access. AI extracts requirements from emails."
      connected={isConnected}
      status={isConnected ? "ok" : "unknown"}
      onRun={handleRun}
      running={runParse.isPending}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          {isConnected ? (
            <div className="flex items-center justify-between rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs">
              <div>
                <div className="font-semibold text-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  Connected with Google
                </div>
                <div className="text-muted-foreground">{userEmail || "Google Account Connected"}</div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-destructive hover:bg-destructive/10"
                onClick={handleDisconnect}
              >
                Disconnect
              </Button>
            </div>
          ) : (
            <Button
              className="w-full"
              onClick={() => startGoogleOAuth(true)}
            >
              <Mail className="mr-2 h-4 w-4" />
              Connect Gmail (1-Click Google OAuth)
            </Button>
          )}

          <div>
            <Label className="text-xs font-medium">Filter rule</Label>
            <Input
              value={filterRule}
              onChange={(e) => setFilterRule(e.target.value)}
              placeholder="is:unread from:(jobs OR requirements)"
              className="text-xs mt-1"
            />
          </div>
          <div>
            <Label className="text-xs font-medium">Common vendor domains</Label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {vendors.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => {
                    const rule = ` OR from:${v.toLowerCase()}.com`;
                    if (!filterRule.includes(v.toLowerCase())) {
                      setFilterRule((prev) => `${prev}${rule}`);
                    }
                  }}
                  className="rounded bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary hover:bg-primary/25 transition-colors cursor-pointer"
                  title={`Add ${v} to filter rule`}
                >
                  +{v}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Click any vendor tag to add to the inbox search filter. AI scans incoming emails and extracts client, tech stack, and pay rate.
            </p>
          </div>
        </div>

        <div>
          <div className="text-sm font-medium flex items-center justify-between">
            <span>Last run — extracted requirements</span>
            {isConnected && <span className="text-[11px] text-emerald-600 font-medium">● Connected & Ready</span>}
          </div>
          {previews.length === 0 ? (
            <div className="mt-2 rounded-md border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
              <Mail className="mx-auto mb-2 h-6 w-6 opacity-40" />
              <p>Click "Run now" to scan your inbox.</p>
            </div>
          ) : (
            <ul className="mt-2 space-y-2">
              {previews.map((p, i) => (
                <li key={i} className="rounded-md border border-border p-3 text-xs space-y-1">
                  <div className="font-medium text-foreground">{p.subject}</div>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>From {p.from}</span>
                    <span className="text-emerald-600 font-medium">✓ Extracted to Pipeline</span>
                  </div>
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
