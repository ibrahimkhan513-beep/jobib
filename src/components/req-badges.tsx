import type { OriginChannel, ReqStatus, SourceType, SyncStatus } from "@/lib/mock-data";
import { Mail, PencilLine, Dices, Check, Clock, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function ScoreBadge({ score, className }: { score: number; className?: string }) {
  const tone =
    score > 70 ? "bg-score-high text-score-high-foreground" :
    score >= 50 ? "bg-score-mid text-score-mid-foreground" :
    "bg-score-low text-score-low-foreground";
  return (
    <span className={`inline-flex items-center justify-center rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums ${tone} ${className ?? ""}`}>
      {score}
    </span>
  );
}

export function OriginIcon({ channel, withLabel = false }: { channel: OriginChannel; withLabel?: boolean }) {
  const map = {
    dice: { Icon: Dices, label: "Dice", color: "text-chart-1" },
    gmail: { Icon: Mail, label: "Gmail", color: "text-chart-4" },
    manual: { Icon: PencilLine, label: "Manual", color: "text-muted-foreground" },
    sheets: { Icon: PencilLine, label: "Sheets", color: "text-chart-2" },
  } as const;
  const { Icon, label, color } = map[channel];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <Icon className={cn("h-3.5 w-3.5", color)} />
      {withLabel && <span className="text-muted-foreground">{label}</span>}
    </span>
  );
}

export function SyncStatusBadge({ status }: { status: SyncStatus }) {
  const map = {
    synced: { Icon: Check, label: "Synced", cls: "text-sync-ok" },
    pending: { Icon: Clock, label: "Pending", cls: "text-sync-pending" },
    failed: { Icon: X, label: "Failed", cls: "text-sync-fail" },
  } as const;
  const { Icon, label, cls } = map[status];
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs", cls)}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

export function StatusPill({ status }: { status: ReqStatus }) {
  const map: Record<ReqStatus, string> = {
    new: "bg-accent text-accent-foreground",
    reviewing: "bg-chart-3/15 text-chart-3",
    submitted: "bg-primary/15 text-primary",
    interview: "bg-chart-5/15 text-chart-5",
    closed: "bg-muted text-muted-foreground",
  };
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize", map[status])}>
      {status}
    </span>
  );
}

export function SourceBadge({ source }: { source: SourceType }) {
  const label = source === "tier1" ? "Tier-1" : source === "jobboard" ? "Job Board" : "Direct";
  return (
    <span className="inline-flex rounded border border-border bg-surface px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
      {label}
    </span>
  );
}