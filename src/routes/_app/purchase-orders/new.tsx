import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { fmtDate, DEFAULT_PO_TERMS } from "@/lib/utils";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, type ApiProductionRemark } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Check, ChevronLeft, ChevronRight, Mail, MessageSquareWarning } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/purchase-orders/new")({
  loader: async () => {
    const [skus, vendors, remarks] = await Promise.all([api.skus.list(), api.vendors.list(), api.productionRemarks.list()]);
    return { skus, vendors, remarks };
  },
  component: NewPOWizard,
  head: () => ({ meta: [{ title: "Create Purchase Order — Zoobalo" }] }),
});

const steps = ["SKU & Material", "Vendor", "Quantity & Pricing", "Delivery", "Terms & Conditions", "Review & Send"] as const;


function genPoNumber() {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rnd = Math.floor(Math.random() * 9000 + 1000);
  return `PO-${ymd}-${rnd}`;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function NewPOWizard() {
  const navigate = useNavigate();
  const { skus, vendors, remarks } = Route.useLoaderData();

  const [step, setStep] = useState(0);
  const [poNumber, setPoNumber] = useState(genPoNumber);
  const [poDate, setPoDate] = useState(todayStr);
  const [skuId, setSkuId]     = useState(skus[0]?.id ?? "");
  const [material, setMaterial] = useState("Aluminium Can");
  const [vendorId, setVendorId] = useState(vendors[0]?.id ?? "");
  const [qty, setQty]     = useState(10000);
  const [rate, setRate]   = useState(28.5);
  const [gstRate, setGstRate] = useState(18);
  const [eta, setEta]     = useState("2026-05-15");
  const [notes, setNotes] = useState("Please ensure batch certificates are sent along with dispatch.");
  const [terms, setTerms] = useState(DEFAULT_PO_TERMS);
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [remarksOpen, setRemarksOpen] = useState(false);

  const next = () => {
    if (step === 0 && !poNumber.trim()) { toast.error("PO Number is required."); return; }
    if (step === 0 && !poDate) { toast.error("PO Date is required."); return; }
    setStep((s) => Math.min(s + 1, steps.length - 1));
  };
  const prev = () => setStep((s) => Math.max(s - 1, 0));

  const sku    = skus.find((s) => s.id === skuId);
  const vendor = vendors.find((v) => v.id === vendorId);

  const buildPayload = (status: string) => {
    const subtotal   = qty * rate;
    const gstAmt     = Math.round(subtotal * gstRate / 100 * 100) / 100;
    const grandTotal = subtotal + gstAmt;
    return {
      id:               crypto.randomUUID(),
      poNumber,
      vendorId,
      skuId,
      materialType:     material,
      quantity:         qty,
      rate:             rate as any,
      gstRate,
      gstAmount:        gstAmt as any,
      total:            grandTotal as any,
      dispatchDate:     poDate,
      expectedDelivery: eta,
      status,
      notes:            notes || null,
      terms:            terms || null,
    };
  };

  const handleSend = async () => {
    setSubmitting(true);
    try {
      await api.purchaseOrders.create(buildPayload("Sent") as any);
      toast.success(`PO ${poNumber} sent to ${vendor?.email ?? "vendor"}.`);
      navigate({ to: "/purchase-orders" });
    } catch {
      toast.error("Failed to send purchase order.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.purchaseOrders.create(buildPayload("To be sent") as any);
      toast.success(`PO ${poNumber} saved. Not yet sent to vendor.`);
      navigate({ to: "/purchase-orders" });
    } catch {
      toast.error("Failed to save purchase order.");
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = () => {
    const subtotal   = qty * rate;
    const gstAmt     = Math.round(subtotal * gstRate / 100 * 100) / 100;
    const grandTotal = subtotal + gstAmt;
    const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${poNumber}</title>
<style>
  body{font-family:Arial,sans-serif;max-width:800px;margin:40px auto;padding:20px;color:#333}
  .header{display:flex;justify-content:space-between;margin-bottom:32px}
  .po-title{font-size:28px;font-weight:bold}
  .section{margin-bottom:24px}
  .section-title{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#666;border-bottom:1px solid #eee;padding-bottom:4px;margin-bottom:10px}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:20px}
  dt{font-size:11px;color:#666;margin-bottom:2px}
  dd{font-size:14px;margin:0 0 8px}
  table{width:100%;border-collapse:collapse}
  th{background:#f5f5f5;text-align:left;padding:8px 12px;font-size:11px;text-transform:uppercase}
  td{padding:8px 12px;border-bottom:1px solid #eee;font-size:13px}
  .tr{text-align:right}
  .total td{font-weight:bold;border-top:2px solid #333;border-bottom:none}
  .terms{font-size:12px;line-height:1.7;white-space:pre-line;color:#555}
  @media print{body{margin:10px}}
</style></head><body>
<div class="header">
  <div><div class="po-title">PURCHASE ORDER</div><div style="color:#666;margin-top:4px">${poNumber} &nbsp;·&nbsp; ${fmtDate(poDate)}</div></div>
  <div style="text-align:right"><div style="font-weight:bold;font-size:20px">Zoobalo</div></div>
</div>
<div class="grid2 section">
  <div>
    <div class="section-title">Vendor</div>
    <dl><dt>Company</dt><dd>${vendor?.name ?? ""}</dd><dt>Contact</dt><dd>${vendor?.contactPerson ?? ""}</dd><dt>Email</dt><dd>${vendor?.email ?? ""}</dd></dl>
  </div>
  <div>
    <div class="section-title">Order Details</div>
    <dl><dt>SKU</dt><dd>${sku?.code ?? ""} — ${sku?.name ?? ""}</dd><dt>Material</dt><dd>${material}</dd><dt>Expected Delivery</dt><dd>${fmtDate(eta)}</dd></dl>
  </div>
</div>
<div class="section">
  <div class="section-title">Pricing</div>
  <table>
    <tr><th>Description</th><th class="tr">Qty</th><th class="tr">Rate (₹)</th><th class="tr">Amount (₹)</th></tr>
    <tr><td>${material}</td><td class="tr">${qty.toLocaleString()}</td><td class="tr">₹${rate}</td><td class="tr">₹${fmt(subtotal)}</td></tr>
    <tr><td colspan="3" class="tr" style="color:#666">GST @ ${gstRate}%</td><td class="tr">₹${fmt(gstAmt)}</td></tr>
    <tr class="total"><td colspan="3" class="tr">Grand Total</td><td class="tr">₹${fmt(grandTotal)}</td></tr>
  </table>
</div>
${notes ? `<div class="section"><div class="section-title">Notes</div><p style="font-size:13px;color:#444">${notes}</p></div>` : ""}
<div class="section"><div class="section-title">Terms &amp; Conditions</div><p class="terms">${terms.replace(/</g, "&lt;")}</p></div>
</body></html>`;
    const win = window.open("", "_blank");
    if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 300); }
  };

  return (
    <div className="space-y-6">
      {(() => {
        const activeRemarks = remarks.filter((r) => r.status !== "Resolved");
        const skuRemarks    = activeRemarks.filter((r) => r.skuId === skuId);
        const count = activeRemarks.length;
        return (
          <PageHeader
            title="Create Purchase Order"
            description="Multi-step PO creation with vendor selection and email send"
            actions={
              <Button variant="outline" onClick={() => setRemarksOpen(true)} className="relative">
                <MessageSquareWarning className="mr-1.5 h-4 w-4" />
                Production Remarks
                {count > 0 && (
                  <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-[11px] font-semibold text-white">
                    {count}
                  </span>
                )}
              </Button>
            }
          />
        );
      })()}

      <ol className="grid grid-cols-2 gap-2 md:grid-cols-5">
        {steps.map((label, i) => (
          <li key={label} className={cn("flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-xs", i === step && "border-primary bg-primary/5", i < step && "border-success/40 bg-success/5")}>
            <span className={cn("flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-semibold", i < step ? "border-success bg-success text-success-foreground" : i === step ? "border-primary text-primary" : "border-border text-muted-foreground")}>
              {i < step ? <Check className="h-3 w-3" /> : i + 1}
            </span>
            <span className={i === step ? "font-medium" : "text-muted-foreground"}>{label}</span>
          </li>
        ))}
      </ol>

      <div className="rounded-xl border bg-card p-6">
        {step === 0 && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>PO Number *</Label>
              <Input value={poNumber} onChange={(e) => setPoNumber(e.target.value)} placeholder="e.g. PO-20260520-4321" />
            </div>
            <div className="space-y-1.5">
              <Label>PO Date *</Label>
              <Input type="date" value={poDate} onChange={(e) => setPoDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>SKU</Label>
              <Select value={skuId} onValueChange={setSkuId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {skus.map((s) => <SelectItem key={s.id} value={s.id}>{s.code} — {s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Material type</Label>
              <Input value={material} onChange={(e) => setMaterial(e.target.value)} placeholder="e.g. Aluminium Can" />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            <Label>Select vendor</Label>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {vendors.slice(0, 6).map((v) => (
                <button
                  key={v.id}
                  onClick={() => setVendorId(v.id)}
                  className={cn("rounded-lg border bg-background p-4 text-left transition-all hover:border-primary", vendorId === v.id && "border-primary ring-2 ring-primary/20")}
                >
                  <div className="font-medium">{v.name}</div>
                  <div className="text-xs text-muted-foreground">{v.materials.join(", ")} · Lead {v.leadTimeDays}d · Rating {v.rating}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (() => {
          const subtotal = qty * rate;
          const gstAmt   = Math.round(subtotal * gstRate / 100 * 100) / 100;
          const grandTotal = subtotal + gstAmt;
          return (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Quantity</Label>
                  <Input type="number" value={qty} onChange={(e) => setQty(+e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Rate per unit (₹)</Label>
                  <Input type="number" step="0.01" value={rate} onChange={(e) => setRate(+e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>GST Rate</Label>
                  <Select value={String(gstRate)} onValueChange={(v) => setGstRate(Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[0, 5, 12, 18, 28].map((g) => (
                        <SelectItem key={g} value={String(g)}>{g}%{g === 18 ? " (Standard)" : g === 28 ? " (Luxury)" : g === 0 ? " (Exempt)" : ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="rounded-lg border bg-muted/40 p-4 text-sm space-y-2">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal ({qty.toLocaleString()} × ₹{rate})</span>
                  <span className="tabular-nums">₹{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>GST @ {gstRate}%</span>
                  <span className="tabular-nums">₹{gstAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between border-t pt-2 font-semibold">
                  <span>Grand Total</span>
                  <span className="tabular-nums">₹{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          );
        })()}

        {step === 3 && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5"><Label>Expected delivery date</Label><Input type="date" value={eta} onChange={(e) => setEta(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Delivery address</Label><Input defaultValue="Zoobalo Warehouse, Andheri MIDC, Mumbai" /></div>
            <div className="md:col-span-2 space-y-1.5"><Label>Notes to vendor</Label><Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Terms & Conditions</Label>
              <p className="text-xs text-muted-foreground">These terms will be included in the purchase order sent to the vendor. Edit as needed.</p>
              <Textarea rows={10} value={terms} onChange={(e) => setTerms(e.target.value)} className="font-mono text-xs" />
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-background p-4 text-sm">
              <h4 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">PO Summary</h4>
              <dl className="grid grid-cols-2 gap-3">
                <div><dt className="text-xs text-muted-foreground">PO Number</dt><dd className="font-semibold">{poNumber}</dd></div>
                <div><dt className="text-xs text-muted-foreground">PO Date</dt><dd>{fmtDate(poDate)}</dd></div>
                <div><dt className="text-xs text-muted-foreground">SKU</dt><dd>{sku?.code} — {sku?.name}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Material</dt><dd>{material}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Vendor</dt><dd>{vendor?.name}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Vendor email</dt><dd>{vendor?.email}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Quantity</dt><dd className="tabular-nums">{qty.toLocaleString()}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Rate / unit</dt><dd className="tabular-nums">₹{rate}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Subtotal</dt><dd className="tabular-nums">₹{(qty * rate).toLocaleString()}</dd></div>
                <div><dt className="text-xs text-muted-foreground">GST ({gstRate}%)</dt><dd className="tabular-nums">₹{(Math.round(qty * rate * gstRate / 100 * 100) / 100).toLocaleString()}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Grand Total</dt><dd className="tabular-nums font-semibold">₹{(qty * rate + Math.round(qty * rate * gstRate / 100 * 100) / 100).toLocaleString()}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Expected delivery</dt><dd>{fmtDate(eta)}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Payment terms</dt><dd>{vendor?.paymentTerms}</dd></div>
              </dl>
            </div>
            <div className="rounded-lg border bg-background p-4 text-sm">
              <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Terms & Conditions</h4>
              <p className="whitespace-pre-line text-xs text-muted-foreground">{terms}</p>
            </div>
            <div className="rounded-lg border bg-muted/40 p-4">
              <div className="flex items-center gap-2 text-sm font-medium"><Mail className="h-4 w-4" />Email preview</div>
              <p className="mt-2 text-xs text-muted-foreground">To: {vendor?.email}</p>
              <p className="text-xs text-muted-foreground">Subject: Purchase Order — {sku?.code} {material} — Qty {qty.toLocaleString()}</p>
              <p className="mt-3 text-sm whitespace-pre-line">Hi {vendor?.contactPerson},{"\n\n"}Please find our PO for {qty.toLocaleString()} units of {material} for SKU {sku?.code} at ₹{rate}/unit (subtotal ₹{(qty * rate).toLocaleString()}, GST @{gstRate}% ₹{(Math.round(qty * rate * gstRate / 100 * 100) / 100).toLocaleString()}, grand total ₹{(qty * rate + Math.round(qty * rate * gstRate / 100 * 100) / 100).toLocaleString()}). Expected delivery by ${fmtDate(eta)}.{"\n\n"}{notes}{"\n\n"}Regards,{"\n"}Zoobalo Procurement</p>
            </div>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between border-t pt-4">
          <Button variant="ghost" onClick={prev} disabled={step === 0}>
            <ChevronLeft className="mr-1 h-4 w-4" />Back
          </Button>
          {step < steps.length - 1 ? (
            <Button onClick={next}>Next<ChevronRight className="ml-1 h-4 w-4" /></Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleDownload} type="button">
                Download
              </Button>
              <Button variant="outline" onClick={handleSave} disabled={saving || submitting}>
                {saving ? "Saving…" : "Save"}
              </Button>
              <Button onClick={handleSend} disabled={submitting || saving}>
                <Mail className="mr-1.5 h-4 w-4" />
                {submitting ? "Sending…" : "Send PO to vendor"}
              </Button>
            </div>
          )}
        </div>
      </div>
      {/* Production Remarks Dialog */}
      <Dialog open={remarksOpen} onOpenChange={setRemarksOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Production Remarks</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-1">Reminders to convey to the vendor when raising this PO. Resolved remarks are hidden.</p>
          <div className="overflow-y-auto flex-1 space-y-3 pr-1">
            {(() => {
              const active = remarks.filter((r) => r.status !== "Resolved");
              if (active.length === 0) return (
                <p className="py-8 text-center text-sm text-muted-foreground">No active remarks.</p>
              );
              const forThisSku  = active.filter((r) => r.skuId === skuId);
              const forOtherSku = active.filter((r) => r.skuId !== skuId);
              const STATUS_STYLES: Record<string, string> = {
                Active:   "bg-amber-100 text-amber-800 border-amber-200",
                Conveyed: "bg-blue-100 text-blue-800 border-blue-200",
              };
              const renderRemark = (r: ApiProductionRemark) => (
                <div key={r.id} className="rounded-lg border bg-card p-3 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    {r.skuName && <span className="text-xs font-semibold">{r.skuName}</span>}
                    {r.skuCode && <span className="text-xs text-muted-foreground">{r.skuCode}</span>}
                    {r.materialType !== "None" && (
                      <span className="text-[11px] rounded-full border px-2 py-0.5 text-muted-foreground">{r.materialType}</span>
                    )}
                    <span className={`ml-auto text-[11px] rounded-full border px-2 py-0.5 font-medium ${STATUS_STYLES[r.status] ?? ""}`}>{r.status}</span>
                  </div>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{r.remark}</p>
                </div>
              );
              return (
                <>
                  {forThisSku.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">For this SKU ({skus.find((s) => s.id === skuId)?.name ?? "—"})</p>
                      {forThisSku.map(renderRemark)}
                    </div>
                  )}
                  {forOtherSku.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{forThisSku.length > 0 ? "Other remarks" : "All remarks"}</p>
                      {forOtherSku.map(renderRemark)}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
