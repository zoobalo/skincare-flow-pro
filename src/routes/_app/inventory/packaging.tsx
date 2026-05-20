import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { api } from "@/lib/api";
import { StatusBadge } from "@/components/status-badge";

export const Route = createFileRoute("/_app/inventory/packaging")({
  loader: async () => {
    const [items, vendors] = await Promise.all([api.inventory.packaging(), api.vendors.list()]);
    const vendorMap = Object.fromEntries(vendors.map((v) => [v.id, v.name]));
    return { items, vendorMap };
  },
  component: PackPage,
  head: () => ({ meta: [{ title: "Packaging Inventory — Zoobalo" }] }),
});

function PackPage() {
  const { items, vendorMap } = Route.useLoaderData();
  return (
    <div className="space-y-6">
      <PageHeader title="Packaging Materials" description={`${items.length} packaging items across all SKUs`} />
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Item</th>
              <th className="px-4 py-2.5 font-medium">SKU</th>
              <th className="px-4 py-2.5 font-medium">Vendor</th>
              <th className="px-4 py-2.5 font-medium text-right">MOQ</th>
              <th className="px-4 py-2.5 font-medium text-right">Stock</th>
              <th className="px-4 py-2.5 font-medium text-right">Transit</th>
              <th className="px-4 py-2.5 font-medium text-right">Cost</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="px-4 py-2.5 font-medium">{p.name}</td>
                <td className="px-4 py-2.5">{p.sku?.code}</td>
                <td className="px-4 py-2.5">{vendorMap[p.vendorId] ?? p.vendorId}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{p.moq.toLocaleString()}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{p.currentStock.toLocaleString()}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{p.transitStock.toLocaleString()}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">₹{p.costPerUnit}</td>
                <td className="px-4 py-2.5">
                  <StatusBadge status={p.currentStock < p.moq * 0.5 ? "Low Stock" : "Healthy"} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
