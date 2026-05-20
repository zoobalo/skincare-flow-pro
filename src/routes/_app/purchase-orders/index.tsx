import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { DataTable, type Column } from "@/components/data-table";
import { api, type ApiPo, type ApiVendor, type ApiSku } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/purchase-orders/")({
  loader: async () => {
    const [purchaseOrders, vendors, skus] = await Promise.all([
      api.purchaseOrders.list(),
      api.vendors.list(),
      api.skus.list(),
    ]);
    return { purchaseOrders, vendors, skus };
  },
  component: POPage,
  head: () => ({ meta: [{ title: "Purchase Orders — SkinOps" }] }),
});

const PO_STATUSES = ["Pending", "Approved", "In Production", "Dispatched", "Delivered", "Delayed"] as const;

const GST_RATES = [0, 5, 12, 18, 28] as const;

const EMPTY_FORM = {
  vendorId: "", skuId: "", materialType: "", quantity: 1000,
  rate: 0, gstRate: 18, gstAmount: 0, total: 0,
  dispatchDate: "", expectedDelivery: "",
  status: "Pending" as typeof PO_STATUSES[number],
  paymentDue: "", notes: "",
};

function POPage() {
  const { purchaseOrders, vendors, skus } = Route.useLoaderData();
  const router = useRouter();

  const [editTarget, setEditTarget] = useState<ApiPo | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editForm, setEditForm] = useState({ ...EMPTY_FORM });

  const openEdit = (po: ApiPo) => {
    setEditForm({
      vendorId: po.vendorId,
      skuId: po.skuId,
      materialType: po.materialType,
      quantity: po.quantity,
      rate: po.rate,
      gstRate: po.gstRate ?? 18,
      gstAmount: po.gstAmount ?? 0,
      total: po.total,
      dispatchDate: po.dispatchDate,
      expectedDelivery: po.expectedDelivery,
      status: po.status,
      paymentDue: po.paymentDue != null ? String(po.paymentDue) : "",
      notes: po.notes ?? "",
    });
    setEditTarget(po);
  };

  const saveEdit = async () => {
    if (!editTarget) return;
    setEditSaving(true);
    try {
      const subtotal   = Number(editForm.quantity) * Number(editForm.rate);
      const gstAmt     = Math.round(subtotal * Number(editForm.gstRate) / 100 * 100) / 100;
      const grandTotal = subtotal + gstAmt;
      await api.purchaseOrders.update(editTarget.id, {
        ...editForm,
        quantity:  Number(editForm.quantity),
        rate:      Number(editForm.rate) as any,
        gstRate:   Number(editForm.gstRate),
        gstAmount: gstAmt as any,
        total:     grandTotal as any,
        paymentDue: editForm.paymentDue ? Number(editForm.paymentDue) as any : null,
        notes: editForm.notes || null,
      });
      toast.success("Purchase order updated.");
      setEditTarget(null);
      await router.invalidate();
    } catch {
      toast.error("Failed to update purchase order.");
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async (po: ApiPo) => {
    if (!confirm(`Delete PO ${po.poNumber}? This cannot be undone.`)) return;
    const res = await fetch(`${import.meta.env.VITE_API_URL ?? "http://localhost:3001"}/api/purchase-orders/${po.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success(`${po.poNumber} deleted.`);
      await router.invalidate();
    } else {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error ?? "Failed to delete purchase order.");
    }
  };

  const set = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setEditForm((p) => ({ ...p, [f]: e.target.value }));

  const cols: Column<ApiPo>[] = [
    { key: "po",       header: "PO #",     accessor: (r) => r.poNumber,           cell: (r) => <span className="font-medium">{r.poNumber}</span> },
    { key: "vendor",   header: "Vendor",   accessor: (r) => r.vendor?.name ?? "", cell: (r) => r.vendor?.name },
    { key: "sku",      header: "SKU",      accessor: (r) => r.sku?.code ?? "",    cell: (r) => r.sku?.code },
    { key: "material", header: "Material", accessor: (r) => r.materialType,       cell: (r) => r.materialType },
    { key: "qty",      header: "Qty",      accessor: (r) => r.quantity,           cell: (r) => <span className="tabular-nums">{r.quantity.toLocaleString()}</span>, className: "text-right" },
    { key: "rate",     header: "Rate",     accessor: (r) => r.rate,               cell: (r) => <span className="tabular-nums">₹{r.rate}</span>, className: "text-right" },
    { key: "gst",      header: "GST",      accessor: (r) => r.gstRate,            cell: (r) => <span className="tabular-nums text-muted-foreground">{r.gstRate ?? 0}%</span>, className: "text-right" },
    { key: "total",    header: "Total (incl. GST)", accessor: (r) => r.total,     cell: (r) => <span className="tabular-nums font-medium">₹{r.total.toLocaleString()}</span>, className: "text-right" },
    { key: "dispatch", header: "Dispatch", accessor: (r) => r.dispatchDate,       cell: (r) => r.dispatchDate },
    { key: "eta",      header: "Expected", accessor: (r) => r.expectedDelivery,   cell: (r) => r.expectedDelivery },
    { key: "status",   header: "Status",   accessor: (r) => r.status,             cell: (r) => <StatusBadge status={r.status} /> },
    {
      key: "actions", header: "", accessor: (r) => r.id,
      cell: (r) => (
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(r)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => handleDelete(r)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchase Orders"
        description={`${purchaseOrders.length} POs across all vendors and SKUs`}
        actions={<Button asChild><Link to="/purchase-orders/new"><Plus className="mr-1.5 h-4 w-4" />Create PO</Link></Button>}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
        {PO_STATUSES.map((s) => {
          const count = purchaseOrders.filter((p) => p.status === s).length;
          return (
            <div key={s} className="rounded-xl border bg-card p-3">
              <div className="text-xs text-muted-foreground">{s}</div>
              <div className="mt-1 text-xl font-semibold tabular-nums">{count}</div>
            </div>
          );
        })}
      </div>

      <DataTable rows={purchaseOrders} columns={cols} searchKeys={["poNumber", "materialType"]} searchPlaceholder="Search POs…" pageSize={12} />

      {/* ── Edit PO Sheet ── */}
      <Sheet open={!!editTarget} onOpenChange={(v) => { if (!v) setEditTarget(null); }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader><SheetTitle>Edit PO — {editTarget?.poNumber}</SheetTitle></SheetHeader>
          <div className="mt-6 grid grid-cols-1 gap-4">
            <div className="space-y-1.5">
              <Label>Vendor</Label>
              <Select value={editForm.vendorId} onValueChange={(v) => setEditForm((f) => ({ ...f, vendorId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
                <SelectContent>{vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>SKU</Label>
              <Select value={editForm.skuId} onValueChange={(v) => setEditForm((f) => ({ ...f, skuId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select SKU" /></SelectTrigger>
                <SelectContent>{skus.map((s) => <SelectItem key={s.id} value={s.id}>{s.code} — {s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Material Type</Label><Input value={editForm.materialType} onChange={set("materialType")} /></div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5"><Label>Quantity</Label><Input type="number" value={editForm.quantity} onChange={set("quantity")} /></div>
              <div className="space-y-1.5"><Label>Rate (₹)</Label><Input type="number" step="0.01" value={editForm.rate} onChange={set("rate")} /></div>
              <div className="space-y-1.5">
                <Label>GST Rate</Label>
                <Select value={String(editForm.gstRate)} onValueChange={(v) => setEditForm((f) => ({ ...f, gstRate: Number(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GST_RATES.map((g) => <SelectItem key={g} value={String(g)}>{g}%</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {(() => {
              const subtotal   = Number(editForm.quantity) * Number(editForm.rate);
              const gstAmt     = Math.round(subtotal * Number(editForm.gstRate) / 100 * 100) / 100;
              const grandTotal = subtotal + gstAmt;
              return (
                <div className="rounded-lg border bg-muted/40 p-3 text-xs space-y-1.5">
                  <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span className="tabular-nums">₹{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                  <div className="flex justify-between text-muted-foreground"><span>GST @ {editForm.gstRate}%</span><span className="tabular-nums">₹{gstAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                  <div className="flex justify-between border-t pt-1.5 font-semibold text-sm"><span>Grand Total</span><span className="tabular-nums">₹{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                </div>
              );
            })()}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Dispatch Date</Label><Input type="date" value={editForm.dispatchDate} onChange={set("dispatchDate")} /></div>
              <div className="space-y-1.5"><Label>Expected Delivery</Label><Input type="date" value={editForm.expectedDelivery} onChange={set("expectedDelivery")} /></div>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={editForm.status} onValueChange={(v) => setEditForm((f) => ({ ...f, status: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PO_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Payment Due (₹)</Label><Input type="number" step="0.01" placeholder="Leave blank if none" value={editForm.paymentDue} onChange={set("paymentDue")} /></div>
            <div className="space-y-1.5"><Label>Notes</Label><Input placeholder="Optional notes" value={editForm.notes} onChange={set("notes")} /></div>
          </div>
          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={editSaving}>{editSaving ? "Saving…" : "Save changes"}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
