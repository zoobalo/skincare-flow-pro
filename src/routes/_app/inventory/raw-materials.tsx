import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { skus, helpers } from "@/lib/mock/data";

export const Route = createFileRoute("/_app/inventory/raw-materials")({
  component: RawPage,
  head: () => ({ meta: [{ title: "Raw Materials — SkinOps" }] }),
});

function RawPage() {
  const items = skus.flatMap(s => s.rawMaterials.map(r => ({ ...r, sku: s.code })));
  return (
    <div className="space-y-6">
      <PageHeader title="Raw Materials" description={`${items.length} raw material entries`} />
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr><th className="px-4 py-2.5 font-medium">Material</th><th className="px-4 py-2.5 font-medium">SKU</th><th className="px-4 py-2.5 font-medium">Vendor</th><th className="px-4 py-2.5 font-medium text-right">Qty / unit</th><th className="px-4 py-2.5 font-medium text-right">Stock</th><th className="px-4 py-2.5 font-medium text-right">Cost</th></tr>
          </thead>
          <tbody>
            {items.map((r, i) => (
              <tr key={i} className="border-t">
                <td className="px-4 py-2.5 font-medium">{r.name}</td>
                <td className="px-4 py-2.5">{r.sku}</td>
                <td className="px-4 py-2.5">{helpers.vendor(r.vendorId)?.name}</td>
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
