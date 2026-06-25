import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useRequirements, useSubmissions } from "@/lib/api";
import {
  computeChannelPerformance, computeDailySubmissions, computeFunnel, computeKpis, computeScoreOverTime, computeSourceBreakdown,
} from "@/lib/analytics";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — Jobib" },
      { name: "description", content: "KPIs, channel performance, and pipeline funnel." },
    ],
  }),
  component: AnalyticsPage,
});

const PIE_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"];

function AnalyticsPage() {
  const { data: requirements = [], isLoading: loadingReqs } = useRequirements();
  const { data: submissions = [], isLoading: loadingSubs } = useSubmissions();
  const loading = loadingReqs || loadingSubs;

  const kpis = computeKpis(requirements as any, submissions as any);
  const dailySubmissions = computeDailySubmissions(submissions as any);
  const sourceBreakdown = computeSourceBreakdown(requirements as any);
  const scoreOverTime = computeScoreOverTime(requirements as any);
  const channelPerformance = computeChannelPerformance(requirements as any, submissions as any);
  const funnelData = computeFunnel(requirements as any, submissions as any);

  const hasData = requirements.length > 0;

  return (
    <div>
      <PageHeader title="Analytics" subtitle="Operating dashboard across pipeline, channels, and conversion." />
      <div className="space-y-6 p-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {kpis.map((k) => (
            <div key={k.label} className="rounded-xl border border-border bg-surface p-5">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{k.label}</div>
              <div className="mt-2 text-3xl font-semibold tabular-nums">{loading ? "—" : k.value}</div>
              <div className="mt-1 text-xs text-muted-foreground">{k.sub}</div>
            </div>
          ))}
        </div>

        {!loading && !hasData ? (
          <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center text-sm text-muted-foreground">
            No requirements yet — charts will populate once you add requirements or connect an integration.
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <ChartCard title="Daily submissions vs target" subtitle="Last 14 days">
              <BarChart data={dailySubmissions}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="submissions" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="target" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartCard>

            <ChartCard title="Requirement sources" subtitle="Where reqs come from">
              <PieChart>
                <Pie data={sourceBreakdown} dataKey="value" nameKey="name" outerRadius={90} label>
                  {sourceBreakdown.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ChartCard>

            <ChartCard title="Req-Score over time" subtitle="Daily average">
              <LineChart data={scoreOverTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} domain={[0, 100]} />
                <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 }} />
                <Line type="monotone" dataKey="score" stroke="var(--chart-1)" strokeWidth={2} dot={false} connectNulls />
              </LineChart>
            </ChartCard>

            <ChartCard title="Channel performance" subtitle="Reqs vs submissions vs closures">
              <BarChart data={channelPerformance}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="channel" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="reqs" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="submissions" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="closures" fill="var(--chart-5)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartCard>
          </div>
        )}

        {hasData && (
          <div className="rounded-xl border border-border bg-surface p-5">
            <div className="mb-4">
              <h3 className="text-sm font-semibold">Pipeline funnel</h3>
              <p className="text-xs text-muted-foreground">From raw requirements to placements.</p>
            </div>
            <div className="space-y-2">
              {funnelData.map((f, i) => {
                const max = funnelData[0].value || 1;
                const pct = Math.round((f.value / max) * 100);
                return (
                  <div key={f.stage} className="flex items-center gap-3">
                    <div className="w-32 text-sm font-medium">{f.stage}</div>
                    <div className="flex-1 overflow-hidden rounded-md bg-muted">
                      <div className="h-8 rounded-md bg-primary/80 transition-all" style={{ width: `${pct}%`, opacity: 1 - i * 0.15 }} />
                    </div>
                    <div className="w-20 text-right text-sm tabular-nums">{f.value} <span className="text-xs text-muted-foreground">({pct}%)</span></div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactElement }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      <div style={{ width: "100%", height: 240 }}>
        <ResponsiveContainer>{children}</ResponsiveContainer>
      </div>
    </div>
  );
}
