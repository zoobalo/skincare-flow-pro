import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

export function KpiCard({
  label, value, icon: Icon, delta, hint, tone = "default", className,
}: {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  delta?: number;
  hint?: string;
  tone?: "default" | "warning" | "danger" | "success" | "info";
  className?: string;
}) {
  const toneRing: Record<string, string> = {
    default: "bg-primary/10 text-primary",
    warning: "bg-warning/15 text-warning-foreground",
    danger: "bg-destructive/15 text-destructive",
    success: "bg-success/15 text-success",
    info: "bg-info/15 text-info",
  };
  const positive = (delta ?? 0) >= 0;
  return (
    <div className={cn("group relative rounded-xl border bg-card p-5 transition-all hover:shadow-sm", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        {Icon && (
          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", toneRing[tone])}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
      {typeof delta === "number" && (
        <div className="mt-3 flex items-center gap-1 text-xs">
          {positive ? <ArrowUpRight className="h-3.5 w-3.5 text-success" /> : <ArrowDownRight className="h-3.5 w-3.5 text-destructive" />}
          <span className={positive ? "text-success" : "text-destructive"}>{Math.abs(delta)}%</span>
          <span className="text-muted-foreground">vs last month</span>
        </div>
      )}
    </div>
  );
}
