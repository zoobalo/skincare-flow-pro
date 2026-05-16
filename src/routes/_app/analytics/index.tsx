import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { ChartCard } from "@/components/chart-card";
import { monthlyProduction, procurementSpend, vendorLeadTimePerf, skus, vendors } from "@/lib/mock/data";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, Legend } from "recharts";

export const Route = createFileRoute("/_app/analytics/")({
  component: AnalyticsPage,
  head: () => ({ meta: [{ title: "Analytics — SkinOps" }] }),
});

function AnalyticsPage() {
  const byCategory = Array.from(skus.reduce((m, s) => m.set(s.category, (m.get(s.category) ?? 0) + s.currentInventory), new Map<string, number>())).map(([name, value]) => ({ name, value }));
  const colors = ["var(--chart-1)","var(--chart-2)","var(--chart-3)","var(--chart-4)","var(--chart-5)"];
  const vendorSpend = vendors.slice(0, 8).map(v => ({ name: v.name.split(" ")[0], spend: v.totalSpend / 100000 }));

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" description="Operational and procurement intelligence" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Inventory by Category" description="Units across product categories">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={byCategory} dataKey="value" nameKey="name" outerRadius={90} label>
                {byCategory.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Top Vendor Spend (₹ Lakhs)" description="Year-to-date">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={vendorSpend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} />
              <YAxis stroke="var(--muted-foreground)" fontSize={12} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
              <Bar dataKey="spend" fill="var(--chart-1)" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Procurement Spend Forecast" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={procurementSpend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={12} />
              <YAxis stroke="var(--muted-foreground)" fontSize={12} tickFormatter={(v) => `₹${(v/100000).toFixed(0)}L`} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="spend" stroke="var(--primary)" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Monthly Production">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyProduction}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={12} />
              <YAxis stroke="var(--muted-foreground)" fontSize={12} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
              <Bar dataKey="units" fill="var(--chart-2)" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Vendor Lead Time (days)">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={vendorLeadTimePerf}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} />
              <YAxis stroke="var(--muted-foreground)" fontSize={12} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="promised" fill="var(--chart-3)" />
              <Bar dataKey="actual" fill="var(--chart-4)" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
