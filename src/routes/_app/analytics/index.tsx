import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { ChartCard } from "@/components/chart-card";
import { api, fmtMonth } from "@/lib/api";
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line, Legend,
} from "recharts";

export const Route = createFileRoute("/_app/analytics/")({
  loader: async () => {
    const [dashboard, skus, vendors] = await Promise.all([
      api.dashboard.kpis(),
      api.skus.list(),
      api.vendors.list(),
    ]);

    const byCategory = Array.from(
      skus.reduce((m, s) => m.set(s.category, (m.get(s.category) ?? 0) + s.currentInventory), new Map<string, number>())
    ).map(([name, value]) => ({ name, value }));

    const vendorSpend = vendors
      .slice()
      .sort((a, b) => b.totalSpend - a.totalSpend)
      .slice(0, 8)
      .map((v) => ({ name: v.name.split(" ")[0], spend: +(v.totalSpend / 100000).toFixed(1) }));

    const procurementSpend = dashboard.charts.procurementSpend.map((d) => ({
      month: fmtMonth(d.month),
      spend: d.total,
    }));

    const monthlyProduction = dashboard.charts.monthlyProduction.map((d) => ({
      month: fmtMonth(d.month),
      units: d.quantity,
    }));

    const vendorPerf = dashboard.charts.vendorReliability.map((v) => ({
      name: v.name,
      reliability: v.reliability,
      delayPercent: v.delayPercent,
    }));

    return { byCategory, vendorSpend, procurementSpend, monthlyProduction, vendorPerf };
  },
  component: AnalyticsPage,
  head: () => ({ meta: [{ title: "Analytics — Zoobalo" }] }),
});

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

function AnalyticsPage() {
  const { byCategory, vendorSpend, procurementSpend, monthlyProduction, vendorPerf } = Route.useLoaderData();

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" description="Operational and procurement intelligence" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Inventory by Category" description="Units across product categories">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={byCategory} dataKey="value" nameKey="name" outerRadius={90} label>
                {byCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
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
              <Bar dataKey="spend" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Procurement Spend Forecast" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={procurementSpend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={12} />
              <YAxis stroke="var(--muted-foreground)" fontSize={12} tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`} />
              <Tooltip
                contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }}
                formatter={(v: number) => `₹${(v / 100000).toFixed(1)}L`}
              />
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
              <Bar dataKey="units" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Vendor Reliability (%)">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={vendorPerf} layout="vertical" margin={{ left: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" stroke="var(--muted-foreground)" fontSize={12} unit="%" />
              <YAxis type="category" dataKey="name" stroke="var(--muted-foreground)" fontSize={11} width={80} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="reliability"  name="Reliability %" fill="var(--chart-3)" radius={[0, 4, 4, 0]} />
              <Bar dataKey="delayPercent" name="Delay %"        fill="var(--chart-4)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
