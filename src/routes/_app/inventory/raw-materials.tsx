import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { api } from "@/lib/api";

export const Route = createFileRoute("/_app/inventory/raw-materials")({
  loader: async () => {
    const [items, vendors] = await Promise.all([api.inventory.rawMaterials(), api.vendors.list()]);
    const vendorMap = Object.fromEntries(vendors.map((v) => [v.id, v.name]));
    return { items, vendorMap };
  },
  component: RawPage,
  head: () => ({ meta: [{ title: "Raw Materials — SkinOps" }] }),
});

function RawPage() {
  const { items, vendorMap } = Route.useLoaderData();
  return (
    <div className="space-y-6">
      <PageHeader title="Raw Materials" description={`${items.length} raw material entries`} />
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Material</th>
              <th className="px-4 py-2.5 font-medium">SKU</th>
              <th className="px-4 py-2.5 font-medium">Vendor</th>
              <th className="px-4 py-2.5 font-medium text-right">Qty / unit</th>
              <th className="px-4 py-2.5 font-medium text-right">Stock</th>
              <th className="px-4 py-2.5 font-medium text-right">Cost</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-4 py-2.5 font-medium">{r.name}</td>
                <td className="px-4 py-2.5">{r.sku?.code}</td>
                <td className="px-4 py-2.5">{vendorMap[r.vendorId] ?? r.vendorId}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{r.qtyPerUnit} {r.unit}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{r.currentStock.toLocaleString()} {r.unit}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">₹{r.costPerUnit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
