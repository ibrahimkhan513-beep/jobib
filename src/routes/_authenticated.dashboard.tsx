import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { OriginIcon, ScoreBadge, SourceBadge } from "@/components/req-badges";
import { Button } from "@/components/ui/button";
import { useRequirements, useSeedDemoData, useSubmissions, useSyncLogs } from "@/lib/api";
import { toast } from "sonner";
import {
  AlertTriangle, ArrowUpRight, CalendarClock, CheckCircle2, Dices, Mail, FileSpreadsheet, Send, Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Jobib" },
      { name: "description", content: "Daily command center for your bench sales pipeline." },
    ],
  }),
  component: Dashboard,
});

function isToday(dateStr: string | null) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function isThisWeek(dateStr: string | null) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  const diffDays = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= 7;
}

function Dashboard() {
  const { data: requirements = [], isLoading } = useRequirements();
  const { data: submissions = [] } = useSubmissions();
  const { data: syncLogs = [] } = useSyncLogs();
  const seed = useSeedDemoData();
  const top10 = [...requirements].sort((a, b) => b.req_score - a.req_score).slice(0, 10);
  const ghostAlerts = requirements.filter((r) => r.is_ghost);
  const avgScore = requirements.length
    ? Math.round(requirements.reduce((s, r) => s + r.req_score, 0) / requirements.length)
    : 0;

  const submissionsToday = submissions.filter((s: any) => isToday(s.submitted_date)).length;
  const interviewsThisWeek = submissions.filter(
    (s: any) => s.status === "interview_scheduled" && isThisWeek(s.submitted_date),
  ).length;

  const stats = [
    { label: "Active Requirements Today", value: requirements.length, delta: `${requirements.filter((r) => isToday(r.created_at)).length} added today`, Icon: Sparkles },
    { label: "Submissions Today", value: submissionsToday, delta: `${submissions.length} total in pipeline`, Icon: Send },
    { label: "Interviews This Week", value: interviewsThisWeek, delta: `${submissions.filter((s: any) => s.status === "interview_scheduled").length} total scheduled`, Icon: CalendarClock },
    { label: "Avg Req-Score Today", value: avgScore, delta: ">70 = strike zone", Icon: ArrowUpRight },
  ];

  return (
    <div>
      <PageHeader
        title="Daily Command Center"
        subtitle="Triage, score, submit. Beat competitors on speed."
        actions={
          <Button
            size="sm"
            onClick={() =>
              toast.promise(seed.mutateAsync(), {
                loading: "Seeding demo data…",
                success: "Demo data loaded",
                error: (e) => e?.message ?? "Failed to seed",
              })
            }
            disabled={seed.isPending}
          >
            <Sparkles className="mr-1.5 h-4 w-4" />
            {requirements.length === 0 ? "Load demo data" : "Reload demo data"}
          </Button>
        }
      />
      <div className="space-y-6 p-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map(({ label, value, delta, Icon }) => (
            <div key={label} className="rounded-xl border border-border bg-surface p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
                  <div className="mt-2 text-3xl font-semibold tabular-nums">{value}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{delta}</div>
                </div>
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-accent text-accent-foreground">
                  <Icon className="h-4 w-4" />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-5">
          <section className="lg:col-span-3">
            <div className="rounded-xl border border-border bg-surface">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <div>
                  <h2 className="text-base font-semibold">Today's Top 10 Requirements</h2>
                  <p className="text-xs text-muted-foreground">Ranked by Req-Score. Highest first.</p>
                </div>
                <Link to="/requirements"><Button variant="ghost" size="sm">View all</Button></Link>
              </div>
              {isLoading && <p className="px-5 py-8 text-center text-sm text-muted-foreground">Loading…</p>}
              {!isLoading && top10.length === 0 && (
                <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                  No requirements yet. Click <span className="font-medium">Load demo data</span> above, or add a requirement from the Requirements page.
                </p>
              )}
              <ul className="divide-y divide-border">
                {top10.map((r, idx) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">{idx + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-medium">{r.title}</span>
                        <OriginIcon channel={r.origin_channel} />
                        <SourceBadge source={r.source_type} />
                      </div>
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">
                        {r.client_masked} · {r.location_city}, {r.location_state} · ${r.rate_min}–${r.rate_max}/hr
                      </div>
                    </div>
                    <ScoreBadge score={r.req_score} />
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost">View</Button>
                      <Button size="sm" variant="ghost">Tailor</Button>
                      <Button size="sm">Submit</Button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <aside className="space-y-6 lg:col-span-2">
            <div className="rounded-xl border border-border bg-surface">
              <div className="border-b border-border px-5 py-4">
                <h2 className="text-base font-semibold">Daily Workflow Timeline</h2>
                <p className="text-xs text-muted-foreground">Stay on cadence. Hit every block.</p>
              </div>
              <ol className="space-y-3 p-5">
                {[
                  ["08:00 – 09:30", "Triage & scoring (auto)", true],
                  ["09:30 – 11:30", "Strike zone submissions", true],
                  ["11:30 – 01:00", "AM follow-up calls", false],
                  ["02:00 – 04:00", "Relationship building", false],
                  ["04:00 – 05:00", "Pipeline maintenance", false],
                ].map(([time, label, done]) => (
                  <li key={time as string} className="flex items-start gap-3">
                    <CheckCircle2 className={`mt-0.5 h-4 w-4 shrink-0 ${done ? "text-sync-ok" : "text-muted-foreground/40"}`} />
                    <div className="flex-1">
                      <div className="text-sm font-medium">{label}</div>
                      <div className="text-xs text-muted-foreground">{time}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="rounded-xl border border-border bg-surface">
              <div className="border-b border-border px-5 py-4">
                <h2 className="text-base font-semibold">Live Sync Status</h2>
              </div>
              <ul className="divide-y divide-border">
                {(() => {
                  const channels = [
                    { type: "dice", Icon: Dices, label: "Dice scraper" },
                    { type: "gmail", Icon: Mail, label: "Gmail parser" },
                    { type: "google_sheets", Icon: FileSpreadsheet, label: "Google Sheets" },
                  ] as const;
                  return channels.map(({ type, Icon, label }) => {
                    const lastLog = syncLogs.find((l: any) => l.integration_type === type);
                    const ok = lastLog?.status === "success";
                    const detail = lastLog
                      ? `${new Date(lastLog.run_at).toLocaleString()} — ${lastLog.records_added} new`
                      : "Not connected yet — set up in Integrations";
                    return (
                      <li key={type} className="flex items-center gap-3 px-5 py-3">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1">
                          <div className="text-sm font-medium">{label}</div>
                          <div className="text-xs text-muted-foreground">{detail}</div>
                        </div>
                        <span className={`h-2 w-2 rounded-full ${lastLog ? (ok ? "bg-sync-ok" : "bg-sync-fail") : "bg-muted-foreground/30"}`} />
                      </li>
                    );
                  });
                })()}
              </ul>
              <div className="border-t border-border px-5 py-3 text-right">
                <span className="text-xs text-muted-foreground">{syncLogs.length} runs in last 24h</span>
              </div>
            </div>

            <div className="rounded-xl border border-score-low/30 bg-score-low/5 p-5">
              <div className="flex items-center gap-2 text-score-low">
                <AlertTriangle className="h-4 w-4" />
                <h2 className="text-sm font-semibold">Ghost Job Alerts</h2>
              </div>
              {ghostAlerts.length === 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">No suspicious requirements today.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {ghostAlerts.map((r) => (
                    <li key={r.id} className="rounded-md border border-border bg-surface p-3 text-sm">
                      <div className="font-medium">{r.title}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">{r.ghost_reasons.join(" · ")}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}