import { PageSkeleton } from "@/components/page-skeleton";
import { createFileRoute, Link, useRouter, useNavigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { api, type ApiPo } from "@/lib/api";
import { fmtDate, DEFAULT_PO_TERMS } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Mail, Eye } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/purchase-orders/")({
  loader: async () => {
    if (typeof window === "undefined") return null;
    const [purchaseOrders, vendors, skus] = await Promise.all([
      api.purchaseOrders.list(),
      api.vendors.list(),
      api.skus.list(),
    ]);
    return { purchaseOrders, vendors, skus };
  },
  pendingComponent: PageSkeleton,
  component: POPage,
  head: () => ({ meta: [{ title: "Purchase Orders — Zoobalo" }] }),
});

const PO_STATUSES = ["To be sent", "Sent", "Pending", "Approved", "In Production", "Dispatched", "Delivered", "Delayed"] as const;

const GST_RATES = [0, 5, 12, 18, 28] as const;

const EMPTY_FORM = {
  poNumber: "", vendorId: "", skuId: "", materialType: "", quantity: 1000,
  rate: 0, gstRate: 18, gstAmount: 0, total: 0,
  dispatchDate: "", expectedDelivery: "",
  status: "Pending" as typeof PO_STATUSES[number],
  paymentDue: "", amountPaid: "", paymentDueDate: "", notes: "", terms: "",
};

function POPage() {
  const loaderData = Route.useLoaderData();
  if (!loaderData) return <PageSkeleton />;
  return <POContent purchaseOrders={loaderData.purchaseOrders} vendors={loaderData.vendors} skus={loaderData.skus} />;
}

function POContent({ purchaseOrders, vendors, skus }: {
  purchaseOrders: Awaited<ReturnType<typeof api.purchaseOrders.list>>;
  vendors: Awaited<ReturnType<typeof api.vendors.list>>;
  skus: Awaited<ReturnType<typeof api.skus.list>>;
}) {
  const router   = useRouter();
  const navigate = useNavigate();

  const [editTarget, setEditTarget] = useState<ApiPo | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ ...EMPTY_FORM });

  const openEdit = (po: ApiPo) => {
    setEditForm({
      poNumber: po.poNumber,
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
      amountPaid: po.amountPaid != null ? String(po.amountPaid) : "",
      paymentDueDate: po.paymentDueDate ?? "",
      notes: po.notes ?? "",
      terms: po.terms ?? DEFAULT_PO_TERMS,
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
        amountPaid: editForm.amountPaid ? Number(editForm.amountPaid) as any : null,
        paymentDueDate: editForm.paymentDueDate || null,
        notes: editForm.notes || null,
        terms: editForm.terms || null,
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

  const handleSendExisting = async () => {
    if (!editTarget) return;
    setSendingId(editTarget.id);
    try {
      await api.purchaseOrders.update(editTarget.id, { status: "Sent" } as any);
      toast.success(`PO ${editTarget.poNumber} marked as sent.`);
      setEditTarget(null);
      await router.invalidate();
    } catch {
      toast.error("Failed to update PO status.");
    } finally {
      setSendingId(null);
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

  const [q, setQ] = useState("");

  const set = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setEditForm((p) => ({ ...p, [f]: e.target.value }));

  const filtered = purchaseOrders.filter((p) => {
    if (!q.trim()) return true;
    const needle = q.toLowerCase();
    return p.poNumber.toLowerCase().includes(needle) || p.materialType.toLowerCase().includes(needle) || (p.vendor?.name ?? "").toLowerCase().includes(needle) || (p.sku?.code ?? "").toLowerCase().includes(needle);
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchase Orders"
        description={`${purchaseOrders.length} POs across all vendors and SKUs`}
        actions={<Button asChild><Link to="/purchase-orders/new"><Plus className="mr-1.5 h-4 w-4" />Create PO</Link></Button>}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-8">
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

      <div className="relative max-w-sm">
        <svg className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg>
        <Input placeholder="Search POs…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" />
      </div>

      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">No purchase orders found.</div>
        )}
        {filtered.map((po) => {
          const paid    = po.amountPaid ?? 0;
          const pending = Math.max(0, po.total - paid);
          const fmt     = (n: number) => `₹${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
          return (
            <div key={po.id} className="rounded-xl border bg-card p-4 space-y-3">
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold">{po.poNumber}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{fmtDate(po.dispatchDate)} · {po.vendor?.name}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge status={po.status} />
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="View PO" onClick={() => navigate({ to: "/purchase-orders/$poId", params: { poId: po.id } })}><Eye className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(po)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => handleDelete(po)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>

              {/* Order details */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs sm:grid-cols-4">
                <div><div className="text-muted-foreground">SKU</div><div className="font-medium">{po.sku?.code ?? "—"}</div></div>
                <div><div className="text-muted-foreground">Material</div><div className="font-medium">{po.materialType}</div></div>
                <div><div className="text-muted-foreground">Quantity</div><div className="font-medium tabular-nums">{po.quantity.toLocaleString()}</div></div>
                <div><div className="text-muted-foreground">Rate / unit</div><div className="font-medium tabular-nums">₹{po.rate}</div></div>
              </div>

              {/* Pricing */}
              <div className="grid grid-cols-3 gap-x-6 gap-y-2 text-xs border-t pt-3 sm:grid-cols-4">
                <div><div className="text-muted-foreground">GST ({po.gstRate ?? 0}%)</div><div className="font-medium tabular-nums">{fmt(po.gstAmount ?? 0)}</div></div>
                <div><div className="text-muted-foreground">Grand Total</div><div className="font-semibold tabular-nums">{fmt(po.total)}</div></div>
                <div><div className="text-muted-foreground">Expected delivery</div><div className="font-medium">{fmtDate(po.expectedDelivery)}</div></div>
                <div className="hidden sm:block"><div className="text-muted-foreground">Notes</div><div className="font-medium truncate max-w-[160px]">{po.notes || "—"}</div></div>
              </div>

              {/* Payment tracking — show when payment data exists */}
              {(po.status !== "To be sent" && (Number(po.amountPaid) > 0 || po.paymentDue != null || po.paymentDueDate != null)) && (
                <div className="grid grid-cols-3 gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-xs">
                  <div>
                    <div className="text-muted-foreground mb-0.5">Amount Paid</div>
                    <div className="font-semibold tabular-nums text-success">{fmt(paid)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground mb-0.5">Amount Pending</div>
                    <div className={`font-semibold tabular-nums ${pending > 0 ? "text-destructive" : "text-success"}`}>{fmt(pending)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground mb-0.5">Pay by Date</div>
                    <div className="font-semibold">{fmtDate(po.paymentDueDate)}</div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Edit PO Sheet ── */}
      <Sheet open={!!editTarget} onOpenChange={(v) => { if (!v) setEditTarget(null); }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader><SheetTitle>Edit PO — {editTarget?.poNumber}</SheetTitle></SheetHeader>
          <div className="mt-6 grid grid-cols-1 gap-4">
            <div className="space-y-1.5">
              <Label>PO Number</Label>
              <Input value={editForm.poNumber} onChange={set("poNumber")} placeholder="e.g. PO-20260520-1234" />
            </div>
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            {(() => {
              const total   = Number(editForm.quantity) * Number(editForm.rate) * (1 + Number(editForm.gstRate) / 100);
              const paid    = Number(editForm.amountPaid) || 0;
              const pending = Math.max(0, total - paid);
              const fmt     = (n: number) => `₹${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
              return (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">Payment Tracking</p>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Amount Paid (₹)</Label>
                      <Input type="number" step="0.01" min="0" placeholder="0.00" value={editForm.amountPaid} onChange={set("amountPaid")} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Amount Pending (₹)</Label>
                      <div className={`flex h-9 items-center rounded-md border px-3 text-sm tabular-nums font-medium ${pending > 0 ? "border-destructive/40 bg-destructive/5 text-destructive" : "border-success/40 bg-success/5 text-success"}`}>
                        {fmt(pending)}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Due Date for Pending Payment</Label>
                    <Input type="date" value={editForm.paymentDueDate} onChange={set("paymentDueDate")} />
                  </div>
                  <div className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground grid grid-cols-3 gap-2">
                    <div><span className="block font-medium text-foreground">{fmt(total)}</span>Grand Total</div>
                    <div><span className="block font-medium text-foreground">{fmt(paid)}</span>Paid</div>
                    <div><span className={`block font-medium ${pending > 0 ? "text-destructive" : "text-success"}`}>{fmt(pending)}</span>Pending</div>
                  </div>
                </div>
              );
            })()}
            <div className="space-y-1.5"><Label>Notes</Label><Input placeholder="Optional notes" value={editForm.notes} onChange={set("notes")} /></div>
            <div className="space-y-1.5">
              <Label>Terms & Conditions</Label>
              <Textarea rows={8} className="font-mono text-xs" placeholder="Enter terms and conditions…" value={editForm.terms} onChange={set("terms")} />
            </div>
          </div>
          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
            {editTarget?.status === "To be sent" && (
              <Button variant="secondary" onClick={handleSendExisting} disabled={!!sendingId}>
                <Mail className="mr-1.5 h-3.5 w-3.5" />
                {sendingId ? "Sending…" : "Send to vendor"}
              </Button>
            )}
            <Button onClick={saveEdit} disabled={editSaving}>{editSaving ? "Saving…" : "Save changes"}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
