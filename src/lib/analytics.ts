// Derives all Analytics-page chart data and KPIs from the real
// `requirements` and `submissions` tables — no mock numbers.
//
// Kept separate from the page component so the aggregation logic is
// testable and so the page itself stays readable.

interface Req {
  id: string;
  created_at: string;
  req_score: number;
  origin_channel: string | null;
  status: string;
}

interface Sub {
  id: string;
  requirement_id: string;
  submitted_date: string | null;
  status: string;
}

function dayKey(iso: string) {
  return new Date(iso).toISOString().slice(0, 10);
}

function lastNDays(n: number) {
  const days: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

export function computeKpis(requirements: Req[], submissions: Sub[]) {
  const requirementsThisWeek = requirements.filter((r) => {
    const days = (Date.now() - new Date(r.created_at).getTime()) / (1000 * 60 * 60 * 24);
    return days <= 7;
  }).length;

  const submissionsTotal = submissions.length;
  const interviews = submissions.filter((s) => s.status === "interview_scheduled" || s.status === "placed").length;
  const placed = submissions.filter((s) => s.status === "placed").length;

  const subToInterviewPct = submissionsTotal ? Math.round((interviews / submissionsTotal) * 100) : 0;
  const closureRatePct = submissionsTotal ? Math.round((placed / submissionsTotal) * 1000) / 10 : 0;

  // Bench age proxy: average age (days) of requirements still open (not closed/placed).
  // This is a requirement-side proxy until a dedicated consultant bench-status timestamp
  // is tracked; it answers "how long has this demand been sitting unworked".
  const openReqs = requirements.filter((r) => r.status !== "closed");
  const avgAgeDays = openReqs.length
    ? Math.round(
        openReqs.reduce((sum, r) => sum + (Date.now() - new Date(r.created_at).getTime()) / (1000 * 60 * 60 * 24), 0) /
          openReqs.length,
      )
    : 0;

  return [
    { label: "Requirements processed", value: requirementsThisWeek, sub: "This week" },
    { label: "Submissions made", value: submissionsTotal, sub: "All time" },
    { label: "Sub → Interview", value: `${subToInterviewPct}%`, sub: "Target 35%" },
    { label: "Closure rate", value: `${closureRatePct}%`, sub: "Placed / submitted" },
    { label: "Avg bench age", value: `${avgAgeDays} days`, sub: avgAgeDays <= 21 ? "Healthy" : "Above target (21d)" },
  ];
}

export function computeDailySubmissions(submissions: Sub[], targetPerDay = 5) {
  const days = lastNDays(14);
  const counts = new Map<string, number>();
  for (const s of submissions) {
    if (!s.submitted_date) continue;
    const key = s.submitted_date.slice(0, 10);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return days.map((d) => ({
    day: new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    submissions: counts.get(d) ?? 0,
    target: targetPerDay,
  }));
}

export function computeSourceBreakdown(requirements: Req[]) {
  const labels: Record<string, string> = { dice: "Dice", gmail: "Gmail", manual: "Manual" };
  const counts = new Map<string, number>();
  for (const r of requirements) {
    const key = r.origin_channel ?? "manual";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].map(([key, value]) => ({ name: labels[key] ?? key, value }));
}

export function computeScoreOverTime(requirements: Req[]) {
  const days = lastNDays(14);
  const byDay = new Map<string, number[]>();
  for (const r of requirements) {
    const key = dayKey(r.created_at);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(r.req_score);
  }
  return days.map((d) => {
    const scores = byDay.get(d) ?? [];
    const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    return { day: new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" }), score: avg };
  });
}

export function computeChannelPerformance(requirements: Req[], submissions: Sub[]) {
  const labels: Record<string, string> = { dice: "Dice", gmail: "Gmail", manual: "Manual" };
  const reqsByChannel = new Map<string, string[]>(); // channel -> req ids
  for (const r of requirements) {
    const key = r.origin_channel ?? "manual";
    if (!reqsByChannel.has(key)) reqsByChannel.set(key, []);
    reqsByChannel.get(key)!.push(r.id);
  }
  const reqIdToChannel = new Map<string, string>();
  for (const [channel, ids] of reqsByChannel) for (const id of ids) reqIdToChannel.set(id, channel);

  const subsByChannel = new Map<string, number>();
  const closuresByChannel = new Map<string, number>();
  for (const s of submissions) {
    const channel = reqIdToChannel.get(s.requirement_id) ?? "manual";
    subsByChannel.set(channel, (subsByChannel.get(channel) ?? 0) + 1);
    if (s.status === "placed") closuresByChannel.set(channel, (closuresByChannel.get(channel) ?? 0) + 1);
  }

  const allChannels = new Set([...reqsByChannel.keys(), ...subsByChannel.keys()]);
  return [...allChannels].map((channel) => ({
    channel: labels[channel] ?? channel,
    reqs: reqsByChannel.get(channel)?.length ?? 0,
    submissions: subsByChannel.get(channel) ?? 0,
    closures: closuresByChannel.get(channel) ?? 0,
  }));
}

export function computeFunnel(requirements: Req[], submissions: Sub[]) {
  const strikeZone = requirements.filter((r) => r.req_score > 70).length;
  const submitted = submissions.length;
  const interviews = submissions.filter((s) => s.status === "interview_scheduled" || s.status === "placed").length;
  const placed = submissions.filter((s) => s.status === "placed").length;
  return [
    { stage: "Requirements", value: requirements.length },
    { stage: "Strike zone (>70)", value: strikeZone },
    { stage: "Submitted", value: submitted },
    { stage: "Interviews", value: interviews },
    { stage: "Placed", value: placed },
  ];
}
