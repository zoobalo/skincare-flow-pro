import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { ChartCard } from "@/components/chart-card";
import { Button } from "@/components/ui/button";
import { kpis, monthlyProduction, inventoryConsumption, procurementSpend, vendorLeadTimePerf, skuProductionStatus, purchaseOrders, helpers } from "@/lib/mock/data";
import { Package, Boxes, ShoppingCart, AlertTriangle, Truck, Factory, CheckCircle2, Clock, Users, Plus, FileText, FlaskConical, PackagePlus } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, AreaChart, Area, BarChart, Bar, Legend, CartesianGrid, PieChart, Pie, Cell } from "recharts";
import { StatusBadge } from "@/components/status-badge";

export const Route = createFileRoute("/_app/dashboard")({
  component: DashboardPage,
  head: () => ({ meta: [{ title: "Dashboard — SkinOps" }, { name: "description", content: "Operations overview: KPIs, charts, and quick actions." }] }),
});

function DashboardPage() {
  const recentPOs = purchaseOrders.slice(0, 6);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Operations Dashboard"
        description="Live view of procurement, inventory, production, and logistics."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm"><Link to="/purchase-orders"><Plus className="mr-1.5 h-4 w-4" />Create PO</Link></Button>
            <Button asChild size="sm" variant="outline"><Link to="/vendors"><Users className="mr-1.5 h-4 w-4" />Add Vendor</Link></Button>
            <Button asChild size="sm" variant="outline"><Link to="/skus"><PackagePlus className="mr-1.5 h-4 w-4" />Add SKU</Link></Button>
            <Button asChild size="sm" variant="outline"><Link to="/production"><Factory className="mr-1.5 h-4 w-4" />New Batch</Link></Button>
            <Button asChild size="sm" variant="outline"><Link to="/inventory"><Boxes className="mr-1.5 h-4 w-4" />Update Inventory</Link></Button>
            <Button asChild size="sm" variant="outline"><Link to="/logistics"><Truck className="mr-1.5 h-4 w-4" />Dispatch</Link></Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
        <KpiCard label="Total SKUs" value={kpis.totalSkus} icon={Package} delta={5} />
        <KpiCard label="Active Production Orders" value={kpis.activeProductionOrders} icon={Factory} delta={12} tone="info" />
        <KpiCard label="Pending Purchase Orders" value={kpis.pendingPOs} icon={ShoppingCart} delta={-3} tone="warning" />
        <KpiCard label="Inventory Value" value={`₹${(kpis.inventoryValue/100000).toFixed(1)}L`} icon={Boxes} delta={4} tone="success" />
        <KpiCard label="Low Stock Alerts" value={kpis.lowStockAlerts} icon={AlertTriangle} delta={-15} tone="warning" hint="Below minimum threshold" />
        <KpiCard label="Delayed Vendors" value={kpis.delayedVendors} icon={Clock} delta={2} tone="danger" />
        <KpiCard label="Production in Progress" value={kpis.productionInProgress} icon={Factory} tone="info" />
        <KpiCard label="Finished Goods Ready" value={kpis.finishedGoodsReady.toLocaleString()} icon={CheckCircle2} delta={8} tone="success" />
        <KpiCard label="Transit Materials" value={kpis.transitMaterials} icon={Truck} tone="info" hint={`${kpis.transitMaterials} POs dispatched`} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Monthly Production Trend" description="Units produced across all SKUs">
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={monthlyProduction}>
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={12} />
              <YAxis stroke="var(--muted-foreground)" fontSize={12} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
              <Area type="monotone" dataKey="units" stroke="var(--primary)" fill="url(#g1)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Inventory Consumption" description="Raw vs Packaging weekly consumption">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={inventoryConsumption}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="week" stroke="var(--muted-foreground)" fontSize={12} />
              <YAxis stroke="var(--muted-foreground)" fontSize={12} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="raw" fill="var(--chart-2)" radius={[4,4,0,0]} />
              <Bar dataKey="packaging" fill="var(--chart-3)" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Vendor Lead Time Performance" description="Promised vs actual days (lower = better)">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={vendorLeadTimePerf} layout="vertical" margin={{ left: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" stroke="var(--muted-foreground)" fontSize={12} />
              <YAxis type="category" dataKey="name" stroke="var(--muted-foreground)" fontSize={12} width={80} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="promised" fill="var(--chart-1)" radius={[0,4,4,0]} />
              <Bar dataKey="actual" fill="var(--chart-4)" radius={[0,4,4,0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Procurement Cost Analysis" description="Monthly spend across vendors">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={procurementSpend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={12} />
              <YAxis stroke="var(--muted-foreground)" fontSize={12} tickFormatter={(v) => `₹${(v/100000).toFixed(0)}L`} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} formatter={(v: number) => `₹${(v/100000).toFixed(1)}L`} />
              <Line type="monotone" dataKey="spend" stroke="var(--primary)" strokeWidth={2.5} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="SKU-wise Production Status" description="Completion vs in-progress per SKU" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={skuProductionStatus}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} />
              <YAxis stroke="var(--muted-foreground)" fontSize={12} unit="%" />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="completed" stackId="a" fill="var(--chart-2)" />
              <Bar dataKey="inProgress" stackId="a" fill="var(--chart-4)" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="rounded-xl border bg-card">
        <div className="flex items-center justify-between border-b p-4">
          <div>
            <h3 className="text-sm font-semibold">Recent Purchase Orders</h3>
            <p className="text-xs text-muted-foreground">Latest PO activity across all vendors</p>
          </div>
          <Button asChild variant="ghost" size="sm"><Link to="/purchase-orders"><FileText className="mr-1.5 h-4 w-4" />View all</Link></Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">PO Number</th>
                <th className="px-4 py-2.5 font-medium">Vendor</th>
                <th className="px-4 py-2.5 font-medium">SKU</th>
                <th className="px-4 py-2.5 font-medium">Material</th>
                <th className="px-4 py-2.5 font-medium text-right">Qty</th>
                <th className="px-4 py-2.5 font-medium text-right">Total</th>
                <th className="px-4 py-2.5 font-medium">ETA</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentPOs.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="px-4 py-2.5 font-medium">{p.poNumber}</td>
                  <td className="px-4 py-2.5">{helpers.vendor(p.vendorId)?.name}</td>
                  <td className="px-4 py-2.5">{helpers.sku(p.skuId)?.code}</td>
                  <td className="px-4 py-2.5">{p.materialType}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{p.quantity.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">₹{p.total.toLocaleString()}</td>
                  <td className="px-4 py-2.5">{p.expectedDelivery}</td>
                  <td className="px-4 py-2.5"><StatusBadge status={p.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
