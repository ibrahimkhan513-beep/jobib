import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useSubmissions } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/submit")({
  head: () => ({
    meta: [
      { title: "Submissions — Jobib" },
      { name: "description", content: "Manage active submissions and craft AM summaries." },
    ],
  }),
  component: SubmissionsPage,
});

function SubmissionsPage() {
  const { data: submissions = [], isLoading } = useSubmissions();
  const pending = submissions.filter((s: any) => s.status === "submitted" || s.status === "in_review");
  const history = submissions;

  const [summary, setSummary] = useState("");
  function generate() {
    setSummary(
      [
        "• 9+ yrs Java / Spring Boot / AWS — led microservices for Tier-1 US bank",
        "• Available immediately, USC, hybrid Dallas — rate $85/hr (within band)",
        "• Strong Kafka + event-driven background; mirrors the JD's core stack",
      ].join("\n"),
    );
    toast.success("AM summary drafted");
  }

  return (
    <div>
      <PageHeader title="Submission Manager" subtitle={`${pending.length} pending · ${history.length} total this month`} />
      <div className="grid gap-6 p-6 lg:grid-cols-3">
        <section className="lg:col-span-2 space-y-4">
          <div className="rounded-xl border border-border bg-surface">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-base font-semibold">Pending submissions</h2>
            </div>
            {!isLoading && pending.length === 0 && (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">No pending submissions. Submit a consultant from the Requirements page.</p>
            )}
            <ul className="divide-y divide-border">
              {pending.map((s: any) => {
                const r = s.requirement ?? {};
                const c = s.consultant ?? {};
                return (
                  <li key={s.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                    <div className="flex-1 min-w-[200px]">
                      <div className="text-sm font-medium">{c.full_name} → {r.title}</div>
                      <div className="text-xs text-muted-foreground">{r.client_masked} · submitted {s.submitted_date}</div>
                    </div>
                    <span className="rounded bg-muted px-2 py-0.5 text-xs">{s.status.replace("_", " ")}</span>
                    <Button size="sm" variant="outline">Follow up</Button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="rounded-xl border border-border bg-surface">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-base font-semibold">Submission history</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Consultant</th>
                    <th className="px-4 py-2 text-left font-medium">Requirement</th>
                    <th className="px-4 py-2 text-left font-medium">Submitted</th>
                    <th className="px-4 py-2 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((s: any) => {
                    const r = s.requirement ?? {};
                    const c = s.consultant ?? {};
                    return (
                      <tr key={s.id} className="border-t border-border">
                        <td className="px-4 py-2">{c.full_name}</td>
                        <td className="px-4 py-2 text-muted-foreground">{r.title}</td>
                        <td className="px-4 py-2 text-muted-foreground">{s.submitted_date}</td>
                        <td className="px-4 py-2"><span className="rounded bg-muted px-2 py-0.5 text-xs">{s.status.replace("_", " ")}</span></td>
                      </tr>
                    );
                  })}
                  {!isLoading && history.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-12 text-center text-sm text-muted-foreground">No submissions yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <aside>
          <div className="rounded-xl border border-border bg-surface p-5">
            <h2 className="text-base font-semibold">3-Bullet AM Summary</h2>
            <p className="mt-1 text-xs text-muted-foreground">Generate a tight pitch from the active requirement + consultant.</p>
            <Button onClick={generate} className="mt-4 w-full"><Sparkles className="mr-1.5 h-4 w-4" />Generate with AI</Button>
            <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={8} placeholder="Bullets appear here…" className="mt-3" />
          </div>
        </aside>
      </div>
    </div>
  );
}