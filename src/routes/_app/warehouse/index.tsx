import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KpiCard } from "@/components/kpi-card";
import { ArrowDownToLine, ArrowUpFromLine, Boxes, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_app/warehouse/")({
  component: WarehousePage,
  head: () => ({ meta: [{ title: "Warehouse — SkinOps" }] }),
});

const sampleEntries = (kind: "Inward" | "Outward") =>
  Array.from({ length: 8 }).map((_, i) => ({
    id: `${kind}-${i}`,
    ref: `${kind === "Inward" ? "GRN" : "DC"}-${20260 + i}`,
    date: `2026-04-${10 + i}`,
    item: ["Aluminium Can","Outer Carton","Cap","Sticker","Insert"][i % 5],
    qty: 5000 + i * 500,
    party: ["Alpha Aluminium","ColorPack","CapMakers","StickIt","PrintMatrix"][i % 5],
  }));

function WarehousePage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Warehouse" description="Inward, outward, dispatch, damage and returns" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Inward (this week)" value="42" icon={ArrowDownToLine} tone="success" delta={8} />
        <KpiCard label="Outward (this week)" value="38" icon={ArrowUpFromLine} tone="info" delta={3} />
        <KpiCard label="Damaged Stock" value="156" icon={AlertTriangle} tone="warning" />
        <KpiCard label="Active Batches" value="24" icon={Boxes} />
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
        {(["inward","outward","dispatch","damage","returns","batch"] as const).map(k => (
          <TabsContent key={k} value={k} className="mt-4">
            <div className="overflow-x-auto rounded-xl border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr><th className="px-4 py-2.5 font-medium">Reference</th><th className="px-4 py-2.5 font-medium">Date</th><th className="px-4 py-2.5 font-medium">Item</th><th className="px-4 py-2.5 font-medium">Party</th><th className="px-4 py-2.5 font-medium text-right">Quantity</th></tr>
                </thead>
                <tbody>
                  {sampleEntries(k === "outward" || k === "dispatch" ? "Outward" : "Inward").map(r => (
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
