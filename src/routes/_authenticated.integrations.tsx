import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dices, FileSpreadsheet, Mail, Plug, RefreshCw, CheckCircle2, XCircle, Clock, ExternalLink, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import {
  useIntegrationConfigs, useUpsertIntegrationConfig, useSyncLogs,
  useStartGoogleOAuth, useCreateSheet, useRunSheetsSync, useRunDiceScrape, useRunGmailParse,
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
  const config = configs.find((c: any) => c.integration_type === "google_sheets");
  const isConnected = Boolean(config?.enabled && (config?.config as any)?.refresh_token);
  const sheetId = (config?.config as any)?.sheet_id;
  const email = (config?.config as any)?.email;

  const startOAuth = useStartGoogleOAuth();
  const createSheet = useCreateSheet();
  const runSync = useRunSheetsSync();
  const upsert = useUpsertIntegrationConfig();

  const [autoNew, setAutoNew] = useState(true);
  const [autoStatus, setAutoStatus] = useState(true);

  const cols = [
    ["Job Title", "A"], ["Client/Vendor", "B"], ["Tech Stack", "C"], ["Location", "D"],
    ["Rate", "E"], ["Source Type", "F"], ["Req-Score", "G"], ["AM Contact", "H"],
    ["Posted Date", "I"], ["Status", "J"], ["Origin Channel", "K"],
  ];

  async function connect() {
    try {
      const url = await startOAuth.mutateAsync();
      window.open(url, "_blank", "width=500,height=650");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to start Google connection");
    }
  }

  async function handleCreateSheet() {
    try {
      const result = await createSheet.mutateAsync();
      toast.success("New sheet created");
      window.open(result.url, "_blank");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create sheet — connect Google first");
    }
  }

  async function handleRun() {
    try {
      const result = await runSync.mutateAsync();
      toast.success(`Synced — ${result.appended} added, ${result.updated} updated`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sync failed");
    }
  }

  return (
    <IntegrationCardShell
      Icon={FileSpreadsheet} title="Google Sheets auto-sync"
      subtitle="Every requirement automatically rolls to your sheet."
      connected={isConnected} status={isConnected ? "ok" : "unknown"} onRun={handleRun} running={runSync.isPending}
    >
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-4">
          {isConnected ? (
            <Button variant="outline" className="w-full justify-between" disabled>
              <span>Connected as {email || "Google account"}</span><CheckCircle2 className="h-4 w-4 text-sync-ok" />
            </Button>
          ) : (
            <Button className="w-full" onClick={connect} disabled={startOAuth.isPending}>
              {startOAuth.isPending ? "Opening Google…" : "Connect Google account"}
            </Button>
          )}
          <div>
            <Label>Sheet</Label>
            <div className="mt-1 flex gap-2">
              <Input value={sheetId ? `https://docs.google.com/spreadsheets/d/${sheetId}` : ""} placeholder="No sheet linked yet" readOnly />
              <Button variant="outline" onClick={handleCreateSheet} disabled={!isConnected || createSheet.isPending}>
                {createSheet.isPending ? "Creating…" : "Create new"}
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <Label htmlFor="autoNew" className="text-sm">Auto-sync on new requirement</Label>
            <Switch
              id="autoNew" checked={autoNew}
              onCheckedChange={(v) => { setAutoNew(v); upsert.mutate({ integration_type: "google_sheets", enabled: isConnected, config: { ...((config?.config ?? {}) as Record<string, unknown>), auto_new: v } }); }}
            />
          </div>
          <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <Label htmlFor="autoStatus" className="text-sm">Auto-sync on status update</Label>
            <Switch
              id="autoStatus" checked={autoStatus}
              onCheckedChange={(v) => { setAutoStatus(v); upsert.mutate({ integration_type: "google_sheets", enabled: isConnected, config: { ...((config?.config ?? {}) as Record<string, unknown>), auto_status: v } }); }}
            />
          </div>
          {!isConnected && (
            <p className="text-xs text-muted-foreground">
              Connect Google first, then create or link a sheet. Auto-sync requires the database trigger from this sprint's migration to be active — see Settings for setup notes.
            </p>
          )}
        </div>
        <div>
          <div className="mb-2 text-sm font-medium">Column mapping</div>
          <div className="overflow-hidden rounded-md border border-border text-sm">
            {cols.map(([field, col]) => (
              <div key={field} className="flex items-center justify-between border-b border-border px-3 py-1.5 last:border-b-0">
                <span>{field}</span>
                <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">Col {col}</span>
              </div>
            ))}
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
