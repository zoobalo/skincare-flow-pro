import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { skus, helpers } from "@/lib/mock/data";
import { Boxes, AlertTriangle, Truck, Warehouse } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { ChartCard } from "@/components/chart-card";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_app/inventory/")({
  component: InventoryPage,
  head: () => ({ meta: [{ title: "Inventory — SkinOps" }] }),
});

function InventoryPage() {
  const allPackaging = skus.flatMap(s => s.packaging.map(p => ({ ...p, sku: s.code })));
  const totalStock = allPackaging.reduce((a, p) => a + p.currentStock, 0);
  const totalTransit = allPackaging.reduce((a, p) => a + p.transitStock, 0);
  const value = allPackaging.reduce((a, p) => a + p.currentStock * p.costPerUnit, 0);
  const lowItems = allPackaging.filter(p => p.currentStock < p.moq * 0.5);
  const agingData = allPackaging.slice(0, 8).map(p => ({ name: p.name.slice(0, 12), days: Math.floor(Math.random() * 90 + 15) }));

  return (
    <div className="space-y-6">
      <PageHeader title="Inventory" description="Live stock across warehouses, transit, and manufacturers" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total Units in Stock" value={totalStock.toLocaleString()} icon={Boxes} tone="success" />
        <KpiCard label="In Transit" value={totalTransit.toLocaleString()} icon={Truck} tone="info" />
        <KpiCard label="Stock Value" value={`₹${(value/100000).toFixed(1)}L`} icon={Warehouse} />
        <KpiCard label="Low Stock Items" value={lowItems.length} icon={AlertTriangle} tone="warning" />
      </div>

      <Tabs defaultValue="raw">
        <TabsList>
          <TabsTrigger value="raw">Raw Materials</TabsTrigger>
          <TabsTrigger value="pack">Packaging</TabsTrigger>
          <TabsTrigger value="fg">Finished Goods</TabsTrigger>
          <TabsTrigger value="transit">Transit</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>
        <TabsContent value="raw" className="mt-4">
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr><th className="px-4 py-2.5 font-medium">Material</th><th className="px-4 py-2.5 font-medium">SKU</th><th className="px-4 py-2.5 font-medium">Vendor</th><th className="px-4 py-2.5 font-medium text-right">Stock</th><th className="px-4 py-2.5 font-medium text-right">Cost</th></tr>
              </thead>
              <tbody>
                {skus.flatMap(s => s.rawMaterials.map(rm => (
                  <tr key={s.id + rm.id} className="border-t">
                    <td className="px-4 py-2.5 font-medium">{rm.name}</td>
                    <td className="px-4 py-2.5">{s.code}</td>
                    <td className="px-4 py-2.5">{helpers.vendor(rm.vendorId)?.name}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{rm.currentStock.toLocaleString()} {rm.unit}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">₹{rm.costPerUnit}</td>
                  </tr>
                )))}
              </tbody>
            </table>
          </div>
        </TabsContent>
        <TabsContent value="pack" className="mt-4">
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr><th className="px-4 py-2.5 font-medium">Item</th><th className="px-4 py-2.5 font-medium">SKU</th><th className="px-4 py-2.5 font-medium">Vendor</th><th className="px-4 py-2.5 font-medium text-right">Stock</th><th className="px-4 py-2.5 font-medium text-right">Transit</th><th className="px-4 py-2.5 font-medium">Status</th></tr>
              </thead>
              <tbody>
                {allPackaging.map(p => (
                  <tr key={p.id + p.sku} className="border-t">
                    <td className="px-4 py-2.5 font-medium">{p.name}</td>
                    <td className="px-4 py-2.5">{p.sku}</td>
                    <td className="px-4 py-2.5">{helpers.vendor(p.vendorId)?.name}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{p.currentStock.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{p.transitStock.toLocaleString()}</td>
                    <td className="px-4 py-2.5"><StatusBadge status={p.currentStock < p.moq * 0.5 ? "Low Stock" : "Healthy"} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
        <TabsContent value="fg" className="mt-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {skus.map(s => (
              <div key={s.id} className="flex items-center gap-3 rounded-xl border bg-card p-4">
                <img src={s.image} alt="" className="h-14 w-14 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{s.name}</div>
                  <div className="text-xs text-muted-foreground">{s.code} · {s.currentInventory.toLocaleString()} units</div>
                </div>
                <StatusBadge status={s.currentInventory < s.minThreshold ? "Low Stock" : "Healthy"} />
              </div>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="transit" className="mt-4">
          <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">{totalTransit.toLocaleString()} units currently in transit. See Logistics module for shipment-level detail.</div>
        </TabsContent>
        <TabsContent value="analytics" className="mt-4">
          <ChartCard title="Inventory Aging" description="Days in warehouse">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={agingData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Bar dataKey="days" fill="var(--chart-4)" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}
