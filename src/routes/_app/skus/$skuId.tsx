import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { api } from "@/lib/api";
import { StatusBadge } from "@/components/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ChevronRight, Edit, Plus, Trash2 } from "lucide-react";
import { ProgressRail } from "@/components/progress-rail";
import { PRODUCTION_STAGES } from "@/lib/mock/types";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/skus/$skuId")({
  loader: async ({ params }) => {
    const [sku, manufacturers, vendors] = await Promise.all([
      api.skus.get(params.skuId),
      api.manufacturers.list(),
      api.vendors.list(),
    ]);
    if (!sku) throw notFound();
    return { sku, manufacturers, vendors };
  },
  component: SkuDetailPage,
  head: ({ loaderData }) => ({ meta: [{ title: `${loaderData?.sku.name ?? "SKU"} — SkinOps` }] }),
});

const SKU_CATEGORIES = ["Sun Care", "Serums", "Moisturizers", "Cleansers", "Toners", "Exfoliators", "Eye Care", "Lip Care", "Body Care"];
const SKU_TYPES = ["Aerosol Spray", "Glass Dropper", "Pump Bottle", "Tube", "Jar", "Cream Tube", "Lotion Bottle", "Toner Bottle", "Stick"];
const RAW_UNITS = ["ml", "g", "kg", "L", "pcs", "mg"];

const EMPTY_PACK = { name: "", vendorId: "", moq: 1000, leadTimeDays: 14, currentStock: 0, transitStock: 0, costPerUnit: 0, lastPurchaseDate: "" };
const EMPTY_RM   = { name: "", vendorId: "", qtyPerUnit: 1, unit: "ml", currentStock: 0, costPerUnit: 0 };
const EMPTY_BATCH = { batchNumber: "", manufacturerId: "", quantity: 1000, currentStage: "PO Generated", startedAt: "", expectedCompletion: "", delayed: false };

function SkuDetailPage() {
  const { sku, manufacturers, vendors } = Route.useLoaderData();
  const router = useRouter();
  const mfg = sku.manufacturer;
  const totalPackagingValue = sku.packaging.reduce((acc, p) => acc + p.currentStock * p.costPerUnit, 0);
  const low = sku.currentInventory < sku.minThreshold;

  // Edit SKU sheet
  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    code: sku.code, name: sku.name, category: sku.category, type: sku.type,
    description: sku.description, image: sku.image, manufacturerId: sku.manufacturerId,
    currentInventory: sku.currentInventory, minThreshold: sku.minThreshold,
    productionTimelineDays: sku.productionTimelineDays,
  });

  // Add Packaging sheet
  const [packOpen, setPackOpen] = useState(false);
  const [packSaving, setPackSaving] = useState(false);
  const [packForm, setPackForm] = useState({ ...EMPTY_PACK, vendorId: vendors[0]?.id ?? "" });

  // Add Raw Material sheet
  const [rmOpen, setRmOpen] = useState(false);
  const [rmSaving, setRmSaving] = useState(false);
  const [rmForm, setRmForm] = useState({ ...EMPTY_RM, vendorId: vendors[0]?.id ?? "" });

  // Add Production Batch sheet
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchSaving, setBatchSaving] = useState(false);
  const [batchForm, setBatchForm] = useState({ ...EMPTY_BATCH, manufacturerId: manufacturers[0]?.id ?? "" });

  // Edit Production Batch sheet
  const [editBatchOpen, setEditBatchOpen] = useState(false);
  const [editBatchSaving, setEditBatchSaving] = useState(false);
  const [editBatchId, setEditBatchId] = useState<string | null>(null);
  const [editBatchForm, setEditBatchForm] = useState({ ...EMPTY_BATCH, manufacturerId: manufacturers[0]?.id ?? "" });

  const setEdit      = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setEditForm(p => ({ ...p, [f]: e.target.value }));
  const setPack      = (f: string) => (e: React.ChangeEvent<HTMLInputElement>) => setPackForm(p => ({ ...p, [f]: e.target.value }));
  const setRm        = (f: string) => (e: React.ChangeEvent<HTMLInputElement>) => setRmForm(p => ({ ...p, [f]: e.target.value }));
  const setBatch     = (f: string) => (e: React.ChangeEvent<HTMLInputElement>) => setBatchForm(p => ({ ...p, [f]: e.target.value }));
  const setEditBatch = (f: string) => (e: React.ChangeEvent<HTMLInputElement>) => setEditBatchForm(p => ({ ...p, [f]: e.target.value }));

  const reload = () => router.invalidate();

  const saveEdit = async () => {
    setEditSaving(true);
    try {
      await api.skus.update(sku.id, { ...editForm, currentInventory: +editForm.currentInventory, minThreshold: +editForm.minThreshold, productionTimelineDays: +editForm.productionTimelineDays });
      toast.success("SKU updated."); setEditOpen(false); reload();
    } catch { toast.error("Failed to update SKU."); } finally { setEditSaving(false); }
  };

  const savePackaging = async () => {
    if (!packForm.name || !packForm.vendorId) { toast.error("Name and vendor are required."); return; }
    setPackSaving(true);
    try {
      await api.skus.addPackaging(sku.id, { ...packForm, moq: +packForm.moq, leadTimeDays: +packForm.leadTimeDays, currentStock: +packForm.currentStock, transitStock: +packForm.transitStock, costPerUnit: +packForm.costPerUnit, lastPurchaseDate: packForm.lastPurchaseDate || null });
      toast.success("Packaging material added."); setPackOpen(false); setPackForm({ ...EMPTY_PACK, vendorId: vendors[0]?.id ?? "" }); reload();
    } catch { toast.error("Failed to add packaging."); } finally { setPackSaving(false); }
  };

  const saveRawMaterial = async () => {
    if (!rmForm.name || !rmForm.vendorId) { toast.error("Name and vendor are required."); return; }
    setRmSaving(true);
    try {
      await api.skus.addRawMaterial(sku.id, { ...rmForm, qtyPerUnit: +rmForm.qtyPerUnit, currentStock: +rmForm.currentStock, costPerUnit: +rmForm.costPerUnit });
      toast.success("Raw material added."); setRmOpen(false); setRmForm({ ...EMPTY_RM, vendorId: vendors[0]?.id ?? "" }); reload();
    } catch { toast.error("Failed to add raw material."); } finally { setRmSaving(false); }
  };

  const saveBatch = async () => {
    if (!batchForm.batchNumber || !batchForm.manufacturerId || !batchForm.startedAt || !batchForm.expectedCompletion) {
      toast.error("Batch number, manufacturer and dates are required."); return;
    }
    setBatchSaving(true);
    try {
      await api.production.create({ ...batchForm, skuId: sku.id, quantity: +batchForm.quantity });
      toast.success("Production batch created."); setBatchOpen(false); setBatchForm({ ...EMPTY_BATCH, manufacturerId: manufacturers[0]?.id ?? "" }); reload();
    } catch { toast.error("Failed to create batch."); } finally { setBatchSaving(false); }
  };

  const deletePackaging = async (id: string) => {
    if (!confirm("Delete this packaging item?")) return;
    try { await api.skus.deletePackaging(id); toast.success("Deleted."); reload(); } catch { toast.error("Failed to delete."); }
  };

  const deleteRawMaterial = async (id: string) => {
    if (!confirm("Delete this raw material?")) return;
    try { await api.skus.deleteRawMaterial(id); toast.success("Deleted."); reload(); } catch { toast.error("Failed to delete."); }
  };

  const openEditBatch = (batch: typeof sku.productionBatches[0]) => {
    setEditBatchId(batch.id);
    setEditBatchForm({
      batchNumber: batch.batchNumber,
      manufacturerId: batch.manufacturerId,
      quantity: batch.quantity,
      currentStage: batch.currentStage,
      startedAt: batch.startedAt.slice(0, 10),
      expectedCompletion: batch.expectedCompletion.slice(0, 10),
      delayed: batch.delayed,
    });
    setEditBatchOpen(true);
  };

  const saveEditBatch = async () => {
    if (!editBatchId) return;
    setEditBatchSaving(true);
    try {
      await api.production.update(editBatchId, { ...editBatchForm, quantity: +editBatchForm.quantity });
      toast.success("Batch updated."); setEditBatchOpen(false); reload();
    } catch { toast.error("Failed to update batch."); } finally { setEditBatchSaving(false); }
  };

  const deleteBatch = async (id: string) => {
    if (!confirm("Delete this production batch?")) return;
    try { await api.production.delete(id); toast.success("Deleted."); reload(); } catch { toast.error("Failed to delete."); }
  };

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
            <Button size="sm" onClick={() => setEditOpen(true)}><Edit className="mr-1.5 h-4 w-4" />Edit SKU</Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="overflow-hidden rounded-xl border bg-card">
          {sku.image ? <img src={sku.image} alt={sku.name} className="aspect-square w-full object-cover" /> : <div className="aspect-square w-full bg-muted flex items-center justify-center text-muted-foreground text-sm">No image</div>}
        </div>
        <div className="lg:col-span-2 grid grid-cols-2 gap-3">
          <div className="rounded-xl border bg-card p-4"><div className="text-xs text-muted-foreground">Current inventory</div><div className="mt-1 flex items-baseline gap-2"><span className="text-2xl font-semibold tabular-nums">{sku.currentInventory.toLocaleString()}</span><StatusBadge status={low ? "Low Stock" : "Healthy"} /></div><div className="mt-1 text-xs text-muted-foreground">Min threshold: {sku.minThreshold.toLocaleString()}</div></div>
          <div className="rounded-xl border bg-card p-4"><div className="text-xs text-muted-foreground">Production lead time</div><div className="mt-1 text-2xl font-semibold tabular-nums">{sku.productionTimelineDays}d</div><div className="mt-1 text-xs text-muted-foreground">From PO to dispatch</div></div>
          <div className="rounded-xl border bg-card p-4"><div className="text-xs text-muted-foreground">Manufacturer</div><div className="mt-1 text-base font-semibold">{mfg?.name ?? "—"}</div><div className="mt-1 text-xs text-muted-foreground">{mfg?.location} {mfg?.qcPassRate ? `· QC ${mfg.qcPassRate}%` : ""}</div></div>
          <div className="rounded-xl border bg-card p-4"><div className="text-xs text-muted-foreground">Packaging stock value</div><div className="mt-1 text-2xl font-semibold tabular-nums">₹{Math.round(totalPackagingValue).toLocaleString()}</div><div className="mt-1 text-xs text-muted-foreground">Across {sku.packaging.length} items</div></div>
          <div className="col-span-2 rounded-xl border bg-card p-4"><div className="text-xs text-muted-foreground">Product description</div><p className="mt-1.5 text-sm">{sku.description || "—"}</p></div>
        </div>
      </div>

      <Tabs defaultValue="packaging">
        <TabsList>
          <TabsTrigger value="packaging">Packaging ({sku.packaging.length})</TabsTrigger>
          <TabsTrigger value="raw">Raw Materials ({sku.rawMaterials.length})</TabsTrigger>
          <TabsTrigger value="production">Production ({sku.productionBatches.length})</TabsTrigger>
          <TabsTrigger value="pohistory">PO History</TabsTrigger>
        </TabsList>

        {/* ── Packaging ── */}
        <TabsContent value="packaging" className="mt-4">
          <div className="mb-3 flex justify-end">
            <Button size="sm" onClick={() => setPackOpen(true)}><Plus className="mr-1.5 h-4 w-4" />Add Packaging Material</Button>
          </div>
          {sku.packaging.length === 0 && (
            <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">No packaging materials yet. Click "Add Packaging Material" to get started.</div>
          )}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {sku.packaging.map((p) => (
              <div key={p.id} className="rounded-xl border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-semibold">{p.name}</h4>
                    <span className="text-xs text-muted-foreground">{p.vendorId}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="text-right text-xs text-muted-foreground">MOQ<br /><span className="font-semibold tabular-nums text-foreground">{p.moq.toLocaleString()}</span></div>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => deletePackaging(p.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div><div className="text-muted-foreground">Current stock</div><div className="font-semibold tabular-nums">{p.currentStock.toLocaleString()}</div></div>
                  <div><div className="text-muted-foreground">Transit</div><div className="font-semibold tabular-nums">{p.transitStock.toLocaleString()}</div></div>
                  <div><div className="text-muted-foreground">Cost / unit</div><div className="font-semibold tabular-nums">₹{p.costPerUnit}</div></div>
                  <div><div className="text-muted-foreground">Lead time</div><div className="font-semibold tabular-nums">{p.leadTimeDays}d</div></div>
                </div>
                <div className="mt-3 border-t pt-3 text-xs text-muted-foreground">Last PO: {p.lastPurchaseDate ?? "—"}</div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* ── Raw Materials ── */}
        <TabsContent value="raw" className="mt-4">
          <div className="mb-3 flex justify-end">
            <Button size="sm" onClick={() => setRmOpen(true)}><Plus className="mr-1.5 h-4 w-4" />Add Raw Material</Button>
          </div>
          {sku.rawMaterials.length === 0 && (
            <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">No raw materials yet. Click "Add Raw Material" to get started.</div>
          )}
          <div className="overflow-x-auto rounded-xl border bg-card">
            {sku.rawMaterials.length > 0 && (
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr><th className="px-4 py-2.5 font-medium">Material</th><th className="px-4 py-2.5 font-medium text-right">Qty / unit</th><th className="px-4 py-2.5 font-medium text-right">Stock</th><th className="px-4 py-2.5 font-medium text-right">Cost</th><th className="px-4 py-2.5 font-medium"></th></tr>
                </thead>
                <tbody>
                  {sku.rawMaterials.map((rm) => (
                    <tr key={rm.id} className="border-t">
                      <td className="px-4 py-2.5 font-medium">{rm.name}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{rm.qtyPerUnit} {rm.unit}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{rm.currentStock} {rm.unit}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">₹{rm.costPerUnit}</td>
                      <td className="px-4 py-2.5 text-right">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => deleteRawMaterial(rm.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </TabsContent>

        {/* ── Production ── */}
        <TabsContent value="production" className="mt-4">
          <div className="mb-3 flex justify-end">
            <Button size="sm" onClick={() => setBatchOpen(true)}><Plus className="mr-1.5 h-4 w-4" />Create Production Batch</Button>
          </div>
          {sku.productionBatches.length === 0 && (
            <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">No production batches yet. Click "Create Production Batch" to track manufacturing.</div>
          )}
          <div className="space-y-4">
            {sku.productionBatches.map((batch) => (
              <div key={batch.id} className="rounded-xl border bg-card p-5">
                <div className="mb-4 flex items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold">{batch.batchNumber}</div>
                    <p className="text-xs text-muted-foreground">{batch.quantity.toLocaleString()} units · ETA {batch.expectedCompletion}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={batch.delayed ? "Delayed" : "In Production"} />
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEditBatch(batch)}><Edit className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => deleteBatch(batch.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
                <ProgressRail stages={PRODUCTION_STAGES} current={batch.currentStage as any} delayed={batch.delayed} />
              </div>
            ))}
          </div>
        </TabsContent>

        {/* ── PO History ── */}
        <TabsContent value="pohistory" className="mt-4">
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr><th className="px-4 py-2.5 font-medium">PO #</th><th className="px-4 py-2.5 font-medium">Vendor</th><th className="px-4 py-2.5 font-medium">Material</th><th className="px-4 py-2.5 font-medium text-right">Qty</th><th className="px-4 py-2.5 font-medium text-right">Total</th><th className="px-4 py-2.5 font-medium">Status</th></tr>
              </thead>
              <tbody>
                {sku.purchaseOrders.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No PO history yet.</td></tr>}
                {sku.purchaseOrders.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="px-4 py-2.5 font-medium">{p.poNumber}</td>
                    <td className="px-4 py-2.5">{p.vendor?.name}</td>
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

      {/* ── Edit SKU Sheet ── */}
      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader><SheetTitle>Edit SKU — {sku.code}</SheetTitle></SheetHeader>
          <div className="mt-6 grid grid-cols-1 gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>SKU Code</Label><Input value={editForm.code} onChange={setEdit("code")} /></div>
              <div className="space-y-1.5"><Label>Category</Label>
                <Select value={editForm.category} onValueChange={(v) => setEditForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SKU_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5"><Label>Product Name</Label><Input value={editForm.name} onChange={setEdit("name")} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Type</Label>
                <Select value={editForm.type} onValueChange={(v) => setEditForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SKU_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Manufacturer</Label>
                <Select value={editForm.manufacturerId} onValueChange={(v) => setEditForm(f => ({ ...f, manufacturerId: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{manufacturers.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5"><Label>Description</Label><Textarea rows={2} value={editForm.description} onChange={setEdit("description")} /></div>
            <div className="space-y-1.5"><Label>Image URL</Label><Input value={editForm.image} onChange={setEdit("image")} /></div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5"><Label>Current Stock</Label><Input type="number" value={editForm.currentInventory} onChange={setEdit("currentInventory")} /></div>
              <div className="space-y-1.5"><Label>Min Threshold</Label><Input type="number" value={editForm.minThreshold} onChange={setEdit("minThreshold")} /></div>
              <div className="space-y-1.5"><Label>Lead time (days)</Label><Input type="number" value={editForm.productionTimelineDays} onChange={setEdit("productionTimelineDays")} /></div>
            </div>
          </div>
          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={editSaving}>{editSaving ? "Saving…" : "Save changes"}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ── Add Packaging Sheet ── */}
      <Sheet open={packOpen} onOpenChange={setPackOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader><SheetTitle>Add Packaging Material</SheetTitle></SheetHeader>
          <div className="mt-6 grid grid-cols-1 gap-4">
            <div className="space-y-1.5"><Label>Item Name *</Label><Input placeholder="e.g. Aluminium Can 150ml" value={packForm.name} onChange={setPack("name")} /></div>
            <div className="space-y-1.5"><Label>Vendor *</Label>
              <Select value={packForm.vendorId} onValueChange={(v) => setPackForm(f => ({ ...f, vendorId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
                <SelectContent>{vendors.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>MOQ (units)</Label><Input type="number" value={packForm.moq} onChange={setPack("moq")} /></div>
              <div className="space-y-1.5"><Label>Lead time (days)</Label><Input type="number" value={packForm.leadTimeDays} onChange={setPack("leadTimeDays")} /></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5"><Label>Current Stock</Label><Input type="number" value={packForm.currentStock} onChange={setPack("currentStock")} /></div>
              <div className="space-y-1.5"><Label>Transit Stock</Label><Input type="number" value={packForm.transitStock} onChange={setPack("transitStock")} /></div>
              <div className="space-y-1.5"><Label>Cost / unit (₹)</Label><Input type="number" step="0.01" value={packForm.costPerUnit} onChange={setPack("costPerUnit")} /></div>
            </div>
            <div className="space-y-1.5"><Label>Last Purchase Date</Label><Input type="date" value={packForm.lastPurchaseDate} onChange={setPack("lastPurchaseDate")} /></div>
          </div>
          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setPackOpen(false)}>Cancel</Button>
            <Button onClick={savePackaging} disabled={packSaving}>{packSaving ? "Adding…" : "Add Packaging"}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ── Add Raw Material Sheet ── */}
      <Sheet open={rmOpen} onOpenChange={setRmOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader><SheetTitle>Add Raw Material</SheetTitle></SheetHeader>
          <div className="mt-6 grid grid-cols-1 gap-4">
            <div className="space-y-1.5"><Label>Material Name *</Label><Input placeholder="e.g. Avobenzone (3%)" value={rmForm.name} onChange={setRm("name")} /></div>
            <div className="space-y-1.5"><Label>Vendor *</Label>
              <Select value={rmForm.vendorId} onValueChange={(v) => setRmForm(f => ({ ...f, vendorId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
                <SelectContent>{vendors.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5"><Label>Qty / unit</Label><Input type="number" step="0.01" value={rmForm.qtyPerUnit} onChange={setRm("qtyPerUnit")} /></div>
              <div className="space-y-1.5"><Label>Unit</Label>
                <Select value={rmForm.unit} onValueChange={(v) => setRmForm(f => ({ ...f, unit: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{RAW_UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Current Stock</Label><Input type="number" step="0.01" value={rmForm.currentStock} onChange={setRm("currentStock")} /></div>
            </div>
            <div className="space-y-1.5"><Label>Cost / unit (₹)</Label><Input type="number" step="0.01" value={rmForm.costPerUnit} onChange={setRm("costPerUnit")} /></div>
          </div>
          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setRmOpen(false)}>Cancel</Button>
            <Button onClick={saveRawMaterial} disabled={rmSaving}>{rmSaving ? "Adding…" : "Add Raw Material"}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ── Edit Production Batch Sheet ── */}
      <Sheet open={editBatchOpen} onOpenChange={setEditBatchOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader><SheetTitle>Edit Production Batch</SheetTitle></SheetHeader>
          <div className="mt-6 grid grid-cols-1 gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Batch Number</Label><Input value={editBatchForm.batchNumber} onChange={setEditBatch("batchNumber")} /></div>
              <div className="space-y-1.5"><Label>Quantity (units)</Label><Input type="number" value={editBatchForm.quantity} onChange={setEditBatch("quantity")} /></div>
            </div>
            <div className="space-y-1.5"><Label>Manufacturer</Label>
              <Select value={editBatchForm.manufacturerId} onValueChange={(v) => setEditBatchForm(f => ({ ...f, manufacturerId: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{manufacturers.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Current Stage</Label>
              <Select value={editBatchForm.currentStage} onValueChange={(v) => setEditBatchForm(f => ({ ...f, currentStage: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PRODUCTION_STAGES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Start Date</Label><Input type="date" value={editBatchForm.startedAt} onChange={setEditBatch("startedAt")} /></div>
              <div className="space-y-1.5"><Label>Expected Completion</Label><Input type="date" value={editBatchForm.expectedCompletion} onChange={setEditBatch("expectedCompletion")} /></div>
            </div>
            <div className="flex items-center gap-3">
              <input type="checkbox" id="delayedFlag" checked={editBatchForm.delayed as boolean} onChange={(e) => setEditBatchForm(f => ({ ...f, delayed: e.target.checked }))} className="h-4 w-4" />
              <Label htmlFor="delayedFlag">Mark as Delayed</Label>
            </div>
          </div>
          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setEditBatchOpen(false)}>Cancel</Button>
            <Button onClick={saveEditBatch} disabled={editBatchSaving}>{editBatchSaving ? "Saving…" : "Save changes"}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ── Create Production Batch Sheet ── */}
      <Sheet open={batchOpen} onOpenChange={setBatchOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader><SheetTitle>Create Production Batch</SheetTitle></SheetHeader>
          <div className="mt-6 grid grid-cols-1 gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Batch Number *</Label><Input placeholder="e.g. BATCH-2026-001" value={batchForm.batchNumber} onChange={setBatch("batchNumber")} /></div>
              <div className="space-y-1.5"><Label>Quantity (units)</Label><Input type="number" value={batchForm.quantity} onChange={setBatch("quantity")} /></div>
            </div>
            <div className="space-y-1.5"><Label>Manufacturer *</Label>
              <Select value={batchForm.manufacturerId} onValueChange={(v) => setBatchForm(f => ({ ...f, manufacturerId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select manufacturer" /></SelectTrigger>
                <SelectContent>{manufacturers.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Current Stage</Label>
              <Select value={batchForm.currentStage} onValueChange={(v) => setBatchForm(f => ({ ...f, currentStage: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PRODUCTION_STAGES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Start Date *</Label><Input type="date" value={batchForm.startedAt} onChange={setBatch("startedAt")} /></div>
              <div className="space-y-1.5"><Label>Expected Completion *</Label><Input type="date" value={batchForm.expectedCompletion} onChange={setBatch("expectedCompletion")} /></div>
            </div>
          </div>
          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setBatchOpen(false)}>Cancel</Button>
            <Button onClick={saveBatch} disabled={batchSaving}>{batchSaving ? "Creating…" : "Create Batch"}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
