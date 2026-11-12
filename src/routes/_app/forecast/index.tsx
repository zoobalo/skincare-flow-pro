import { createFileRoute, useRouter } from "@tanstack/react-router";
import { PageSkeleton } from "@/components/page-skeleton";
import { PageHeader } from "@/components/page-header";
import { forecastSheetApi, type ApiForecastRow, type ApiForecastMeta } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, Loader2, Search, TrendingDown } from "lucide-react";
import { memo, useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/forecast/")({
  loader: async () => {
    if (typeof window === "undefined") return null;
    return forecastSheetApi.get();
  },
  pendingComponent: PageSkeleton,
  component: ForecastPage,
  head: () => ({ meta: [{ title: "Inventory Forecast — Zoobalo" }] }),
});

/** The sheet's own vocabulary, in the order it escalates. */
const STATUSES = ["CRITICAL", "PRODUCE NOW", "PLAN PRODUCTION", "SUFFICIENT", "NO SALES DATA"] as const;

const STATUS_COLOUR: Record<string, string> = {
  "CRITICAL":        "text-red-600 dark:text-red-400",
  "PRODUCE NOW":     "text-orange-600 dark:text-orange-400",
  "PLAN PRODUCTION": "text-amber-600 dark:text-amber-400",
  "SUFFICIENT":      "text-green-700 dark:text-green-400",
  "NO SALES DATA":   "text-muted-foreground",
};

const n = (v: string | null) =>
  v === null || v === "" ? "—" : Number(v).toLocaleString("en-IN");
const dec = (v: string | null) =>
  v === null || v === "" ? "—" : Number(v).toLocaleString("en-IN", { maximumFractionDigits: 1 });

function ForecastPage() {
  const data = Route.useLoaderData();
  if (!data) return <PageSkeleton />;
  return <ForecastContent rows={data.rows} meta={data.meta} />;
}

function ForecastContent({ rows, meta }: { rows: ApiForecastRow[]; meta: ApiForecastMeta | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("__all__");

  const update = async () => {
    setBusy(true);
    const note = toast.loading("Reading the spreadsheet…");
    try {
      const r = await forecastSheetApi.import();
      toast.success(`Updated — ${r.rows} SKUs as of ${r.reportDate || "the latest report"}.`, { id: note });
      await router.invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not read the spreadsheet.", { id: note });
    } finally { setBusy(false); }
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of rows) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [rows]);

  const needle = q.trim().toLowerCase();
  const visible = useMemo(() => rows.filter((r) => {
    if (status !== "__all__" && r.status !== status) return false;
    return !needle || r.skuName.toLowerCase().includes(needle);
  }), [rows, status, needle]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory Forecast"
        description={
          meta
            ? `Report ${meta.reportDate} · ${meta.currentWeek} · lead time ${meta.leadTimeDays ?? "—"} days · ` +
              `produce below ${meta.triggerAtDays ?? "—"} days of stock`
            : "Not imported yet — press Update Data to read the spreadsheet."
        }
        actions={
          <Button onClick={update} disabled={busy}>
            {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  : <RefreshCw className="mr-1.5 h-4 w-4" />}
            {busy ? "Updating…" : "Update Data"}
          </Button>
        }
      />

      {meta && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(status === s ? "__all__" : s)}
              className={`rounded-xl border bg-card p-3 text-left transition-colors hover:bg-muted/40 ${
                status === s ? "ring-2 ring-primary" : ""
              }`}
            >
              <p className={`text-2xl font-semibold tabular-nums ${STATUS_COLOUR[s]}`}>
                {counts[s] ?? 0}
              </p>
              <p className="mt-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">{s}</p>
            </button>
          ))}
          <div className="rounded-xl border bg-card p-3">
            <p className="text-2xl font-semibold tabular-nums">{n(meta.totalToProduce)}</p>
            <p className="mt-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">
              Units to produce
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input className="h-8 w-60 pl-8 text-xs" placeholder="SKU name…"
            value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-8 w-48 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All statuses</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        {(q || status !== "__all__") && (
          <Button size="sm" variant="ghost" className="h-8 text-xs"
            onClick={() => { setQ(""); setStatus("__all__"); }}>Clear</Button>
        )}
        {meta && (
          <span className="ml-auto text-xs text-muted-foreground">
            Last updated {new Date(meta.importedAt).toLocaleString("en-IN", {
              day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
            {meta.importedByName ? ` by ${meta.importedByName}` : ""}
          </span>
        )}
      </div>

      {!rows.length ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border bg-card p-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <TrendingDown className="h-7 w-7" />
          </div>
          <div>
            <p className="font-semibold">Nothing imported yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Fill the forecast spreadsheet, then press Update Data to bring it in.
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-[1900px] text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-2 py-2 text-right font-medium">#</th>
                <th className="px-3 py-2 text-left font-medium">SKU Name</th>
                <th className="px-2 py-2 text-right font-medium">D2C</th>
                <th className="px-2 py-2 text-right font-medium">Amazon</th>
                <th className="px-2 py-2 text-right font-medium">Nykaa</th>
                <th className="px-2 py-2 text-right font-medium">Blinkit</th>
                <th className="px-2 py-2 text-right font-medium">Zepto</th>
                <th className="px-3 py-2 text-right font-medium">Warehouse Inventory</th>
                <th className="px-3 py-2 text-right font-medium">Open / In-Transit</th>
                <th className="px-2 py-2 text-right font-medium">Week 1</th>
                <th className="px-2 py-2 text-right font-medium">Week 2</th>
                <th className="px-2 py-2 text-right font-medium">Week 3</th>
                <th className="px-2 py-2 text-right font-medium">Week 4</th>
                <th className="px-3 py-2 text-right font-medium">Avg Weekly</th>
                <th className="px-3 py-2 text-right font-medium">Monthly Rate</th>
                <th className="px-3 py-2 text-right font-medium">Daily Rate</th>
                <th className="px-3 py-2 text-right font-medium">Sufficiency Days</th>
                <th className="px-3 py-2 text-right font-medium">Needed for Lead Time</th>
                <th className="px-3 py-2 text-left font-medium">Stock-Out</th>
                <th className="px-3 py-2 text-left font-medium">Trigger Date</th>
                <th className="min-w-[140px] px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-right font-medium">Suggested Qty</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {visible.map((r) => <Row key={r.id} r={r} />)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const Row = memo(function Row({ r }: { r: ApiForecastRow }) {
  return (
    <tr>
      <td className="px-2 py-2 text-right text-xs text-muted-foreground tabular-nums">{r.position}</td>
      <td className="px-3 py-2 font-medium">{r.skuName}</td>
      <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{n(r.saleD2c)}</td>
      <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{n(r.saleAmazon)}</td>
      <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{n(r.saleNykaa)}</td>
      <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{n(r.saleBlinkit)}</td>
      <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{n(r.saleZepto)}</td>
      <td className="px-3 py-2 text-right tabular-nums">{n(r.currentInventory)}</td>
      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{n(r.openProduction)}</td>
      <td className="px-2 py-2 text-right tabular-nums">{n(r.week1)}</td>
      <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{n(r.week2)}</td>
      <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{n(r.week3)}</td>
      <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{n(r.week4)}</td>
      <td className="px-3 py-2 text-right tabular-nums">{n(r.avgWeeklySale)}</td>
      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{n(r.monthlySaleRate)}</td>
      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{dec(r.dailySaleRate)}</td>
      <td className="px-3 py-2 text-right tabular-nums font-medium">{dec(r.stockSufficiencyDays)}</td>
      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{n(r.stockNeededLeadTime)}</td>
      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{r.stockOutDate || "—"}</td>
      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{r.productionTriggerDate || "—"}</td>
      <td className={`px-3 py-2 whitespace-nowrap text-xs font-semibold ${STATUS_COLOUR[r.status] ?? ""}`}>
        {r.status || "—"}
      </td>
      <td className="px-3 py-2 text-right tabular-nums font-medium">{n(r.suggestedProductionQty)}</td>
    </tr>
  );
});
