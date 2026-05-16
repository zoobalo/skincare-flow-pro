import { cn } from "@/lib/utils";

export function ChartCard({
  title, description, children, className, actions,
}: { title: string; description?: string; children: React.ReactNode; className?: string; actions?: React.ReactNode }) {
  return (
    <div className={cn("rounded-xl border bg-card p-5", className)}>
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </div>
  );
}
