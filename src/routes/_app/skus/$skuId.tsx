import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { helpers, purchaseOrders, skus } from "@/lib/mock/data";
import { StatusBadge } from "@/components/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronRight, Edit, FileText } from "lucide-react";
import { ProgressRail } from "@/components/progress-rail";
import { PRODUCTION_STAGES } from "@/lib/mock/types";

export const Route = createFileRoute("/_app/skus/$skuId")({
  component: SkuDetailPage,
  loader: ({ params }) => {
    const sku = skus.find(s => s.id === params.skuId);
    if (!sku) throw notFound();
    return { sku };
  },
  head: ({ loaderData }) => ({ meta: [{ title: `${loaderData?.sku.name ?? "SKU"} — SkinOps` }] }),
});

function SkuDetailPage() {
  const { sku } = Route.useLoaderData();
  const mfg = helpers.manufacturer(sku.manufacturerId);
  const skuPOs = purchaseOrders.filter(p => p.skuId === sku.id);
  const totalPackagingValue = sku.packaging.reduce((acc, p) => acc + p.currentStock * p.costPerUnit, 0);
  const low = sku.currentInventory < sku.minThreshold;
  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1 text-xs text-muted-foreground">
        <Link to="/skus" className="hover:text-foreground">SKUs</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">{sku.code}</span>
      </nav>
      <PageHeader
        title={sku.name}
        description={`${sku.code} · ${sku.category} · ${sku.type}`}
        actions={
          <>
            <Button asChild variant="outline" size="sm"><Link to="/skus"><ArrowLeft className="mr-1.5 h-4 w-4" />Back</Link></Button>
            <Button size="sm"><Edit className="mr-1.5 h-4 w-4" />Edit SKU</Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="overflow-hidden rounded-xl border bg-card">
          <img src={sku.image} alt={sku.name} className="aspect-square w-full object-cover" />
        </div>
        <div className="lg:col-span-2 grid grid-cols-2 gap-3">
          <div className="rounded-xl border bg-card p-4"><div className="text-xs text-muted-foreground">Current inventory</div><div className="mt-1 flex items-baseline gap-2"><span className="text-2xl font-semibold tabular-nums">{sku.currentInventory.toLocaleString()}</span><StatusBadge status={low ? "Low Stock" : "Healthy"} /></div><div className="mt-1 text-xs text-muted-foreground">Min threshold: {sku.minThreshold.toLocaleString()}</div></div>
          <div className="rounded-xl border bg-card p-4"><div className="text-xs text-muted-foreground">Production lead time</div><div className="mt-1 text-2xl font-semibold tabular-nums">{sku.productionTimelineDays}d</div><div className="mt-1 text-xs text-muted-foreground">From PO to dispatch</div></div>
          <div className="rounded-xl border bg-card p-4"><div className="text-xs text-muted-foreground">Manufacturer</div><div className="mt-1 text-base font-semibold">{mfg?.name}</div><div className="mt-1 text-xs text-muted-foreground">{mfg?.location} · QC {mfg?.qcPassRate}%</div></div>
          <div className="rounded-xl border bg-card p-4"><div className="text-xs text-muted-foreground">Packaging stock value</div><div className="mt-1 text-2xl font-semibold tabular-nums">₹{Math.round(totalPackagingValue).toLocaleString()}</div><div className="mt-1 text-xs text-muted-foreground">Across {sku.packaging.length} items</div></div>
          <div className="col-span-2 rounded-xl border bg-card p-4">
            <div className="text-xs text-muted-foreground">Product description</div>
            <p className="mt-1.5 text-sm">{sku.description}</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="packaging">
        <TabsList>
          <TabsTrigger value="packaging">Packaging Materials</TabsTrigger>
          <TabsTrigger value="raw">Raw Materials (BOM)</TabsTrigger>
          <TabsTrigger value="production">Production Timeline</TabsTrigger>
          <TabsTrigger value="pohistory">PO History</TabsTrigger>
        </TabsList>

        <TabsContent value="packaging" className="mt-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {sku.packaging.map(p => {
              const v = helpers.vendor(p.vendorId);
              return (
                <div key={p.id} className="rounded-xl border bg-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-semibold">{p.name}</h4>
                      <Link to="/vendors/$vendorId" params={{ vendorId: p.vendorId }} className="text-xs text-primary hover:underline">{v?.name}</Link>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">MOQ<br /><span className="font-semibold tabular-nums text-foreground">{p.moq.toLocaleString()}</span></div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div><div className="text-muted-foreground">Current stock</div><div className="font-semibold tabular-nums">{p.currentStock.toLocaleString()}</div></div>
                    <div><div className="text-muted-foreground">Transit</div><div className="font-semibold tabular-nums">{p.transitStock.toLocaleString()}</div></div>
                    <div><div className="text-muted-foreground">Cost / unit</div><div className="font-semibold tabular-nums">₹{p.costPerUnit}</div></div>
                    <div><div className="text-muted-foreground">Lead time</div><div className="font-semibold tabular-nums">{p.leadTimeDays}d</div></div>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
                    <span>Last PO: {p.lastPurchaseDate}</span>
                    <span>{v?.mobile}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="raw" className="mt-4">
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr><th className="px-4 py-2.5 font-medium">Material</th><th className="px-4 py-2.5 font-medium">Vendor</th><th className="px-4 py-2.5 font-medium text-right">Qty / unit</th><th className="px-4 py-2.5 font-medium text-right">Stock</th><th className="px-4 py-2.5 font-medium text-right">Cost</th></tr>
              </thead>
              <tbody>
                {sku.rawMaterials.map(rm => (
                  <tr key={rm.id} className="border-t">
                    <td className="px-4 py-2.5 font-medium">{rm.name}</td>
                    <td className="px-4 py-2.5">{helpers.vendor(rm.vendorId)?.name}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{rm.qtyPerUnit} {rm.unit}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{rm.currentStock.toLocaleString()} {rm.unit}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">₹{rm.costPerUnit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="production" className="mt-4">
          <div className="rounded-xl border bg-card p-6">
            <h3 className="text-sm font-semibold">11-stage production flow</h3>
            <p className="mt-1 text-xs text-muted-foreground">Typical journey for a {sku.type} SKU.</p>
            <div className="mt-6">
              <ProgressRail stages={PRODUCTION_STAGES} current="Filling Process" />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="pohistory" className="mt-4">
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr><th className="px-4 py-2.5 font-medium">PO #</th><th className="px-4 py-2.5 font-medium">Vendor</th><th className="px-4 py-2.5 font-medium">Material</th><th className="px-4 py-2.5 font-medium text-right">Qty</th><th className="px-4 py-2.5 font-medium text-right">Total</th><th className="px-4 py-2.5 font-medium">Status</th></tr>
              </thead>
              <tbody>
                {skuPOs.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No PO history yet.</td></tr>}
                {skuPOs.map(p => (
                  <tr key={p.id} className="border-t">
                    <td className="px-4 py-2.5"><Link to="/purchase-orders" className="font-medium text-primary hover:underline">{p.poNumber}</Link></td>
                    <td className="px-4 py-2.5">{helpers.vendor(p.vendorId)?.name}</td>
                    <td className="px-4 py-2.5">{p.materialType}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{p.quantity.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">₹{p.total.toLocaleString()}</td>
                    <td className="px-4 py-2.5"><StatusBadge status={p.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
