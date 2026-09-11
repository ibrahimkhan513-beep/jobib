import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useMarketRates, useAddMarketRate, useDeleteMarketRate, useRequirements, useSubmissions } from "@/lib/api";
import { Download, KeyRound, Plus, Trash2, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Jobib" },
      { name: "description", content: "API keys, market rates, notifications, and data export." },
    ],
  }),
  component: SettingsPage,
});

function downloadCSV(filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const escapeCell = (val: string | number | null | undefined) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const csvContent = [
    headers.map(escapeCell).join(","),
    ...rows.map((row) => row.map(escapeCell).join(",")),
  ].join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function SettingsPage() {
  const { data: marketRates = [], isLoading } = useMarketRates();
  const { data: requirements = [] } = useRequirements();
  const { data: submissions = [] } = useSubmissions();

  const addRate = useAddMarketRate();
  const deleteRate = useDeleteMarketRate();
  const [newStack, setNewStack] = useState("");
  const [newMin, setNewMin] = useState("");
  const [newMax, setNewMax] = useState("");

  async function addStack() {
    if (!newStack.trim() || !newMin || !newMax) {
      toast.error("Stack, min, and max are all required");
      return;
    }
    try {
      await addRate.mutateAsync({ stack: newStack.trim(), rate_min: Number(newMin), rate_max: Number(newMax) });
      setNewStack("");
      setNewMin("");
      setNewMax("");
      toast.success("Market rate added");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add");
    }
  }

  function handleExportRequirements() {
    if (!requirements.length) {
      toast.error("No requirements available to export");
      return;
    }

    const headers = [
      "Job Title",
      "Client / Vendor",
      "Tech Stack",
      "City",
      "State",
      "Rate Min ($/hr)",
      "Rate Max ($/hr)",
      "Source Type",
      "Origin Channel",
      "Req-Score",
      "Status",
      "Posted Date",
      "AM Name",
      "AM Phone",
      "AM Email",
      "Is Ghost Job",
    ];

    const rows = requirements.map((r: any) => [
      r.title,
      r.client_masked || r.vendor_name || "",
      (r.tech_stack ?? []).join(", "),
      r.location_city || "",
      r.location_state || "",
      r.rate_min ?? "",
      r.rate_max ?? "",
      r.source_type || "",
      r.origin_channel || "",
      r.req_score ?? "",
      r.status || "",
      r.posted_date || "",
      r.am_name || "",
      r.am_phone || "",
      r.am_email || "",
      r.is_ghost ? "Yes" : "No",
    ]);

    const dateStr = new Date().toISOString().slice(0, 10);
    downloadCSV(`jobib-requirements-${dateStr}.csv`, headers, rows);
    toast.success(`Exported ${requirements.length} requirements as CSV!`);
  }

  function handleExportSubmissions() {
    if (!submissions.length) {
      toast.error("No submissions available to export");
      return;
    }

    const headers = [
      "Consultant Name",
      "Requirement Title",
      "Client / Vendor",
      "Submission Date",
      "Status",
      "AM Summary Pitch",
      "AM Feedback / Notes",
    ];

    const rows = submissions.map((s: any) => [
      s.consultant?.full_name || "",
      s.requirement?.title || "",
      s.requirement?.client_masked || s.requirement?.vendor_name || "",
      s.submitted_date || "",
      s.status || "",
      s.am_summary || "",
      s.am_feedback || "",
    ]);

    const dateStr = new Date().toISOString().slice(0, 10);
    downloadCSV(`jobib-submissions-${dateStr}.csv`, headers, rows);
    toast.success(`Exported ${submissions.length} submissions as CSV!`);
  }

  return (
    <div>
      <PageHeader title="Settings" subtitle="Workspace, API keys, market rates, and exports." />
      <div className="grid gap-6 p-6 lg:grid-cols-2">
        <Card title="AI provider (Groq)" desc="Powers JD analysis, resume tailoring, and ghost-job detection.">
          <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            <KeyRound className="mb-1 h-4 w-4" />
            For security, the Groq API key is stored securely in Supabase Secrets. Set it directly on the server with:
            <pre className="mt-2 overflow-x-auto rounded bg-background p-2 text-[11px]">
              supabase secrets set GROQ_API_KEY=your_key
            </pre>
            Optionally also set <code className="text-[11px]">GROQ_MODEL</code> (defaults to llama-3.3-70b-versatile).
          </div>
        </Card>

        <Card title="Google account" desc="Powers Google Sheets auto-sync and Gmail parsing.">
          <div className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
            Google OAuth connection is managed from the Integrations page. Requires Google Cloud Client ID & Secret in Supabase Secrets.
          </div>
          <Button variant="outline" size="sm" className="mt-3" asChild>
            <a href="/integrations">Go to Integrations Hub →</a>
          </Button>
        </Card>

        <Card title="Default market rates" desc="Used for the Req-Score 'rate alignment' criterion." className="lg:col-span-2">
          <div className="overflow-hidden rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Stack</th>
                  <th className="px-3 py-2 text-left font-medium">Min $/hr</th>
                  <th className="px-3 py-2 text-left font-medium">Max $/hr</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-center text-xs text-muted-foreground">
                      Loading…
                    </td>
                  </tr>
                ) : marketRates.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-center text-xs text-muted-foreground">
                      No market rates yet — scoring falls back to a $85/hr blended default until you add stacks below.
                    </td>
                  </tr>
                ) : (
                  marketRates.map((m: any) => (
                    <tr key={m.id} className="border-t border-border">
                      <td className="px-3 py-2 font-medium">{m.stack}</td>
                      <td className="px-3 py-2 tabular-nums">${m.rate_min}</td>
                      <td className="px-3 py-2 tabular-nums">${m.rate_max}</td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => deleteRate.mutate(m.id)}
                          className="text-muted-foreground hover:text-destructive"
                          title="Delete rate"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <div>
              <Label className="text-xs">Stack</Label>
              <Input
                value={newStack}
                onChange={(e) => setNewStack(e.target.value)}
                placeholder="Java"
                className="w-32"
              />
            </div>
            <div>
              <Label className="text-xs">Min $/hr</Label>
              <Input
                type="number"
                value={newMin}
                onChange={(e) => setNewMin(e.target.value)}
                placeholder="65"
                className="w-24"
              />
            </div>
            <div>
              <Label className="text-xs">Max $/hr</Label>
              <Input
                type="number"
                value={newMax}
                onChange={(e) => setNewMax(e.target.value)}
                placeholder="95"
                className="w-24"
              />
            </div>
            <Button variant="outline" size="sm" onClick={addStack} disabled={addRate.isPending}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Add stack
            </Button>
          </div>
        </Card>

        <Card title="Data export" desc="Export your real requirements and submissions pipeline data directly to CSV." className="lg:col-span-2">
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" size="sm" onClick={handleExportRequirements}>
              <Download className="mr-1.5 h-4 w-4" /> Export Requirements CSV ({requirements.length})
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportSubmissions}>
              <Download className="mr-1.5 h-4 w-4" /> Export Submissions CSV ({submissions.length})
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Generates standardized CSV files containing all fields, dates, rates, AM contacts, and notes.
          </p>
        </Card>

        <Card title="Notifications" desc="UI preview — automated email & webhook notifications.">
          <Row label="Alert me when a req scores > 80">
            <Switch disabled />
          </Row>
          <Row label="Email me when a sync fails">
            <Switch disabled />
          </Row>
          <Row label="Daily morning briefing (08:00)">
            <Switch disabled />
          </Row>
        </Card>

        <Card title="Team management" desc="Invite recruiters to your bench sales workspace.">
          <div className="flex gap-2">
            <Input placeholder="teammate@yourcompany.com" disabled />
            <Button disabled>Invite</Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Multi-user workspace invites coming in team edition.</p>
        </Card>
      </div>
    </div>
  );
}

function Card({
  title,
  desc,
  children,
  className = "",
}: {
  title: string;
  desc: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-border bg-surface p-5 ${className}`}>
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
      <div className="mt-4 space-y-1">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
      <span className="text-sm">{label}</span>
      {children}
    </div>
  );
}
