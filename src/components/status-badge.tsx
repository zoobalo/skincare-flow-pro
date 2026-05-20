import { cn } from "@/lib/utils";

type Status =
  | "Pending" | "Approved" | "In Production" | "Dispatched" | "Delivered" | "Delayed"
  | "In Transit" | "Loading"
  | "Low Stock" | "Healthy" | "Critical"
  | "Active" | "Inactive"
  | string;

const map: Record<string, string> = {
  Pending: "bg-warning/15 text-warning-foreground border-warning/30",
  Approved: "bg-info/15 text-info border-info/30",
  "In Production": "bg-info/15 text-info border-info/30",
  Dispatched: "bg-chart-5/15 text-chart-5 border-chart-5/30",
  Delivered: "bg-success/15 text-success border-success/30",
  Completed: "bg-success/15 text-success border-success/30",
  Delayed: "bg-destructive/15 text-destructive border-destructive/30",
  "In Transit": "bg-info/15 text-info border-info/30",
  Loading: "bg-muted text-muted-foreground border-border",
  "Low Stock": "bg-warning/15 text-warning-foreground border-warning/40",
  Healthy: "bg-success/15 text-success border-success/30",
  Critical: "bg-destructive/15 text-destructive border-destructive/30",
  Active: "bg-success/15 text-success border-success/30",
  Inactive: "bg-muted text-muted-foreground border-border",
};

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  const cls = map[status] ?? "bg-muted text-muted-foreground border-border";
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium tabular-nums", cls, className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {status}
    </span>
  );
}
