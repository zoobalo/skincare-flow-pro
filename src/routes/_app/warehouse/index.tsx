import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KpiCard } from "@/components/kpi-card";
import { ArrowDownToLine, ArrowUpFromLine, Boxes, AlertTriangle } from "lucide-react";
import { api } from "@/lib/api";

export const Route = createFileRoute("/_app/warehouse/")({
  loader: async () => {
    const [shipments, batches] = await Promise.all([
      api.shipments.list(),
      api.production.list(),
    ]);
    const inward  = shipments.filter((s) => s.status === "Delivered").length;
    const outward = shipments.filter((s) => s.status === "In Transit" || s.status === "Loading").length;
    return { inward, outward, activeBatches: batches.length };
  },
  component: WarehousePage,
  head: () => ({ meta: [{ title: "Warehouse — Zoobalo" }] }),
});

const TAB_LABELS: Record<string, string> = {
  inward: "Inward", outward: "Outward", dispatch: "Dispatch",
  damage: "Damage", returns: "Returns", batch: "Batch Tracking",
};

function WarehousePage() {
  const { inward, outward, activeBatches } = Route.useLoaderData();
  return (
    <div className="space-y-6">
      <PageHeader title="Warehouse" description="Inward, outward, dispatch, damage and returns" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total Inward"         value={inward}         icon={ArrowDownToLine} tone="success" />
        <KpiCard label="In Transit / Loading" value={outward}        icon={ArrowUpFromLine} tone="info" />
        <KpiCard label="Damaged Stock"        value="—"              icon={AlertTriangle}   tone="warning" />
        <KpiCard label="Active Batches"       value={activeBatches}  icon={Boxes} />
      </div>
      <Tabs defaultValue="inward">
        <TabsList>
          {Object.entries(TAB_LABELS).map(([k, label]) => (
            <TabsTrigger key={k} value={k}>{label}</TabsTrigger>
          ))}
        </TabsList>
        {Object.keys(TAB_LABELS).map((k) => (
          <TabsContent key={k} value={k} className="mt-4">
            <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">
              No {TAB_LABELS[k].toLowerCase()} entries yet.
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
