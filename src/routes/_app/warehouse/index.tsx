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
  head: () => ({ meta: [{ title: "Warehouse — SkinOps" }] }),
});

const sampleEntries = (kind: "Inward" | "Outward") =>
  Array.from({ length: 8 }).map((_, i) => ({
    id: `${kind}-${i}`,
    ref: `${kind === "Inward" ? "GRN" : "DC"}-${20260 + i}`,
    date: `2026-04-${10 + i}`,
    item: ["Aluminium Can", "Outer Carton", "Cap", "Sticker", "Insert"][i % 5],
    qty: 5000 + i * 500,
    party: ["Alpha Aluminium", "ColorPack", "CapMakers", "StickIt", "PrintMatrix"][i % 5],
  }));

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
          <TabsTrigger value="inward">Inward</TabsTrigger>
          <TabsTrigger value="outward">Outward</TabsTrigger>
          <TabsTrigger value="dispatch">Dispatch</TabsTrigger>
          <TabsTrigger value="damage">Damage</TabsTrigger>
          <TabsTrigger value="returns">Returns</TabsTrigger>
          <TabsTrigger value="batch">Batch Tracking</TabsTrigger>
        </TabsList>
        {(["inward", "outward", "dispatch", "damage", "returns", "batch"] as const).map((k) => (
          <TabsContent key={k} value={k} className="mt-4">
            <div className="overflow-x-auto rounded-xl border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Reference</th>
                    <th className="px-4 py-2.5 font-medium">Date</th>
                    <th className="px-4 py-2.5 font-medium">Item</th>
                    <th className="px-4 py-2.5 font-medium">Party</th>
                    <th className="px-4 py-2.5 font-medium text-right">Quantity</th>
                  </tr>
                </thead>
                <tbody>
                  {sampleEntries(k === "outward" || k === "dispatch" ? "Outward" : "Inward").map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="px-4 py-2.5 font-medium">{r.ref}</td>
                      <td className="px-4 py-2.5">{r.date}</td>
                      <td className="px-4 py-2.5">{r.item}</td>
                      <td className="px-4 py-2.5">{r.party}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{r.qty.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
