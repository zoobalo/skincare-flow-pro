import { PageSkeleton } from "@/components/page-skeleton";
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { Boxes, AlertTriangle, Truck, Warehouse } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { ChartCard } from "@/components/chart-card";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_app/inventory/")({
  loader: async () => {
    const [summary, packaging, rawMaterials, skus, vendors] = await Promise.all([
      api.inventory.summary(),
      api.inventory.packaging(),
      api.inventory.rawMaterials(),
      api.skus.list(),
      api.vendors.list(),
    ]);
    const vendorMap = Object.fromEntries(vendors.map((v) => [v.id, v.name]));
    const stockValue = packaging.reduce((acc, p) => acc + p.currentStock * p.costPerUnit, 0);
    const lowItems = packaging.filter((p) => p.currentStock < p.moq * 0.5);
    const today = new Date();
    const agingData = packaging
      .filter((p) => p.lastPurchaseDate)
      .slice(0, 8)
      .map((p) => ({
        name: p.name.slice(0, 12),
        days: Math.round((today.getTime() - new Date(p.lastPurchaseDate!).getTime()) / 86400000),
      }));
    return { summary, packaging, rawMaterials, skus, vendorMap, stockValue, lowItems, agingData };
  },
  pendingComponent: PageSkeleton,
  component: InventoryPage,
  head: () => ({ meta: [{ title: "Inventory — Zoobalo" }] }),
});

function InventoryPage() {
  const { summary, packaging, rawMaterials, skus, vendorMap, stockValue, lowItems, agingData } =
    Route.useLoaderData();

  return (
    <div className="space-y-6">
      <PageHeader title="Inventory" description="Live stock across warehouses, transit, and manufacturers" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total Units in Stock" value={summary.totalPackagingStock.toLocaleString()} icon={Boxes} tone="success" />
        <KpiCard label="In Transit"           value={summary.totalPackagingInTransit.toLocaleString()} icon={Truck} tone="info" />
        <KpiCard label="Stock Value"          value={`₹${(stockValue / 100000).toFixed(1)}L`} icon={Warehouse} />
        <KpiCard label="Low Stock Items"      value={lowItems.length} icon={AlertTriangle} tone="warning" />
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
                <tr>
                  <th className="px-4 py-2.5 font-medium">Material</th>
                  <th className="px-4 py-2.5 font-medium">SKU</th>
                  <th className="px-4 py-2.5 font-medium">Vendor</th>
                  <th className="px-4 py-2.5 font-medium text-right">Stock</th>
                  <th className="px-4 py-2.5 font-medium text-right">Cost</th>
                </tr>
              </thead>
              <tbody>
                {rawMaterials.map((rm) => (
                  <tr key={rm.id} className="border-t">
                    <td className="px-4 py-2.5 font-medium">{rm.name}</td>
                    <td className="px-4 py-2.5">{rm.sku?.code}</td>
                    <td className="px-4 py-2.5">{vendorMap[rm.vendorId] ?? rm.vendorId}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{rm.currentStock.toLocaleString()} {rm.unit}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">₹{rm.costPerUnit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="pack" className="mt-4">
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Item</th>
                  <th className="px-4 py-2.5 font-medium">SKU</th>
                  <th className="px-4 py-2.5 font-medium">Vendor</th>
                  <th className="px-4 py-2.5 font-medium text-right">Stock</th>
                  <th className="px-4 py-2.5 font-medium text-right">Transit</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {packaging.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="px-4 py-2.5 font-medium">{p.name}</td>
                    <td className="px-4 py-2.5">{p.sku?.code}</td>
                    <td className="px-4 py-2.5">{vendorMap[p.vendorId] ?? p.vendorId}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{p.currentStock.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{p.transitStock.toLocaleString()}</td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={p.currentStock < p.moq * 0.5 ? "Low Stock" : "Healthy"} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="fg" className="mt-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {skus.map((s) => (
              <div key={s.id} className="flex items-center gap-3 rounded-xl border bg-card p-4">
                {s.image
                  ? <img src={s.image} alt="" className="h-14 w-14 rounded-lg object-cover" />
                  : <div className="h-14 w-14 rounded-lg bg-muted" />}
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
          <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
            {summary.totalPackagingInTransit.toLocaleString()} units currently in transit. See Logistics module for shipment-level detail.
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="mt-4">
          <ChartCard title="Inventory Aging" description="Days since last purchase">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={agingData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Bar dataKey="days" fill="var(--chart-4)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}
