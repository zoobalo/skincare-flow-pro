import { PageSkeleton } from "@/components/page-skeleton";
import { createFileRoute, Link } from "@tanstack/react-router";
import { fmtDate } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { ChartCard } from "@/components/chart-card";
import { Button } from "@/components/ui/button";
import { api, fmtMonth } from "@/lib/api";
import { Package, Boxes, ShoppingCart, AlertTriangle, Truck, Factory, CheckCircle2, Clock, Users, Plus, FileText, FlaskConical, PackagePlus } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, AreaChart, Area, BarChart, Bar, Legend, CartesianGrid, PieChart, Pie, Cell } from "recharts";
import { StatusBadge } from "@/components/status-badge";

export const Route = createFileRoute("/_app/dashboard")({
  loader: async () => {
    const [dashboard, recentPOs] = await Promise.all([
      api.dashboard.kpis(),
      api.purchaseOrders.list(),
    ]);

    const monthlyProduction = dashboard.charts.monthlyProduction.map((d) => ({
      month: fmtMonth(d.month),
      units: d.quantity,
    }));

    const procurementSpend = dashboard.charts.procurementSpend.map((d) => ({
      month: fmtMonth(d.month),
      spend: d.total,
    }));

    const vendorLeadTimePerf = dashboard.charts.vendorReliability.map((v) => ({
      name: v.name,
      reliability: v.reliability,
      delayPercent: v.delayPercent,
    }));

    const poStatusData = Object.entries(dashboard.charts.poStatusBreakdown).map(([name, value]) => ({
      name,
      value,
    }));

    return {
      kpis: dashboard.kpis,
      charts: { monthlyProduction, procurementSpend, vendorLeadTimePerf, poStatusData },
      recentPOs: recentPOs.slice(0, 6),
    };
  },
  pendingComponent: PageSkeleton,
  component: DashboardPage,
  head: () => ({ meta: [{ title: "Dashboard — Zoobalo" }, { name: "description", content: "Operations overview: KPIs, charts, and quick actions." }] }),
});

const PIE_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--destructive)"];

function DashboardPage() {
  const { kpis, charts, recentPOs } = Route.useLoaderData();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operations Dashboard"
        description="Live view of procurement, inventory, production, and logistics."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm"><Link to="/purchase-orders"><Plus className="mr-1.5 h-4 w-4" />Create PO</Link></Button>
            <Button asChild size="sm" variant="outline"><Link to="/vendors"><Users className="mr-1.5 h-4 w-4" />Vendors</Link></Button>
            <Button asChild size="sm" variant="outline"><Link to="/skus"><PackagePlus className="mr-1.5 h-4 w-4" />SKUs</Link></Button>
            <Button asChild size="sm" variant="outline"><Link to="/production"><Factory className="mr-1.5 h-4 w-4" />Production</Link></Button>
            <Button asChild size="sm" variant="outline"><Link to="/inventory"><Boxes className="mr-1.5 h-4 w-4" />Inventory</Link></Button>
            <Button asChild size="sm" variant="outline"><Link to="/logistics"><Truck className="mr-1.5 h-4 w-4" />Logistics</Link></Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
        <KpiCard label="Total SKUs"               value={kpis.totalSkus}           icon={Package}        delta={5} />
        <KpiCard label="Active Production"         value={kpis.activeProduction}    icon={Factory}        delta={12}  tone="info" />
        <KpiCard label="Pending Approvals"         value={kpis.pendingApprovals}    icon={ShoppingCart}   delta={-3}  tone="warning" />
        <KpiCard label="Total Vendors"             value={kpis.totalVendors}        icon={Users}          tone="success" />
        <KpiCard label="Low Stock Alerts"          value={kpis.lowStockSkus}        icon={AlertTriangle}  delta={-15} tone="warning" hint="Below minimum threshold" />
        <KpiCard label="Delayed Batches"           value={kpis.delayedBatches}      icon={Clock}          delta={2}   tone="danger" />
        <KpiCard label="In Transit"                value={kpis.inTransit}           icon={Truck}          tone="info" />
        <KpiCard label="Total POs"                 value={kpis.totalPOs}            icon={FileText}       delta={8}   tone="success" />
        <KpiCard label="Due Payments"              value={`₹${(kpis.totalDuePayments / 100000).toFixed(1)}L`} icon={FlaskConical} tone="info" hint="Pending payments" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Monthly Production Trend" description="Units produced across all SKUs">
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={charts.monthlyProduction}>
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
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

        <ChartCard title="PO Status Breakdown" description="Distribution of purchase orders by status">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={charts.poStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, value }) => `${name} (${value})`} labelLine={false} fontSize={11}>
                {charts.poStatusData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Vendor Reliability" description="On-time delivery vs delay % (top vendors)">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={charts.vendorLeadTimePerf} layout="vertical" margin={{ left: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" stroke="var(--muted-foreground)" fontSize={12} unit="%" />
              <YAxis type="category" dataKey="name" stroke="var(--muted-foreground)" fontSize={11} width={80} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="reliability"  name="Reliability %" fill="var(--chart-2)" radius={[0, 4, 4, 0]} />
              <Bar dataKey="delayPercent" name="Delay %"        fill="var(--chart-4)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Procurement Cost Analysis" description="Monthly spend across vendors">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={charts.procurementSpend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={12} />
              <YAxis stroke="var(--muted-foreground)" fontSize={12} tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} formatter={(v: number) => `₹${(v / 100000).toFixed(1)}L`} />
              <Line type="monotone" dataKey="spend" stroke="var(--primary)" strokeWidth={2.5} dot={{ r: 4 }} />
            </LineChart>
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
                  <td className="px-4 py-2.5">{p.vendor?.name}</td>
                  <td className="px-4 py-2.5">{p.sku?.code}</td>
                  <td className="px-4 py-2.5">{p.materialType}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{p.quantity.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">₹{p.total.toLocaleString()}</td>
                  <td className="px-4 py-2.5">{fmtDate(p.expectedDelivery)}</td>
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
