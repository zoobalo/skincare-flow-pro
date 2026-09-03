import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { api, type ApiForecast, type ApiForecastRow } from "@/lib/api";
import {
  Search, TrendingDown, Download, Upload, AlertTriangle, PackageX, Clock, CheckCircle2, HelpCircle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/forecast/")({
  loader: async () => {
    if (typeof window === "undefined") return null;
    const sharedTeamId = new URLSearchParams(window.location.search).get("sharedTeamId") ?? undefined;
    return { data: await api.forecast.get(sharedTeamId), sharedTeamId };
  },
  pendingComponent: PageSkeleton,
  component: ForecastPage,
  head: () => ({ meta: [{ title: "Inventory Forecast — Zoobalo" }] }),
});

function ForecastPage() {
  const d = Route.useLoaderData();
  if (!d) return <PageSkeleton />;
  return <ForecastContent data={d.data} sharedTeamId={d.sharedTeamId} />;
}

const STATUS: Record<ApiForecastRow["status"], {
  label: string; cls: string; icon: React.ComponentType<{ className?: string }>;
}> = {
  critical:        { label: "Start production now", cls: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-900", icon: AlertTriangle },
  "no-stock":      { label: "Out of stock",         cls: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-900", icon: PackageX },
  warning:         { label: "Below threshold",      cls: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900", icon: Clock },
  ok:              { label: "Sufficient",           cls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900", icon: CheckCircle2 },
  "no-sales-data": { label: "No sales data",        cls: "bg-muted text-muted-foreground border-transparent", icon: HelpCircle },
};

const fmtNum = (n: number | null) => (n === null ? "—" : Math.round(n).toLocaleString("en-IN"));
const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

function ForecastContent({ data, sharedTeamId }: { data: ApiForecast; sharedTeamId?: string }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [week, setWeek] = useState(data.currentWeekEnding);
  const [busy, setBusy] = useState<string | null>(null);

  async function run(key: string, fn: () => Promise<unknown>, describe: (r: any) => string) {
    setBusy(key);
    try {
      const res = await fn();
      toast.success(describe(res));
      const ambiguous = (res as { ambiguous?: string[] })?.ambiguous ?? [];
      if (ambiguous.length) {
        toast.warning(
          `Skipped ${ambiguous.length} code${ambiguous.length === 1 ? "" : "s"} used by more than one SKU: ${ambiguous.join(", ")}. Give each product a unique code in SKU Management, or their numbers will be mixed up.`,
          { duration: 14000 },
        );
      }
      const skipped = (res as { skipped?: string[] })?.skipped ?? [];
      if (skipped.length) {
        toast.warning(
          `${skipped.length} row${skipped.length === 1 ? "" : "s"} skipped — no matching SKU code: ${skipped.slice(0, 6).join(", ")}${skipped.length > 6 ? "…" : ""}`,
          { duration: 10000 },
        );
      }
      router.invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed.");
    } finally {
      setBusy(null);
    }
  }

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q
      ? data.rows.filter((r) => r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q))
      : data.rows;
  }, [data.rows, search]);

  const counts = useMemo(() => {
    const c = { critical: 0, "no-stock": 0, warning: 0, ok: 0, "no-sales-data": 0 };
    for (const r of data.rows) c[r.status]++;
    return c;
  }, [data.rows]);

  const lastImport = data.rows.find((r) => r.lastImportedAt)?.lastImportedAt ?? null;
  const staleDays = lastImport
    ? Math.floor((Date.now() - new Date(lastImport).getTime()) / 86400000)
    : null;

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Inventory Forecast"
        description="How long current stock lasts at recent sales velocity, and when production must start."
      />

      {/* Sheet controls */}
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm font-semibold">Weekly sales sheet</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Send the SKU list across, then pull the numbers back in. Import any
            day — sales are measured over the days since your last import.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              Data up to
              <Input
                type="date"
                value={week}
                onChange={(e) => setWeek(e.target.value)}
                className="h-8 w-36 text-xs"
              />
            </label>
            <Button
              size="sm" variant="outline" className="h-8"
              disabled={busy !== null}
              onClick={() => run("st", () => api.forecast.salesTemplate(week, sharedTeamId),
                (r) => `Template sent — ${r.skus} SKUs, ${r.platforms} platforms.`)}
            >
              <Upload className="mr-1.5 h-3.5 w-3.5" />
              {busy === "st" ? "Sending…" : "Sync template"}
            </Button>
            <Button
              size="sm" className="h-8"
              disabled={busy !== null}
              onClick={() => run("si", () => api.forecast.salesImport(week, sharedTeamId),
                (r) => `Imported sales for ${r.updated} SKUs.`)}
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              {busy === "si" ? "Importing…" : "IN"}
            </Button>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm font-semibold">Current inventory sheet</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Same flow — template out, quantities in.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              size="sm" variant="outline" className="h-8"
              disabled={busy !== null}
              onClick={() => run("kt", () => api.forecast.stockTemplate(sharedTeamId),
                (r) => `Template sent — ${r.skus} SKUs, ${r.locations} locations.`)}
            >
              <Upload className="mr-1.5 h-3.5 w-3.5" />
              {busy === "kt" ? "Sending…" : "Sync template"}
            </Button>
            <Button
              size="sm" className="h-8"
              disabled={busy !== null}
              onClick={() => run("ki", () => api.forecast.stockImport(sharedTeamId),
                (r) => `Updated stock for ${r.updated} SKUs.`)}
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              {busy === "ki" ? "Importing…" : "IN"}
            </Button>
          </div>
        </div>
      </div>

      {staleDays !== null && staleDays > 10 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Sales data was last imported {staleDays} days ago — the numbers below are likely optimistic.
        </div>
      )}

      {/* Status summary */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(STATUS) as ApiForecastRow["status"][]).map((k) => (
          counts[k] > 0 && (
            <div key={k} className={cn("flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs", STATUS[k].cls)}>
              {(() => { const I = STATUS[k].icon; return <I className="h-3.5 w-3.5" />; })()}
              <span className="font-medium">{counts[k]}</span> {STATUS[k].label}
            </div>
          )
        ))}
      </div>

      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search SKU…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center">
          <TrendingDown className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No SKUs match your search.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">SKU</th>
                <th className="px-3 py-2 text-right font-semibold">In stock</th>
                <th className="px-3 py-2 text-right font-semibold">Weekly sales</th>
                <th className="px-3 py-2 text-right font-semibold">Days of cover</th>
                <th className="px-3 py-2 text-left font-semibold">Stockout</th>
                <th className="px-3 py-2 text-left font-semibold">Start production by</th>
                <th className="px-3 py-2 text-left font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => {
                const S = STATUS[r.status];
                const alarming = r.status === "critical" || r.status === "no-stock";
                return (
                  <tr key={r.skuId} className={cn("hover:bg-muted/30", alarming && "bg-red-50/40 dark:bg-red-950/10")}>
                    <td className="px-3 py-2">
                      <p className="font-medium leading-tight">{r.name}</p>
                      <p className="text-xs text-muted-foreground">{r.code}</p>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.currentInventory.toLocaleString("en-IN")}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {fmtNum(r.weeklyUnits)}
                      {r.weeksOfData > 0 && (
                        <span className="ml-1 text-[11px] text-muted-foreground">
                          ({r.daysCovered}d of data)
                        </span>
                      )}
                    </td>
                    <td className={cn("px-3 py-2 text-right font-semibold tabular-nums", alarming && "text-red-600 dark:text-red-400")}>
                      {r.daysOfCover === null ? "—" : Math.round(r.daysOfCover)}
                    </td>
                    <td className="px-3 py-2 text-xs">{fmtDate(r.stockoutDate)}</td>
                    <td className="px-3 py-2 text-xs">
                      {fmtDate(r.startProductionBy)}
                      <span className="ml-1 text-muted-foreground">({r.leadTimeDays}d lead)</span>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className={cn("gap-1 whitespace-nowrap text-[11px]", S.cls)}>
                        <S.icon className="h-3 w-3" /> {S.label}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Velocity uses the last 4 imports, divided by the days they actually span — so importing every 5 days or
        every 12 gives a true rate either way. A SKU turns red when cover falls below its production lead time
        plus 30 days, amber below {data.rows[0]?.thresholdDays ?? 90} days.
      </p>
    </div>
  );
}
