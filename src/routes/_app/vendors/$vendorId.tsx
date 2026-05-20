import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { api, fmtMonth } from "@/lib/api";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Mail, MapPin, Phone, Star } from "lucide-react";
import { ChartCard } from "@/components/chart-card";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, RadialBarChart, RadialBar } from "recharts";

export const Route = createFileRoute("/_app/vendors/$vendorId")({
  loader: async ({ params }) => {
    const [vendor, dashboard] = await Promise.all([
      api.vendors.get(params.vendorId),
      api.dashboard.kpis(),
    ]);
    if (!vendor) throw notFound();
    const spendTrend = dashboard.charts.procurementSpend.map((d) => ({ month: fmtMonth(d.month), spend: d.total }));
    return { vendor, spendTrend };
  },
  component: VendorDetailPage,
  head: ({ loaderData }) => ({ meta: [{ title: `${loaderData?.vendor.name ?? "Vendor"} — SkinOps` }] }),
});

function VendorDetailPage() {
  const { vendor, spendTrend } = Route.useLoaderData();
  const radial = [{ name: "Reliability", value: vendor.reliability, fill: "var(--chart-2)" }];

  return (
    <div className="space-y-6">
      <PageHeader
        title={vendor.name}
        description={`${vendor.materials.join(", ")} · ${vendor.city}`}
        actions={
          <>
            <Button asChild variant="outline" size="sm"><Link to="/vendors"><ArrowLeft className="mr-1.5 h-4 w-4" />Back</Link></Button>
            <Button size="sm">Create PO</Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-card p-4 lg:col-span-2">
          <h3 className="mb-3 text-sm font-semibold">Contact information</h3>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-xs text-muted-foreground">Contact person</dt><dd className="mt-0.5">{vendor.contactPerson}</dd></div>
            <div><dt className="text-xs text-muted-foreground">GST</dt><dd className="mt-0.5 font-mono text-xs">{vendor.gst}</dd></div>
            <div><dt className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />Mobile</dt><dd className="mt-0.5">{vendor.mobile}</dd></div>
            <div><dt className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" />Email</dt><dd className="mt-0.5">{vendor.email}</dd></div>
            <div className="col-span-2"><dt className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />Address</dt><dd className="mt-0.5">{vendor.address}, {vendor.city}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Payment terms</dt><dd className="mt-0.5">{vendor.paymentTerms}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Lead time</dt><dd className="mt-0.5">{vendor.leadTimeDays} days</dd></div>
          </dl>
        </div>
        <div className="rounded-xl border bg-card p-4"><div className="text-xs text-muted-foreground">Rating</div><div className="mt-1 flex items-baseline gap-1"><Star className="h-5 w-5 fill-warning text-warning" /><span className="text-2xl font-semibold tabular-nums">{vendor.rating}</span><span className="text-xs text-muted-foreground">/ 5</span></div><div className="mt-1 text-xs text-muted-foreground">{vendor.totalOrders} orders fulfilled</div></div>
        <div className="rounded-xl border bg-card p-4"><div className="text-xs text-muted-foreground">Total spend (YTD)</div><div className="mt-1 text-2xl font-semibold tabular-nums">₹{(vendor.totalSpend / 100000).toFixed(1)}L</div><div className="mt-1 text-xs text-muted-foreground">{vendor.runningOrders} running orders</div></div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard title="Reliability score" description="On-time delivery performance">
          <ResponsiveContainer width="100%" height={200}>
            <RadialBarChart innerRadius="65%" outerRadius="100%" data={radial} startAngle={180} endAngle={0}>
              <RadialBar background dataKey="value" cornerRadius={8} />
              <text x="50%" y="60%" textAnchor="middle" className="fill-foreground" style={{ fontSize: 28, fontWeight: 600 }}>{vendor.reliability}%</text>
            </RadialBarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Spend trend" description="All-vendor procurement spend (last 6 months)" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={spendTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={12} />
              <YAxis stroke="var(--muted-foreground)" fontSize={12} tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
              <Line type="monotone" dataKey="spend" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="rounded-xl border bg-card">
        <div className="border-b p-4"><h3 className="text-sm font-semibold">Order history</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="px-4 py-2.5 font-medium">PO #</th><th className="px-4 py-2.5 font-medium">SKU</th><th className="px-4 py-2.5 font-medium">Material</th><th className="px-4 py-2.5 font-medium text-right">Qty</th><th className="px-4 py-2.5 font-medium text-right">Total</th><th className="px-4 py-2.5 font-medium">ETA</th><th className="px-4 py-2.5 font-medium">Status</th></tr>
            </thead>
            <tbody>
              {vendor.purchaseOrders.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No orders</td></tr>}
              {vendor.purchaseOrders.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="px-4 py-2.5 font-medium">{p.poNumber}</td>
                  <td className="px-4 py-2.5">{p.sku?.code}</td>
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
