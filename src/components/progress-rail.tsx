import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function ProgressRail<T extends string>({
  stages, current, delayed,
}: { stages: readonly T[]; current: T; delayed?: boolean }) {
  const idx = stages.indexOf(current);
  return (
    <ol className="relative grid gap-0" style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))` }}>
      {stages.map((s, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <li key={s} className="relative flex flex-col items-center text-center">
            {i > 0 && (
              <span
                aria-hidden
                className={cn("absolute left-0 right-1/2 top-3 -translate-y-1/2 h-0.5", done || active ? "bg-primary" : "bg-border")}
              />
            )}
            {i < stages.length - 1 && (
              <span
                aria-hidden
                className={cn("absolute left-1/2 right-0 top-3 -translate-y-1/2 h-0.5", done ? "bg-primary" : "bg-border")}
              />
            )}
            <span
              className={cn(
                "relative z-10 flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold",
                done && "border-primary bg-primary text-primary-foreground",
                active && (delayed ? "border-destructive bg-destructive text-destructive-foreground" : "border-primary bg-card text-primary"),
                !done && !active && "border-border bg-card text-muted-foreground"
              )}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span className={cn("mt-2 line-clamp-2 text-[10px] font-medium leading-tight", active ? "text-foreground" : "text-muted-foreground")}>
              {s}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
