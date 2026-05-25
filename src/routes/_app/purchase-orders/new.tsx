import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { fmtDate, DEFAULT_PO_TERMS } from "@/lib/utils";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, type ApiProductionRemark, type POLineItem } from "@/lib/api";
import { PRODUCTION_STAGES } from "@/lib/mock/types";
import { PODocument, buildPoHtml } from "@/components/po-document";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Check, ChevronLeft, ChevronRight, Mail, MessageSquareWarning, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/purchase-orders/new")({
  loader: async () => {
    const [skus, vendors, manufacturers, remarks, pos] = await Promise.all([
      api.skus.list(), api.vendors.list(), api.manufacturers.list(),
      api.productionRemarks.list(), api.purchaseOrders.list(),
    ]);
    return { skus, vendors, manufacturers, remarks, pos };
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

type SkuDefaults = {
  material: string; category: "RM" | "PM" | "FG";
  partyType: "vendor" | "manufacturer"; vendorId: string; manufacturerId: string;
  lineItems: Array<{ description: string; qty: number; rate: number; gstRate: number }>;
  eta: string; deliveryAddress: string; notes: string; terms: string;
};

function getSkuDefaults(
  skuId: string,
  skus: Awaited<ReturnType<typeof api.skus.list>>,
  pos: Awaited<ReturnType<typeof api.purchaseOrders.list>>,
  vendors: Awaited<ReturnType<typeof api.vendors.list>>,
  manufacturers: Awaited<ReturnType<typeof api.manufacturers.list>>,
): SkuDefaults {
  const sku    = skus.find(s => s.id === skuId);
  const lastPo = pos
    .filter(p => p.skuId === skuId)
    .sort((a, b) => b.dispatchDate.localeCompare(a.dispatchDate))[0];

  // Compute a suggested ETA: re-use the lead-time offset from the last PO,
  // anchored to today rather than the old dispatch date.
  let eta = todayStr();
  if (lastPo?.dispatchDate && lastPo?.expectedDelivery) {
    const leadDays = Math.round(
      (Date.parse(lastPo.expectedDelivery) - Date.parse(lastPo.dispatchDate)) / 86_400_000
    );
    if (leadDays > 0) {
      const d = new Date();
      d.setDate(d.getDate() + leadDays);
      eta = d.toISOString().slice(0, 10);
    }
  }

  return {
    material:        lastPo?.materialType ?? "Aluminium Can",
    category:        ((lastPo?.category ?? "PM") as "RM" | "PM" | "FG"),
    partyType:       lastPo?.vendorId ? "vendor" : "manufacturer",
    vendorId:        lastPo?.vendorId ?? vendors[0]?.id ?? "",
    manufacturerId:  lastPo?.manufacturerId ?? sku?.manufacturerId ?? manufacturers[0]?.id ?? "",
    lineItems:       lastPo?.items?.length
      ? lastPo.items.map(i => ({ description: i.description, qty: i.quantity, rate: i.rate, gstRate: i.gstRate }))
      : [{ description: "Aluminium Can", qty: 10000, rate: 28.5, gstRate: 18 }],
    eta,
    deliveryAddress: lastPo?.deliveryAddress ?? "",
    notes:           lastPo?.notes ?? "Please ensure batch certificates are sent along with dispatch.",
    terms:           lastPo?.terms ?? DEFAULT_PO_TERMS,
  };
}

function NewPOWizard() {
  const navigate = useNavigate();
  const { skus, vendors, manufacturers, remarks, pos } = Route.useLoaderData();

  const initId = skus[0]?.id ?? "";
  const initD  = getSkuDefaults(initId, skus, pos, vendors, manufacturers);

  const [step, setStep] = useState(0);
  const [poNumber, setPoNumber] = useState(genPoNumber);
  const [poDate, setPoDate] = useState(todayStr);
  const [skuId, setSkuId]         = useState(initId);
  const [material, setMaterial]   = useState(initD.material);
  const [category, setCategory]   = useState<"RM" | "PM" | "FG">(initD.category);
  const [partyType, setPartyType] = useState<"vendor" | "manufacturer">(initD.partyType);
  const [vendorId, setVendorId]   = useState(initD.vendorId);
  const [manufacturerId, setManufacturerId] = useState(initD.manufacturerId);
  const [lineItems, setLineItems] = useState(initD.lineItems);
  const [eta, setEta]             = useState(initD.eta);
  const [deliveryAddress, setDeliveryAddress] = useState(initD.deliveryAddress);
  const [notes, setNotes] = useState(initD.notes);
  const [terms, setTerms] = useState(initD.terms);
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [remarksOpen, setRemarksOpen] = useState(false);

  const setItem = (idx: number, field: string, value: string | number) =>
    setLineItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));

  const addItem = () =>
    setLineItems(prev => [...prev, { description: "", qty: 1000, rate: 0, gstRate: 18 }]);

  const removeItem = (idx: number) =>
    setLineItems(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev);

  const handleSkuChange = (newSkuId: string) => {
    setSkuId(newSkuId);
    const d = getSkuDefaults(newSkuId, skus, pos, vendors, manufacturers);
    setMaterial(d.material);
    setCategory(d.category);
    setPartyType(d.partyType);
    setVendorId(d.vendorId);
    setManufacturerId(d.manufacturerId);
    setLineItems(d.lineItems);
    setEta(d.eta);
    setDeliveryAddress(d.deliveryAddress);
    setNotes(d.notes);
    setTerms(d.terms);
    if (pos.some(p => p.skuId === newSkuId)) {
      toast.info("Details auto-filled from last PO for this SKU.");
    }
  };

  const computedItems: POLineItem[] = lineItems.map(item => {
    const subtotal  = item.qty * item.rate;
    const gstAmount = Math.round(subtotal * item.gstRate / 100 * 100) / 100;
    return { description: item.description, quantity: item.qty, rate: item.rate, gstRate: item.gstRate, subtotal, gstAmount, total: subtotal + gstAmount };
  });
  const grandTotal   = computedItems.reduce((s, r) => s + r.total, 0);
  const totalGst     = computedItems.reduce((s, r) => s + r.gstAmount, 0);
  const totalSubtotal = computedItems.reduce((s, r) => s + r.subtotal, 0);

  const next = () => {
    if (step === 0 && !poNumber.trim()) { toast.error("PO Number is required."); return; }
    if (step === 0 && !poDate) { toast.error("PO Date is required."); return; }
    setStep((s) => Math.min(s + 1, steps.length - 1));
  };
  const prev = () => setStep((s) => Math.max(s - 1, 0));

  const sku          = skus.find((s) => s.id === skuId);
  const vendor       = partyType === "vendor" ? vendors.find((v) => v.id === vendorId) : undefined;
  const manufacturer = partyType === "manufacturer" ? manufacturers.find((m) => m.id === manufacturerId) : undefined;
  // Unified party object for PODocument display
  const partyForDoc  = vendor ?? (manufacturer ? { ...manufacturer, address: manufacturer.location, city: manufacturer.city ?? manufacturer.location } : undefined);

  const buildPayload = (status: string) => ({
    id:               crypto.randomUUID(),
    poNumber,
    vendorId:         partyType === "vendor" ? vendorId : null,
    manufacturerId:   partyType === "manufacturer" ? manufacturerId : null,
    skuId,
    materialType:     material,
    category,
    quantity:         computedItems.reduce((s, r) => s + r.quantity, 0),
    rate:             (lineItems[0]?.rate ?? 0) as any,
    gstRate:          lineItems[0]?.gstRate ?? 18,
    gstAmount:        totalGst as any,
    total:            grandTotal as any,
    items:            computedItems as any,
    deliveryAddress:  deliveryAddress || null,
    dispatchDate:     poDate,
    expectedDelivery: eta,
    status,
    notes:            notes || null,
    terms:            terms || null,
  });

  const createBatchFromPo = async () => {
    try {
      await api.production.create({
        id:                 crypto.randomUUID(),
        batchNumber:        `BATCH-${poNumber}`,
        skuId,
        manufacturerId:     sku?.manufacturerId ?? "",
        vendorId:           vendorId || null,
        quantity:           computedItems.reduce((s, r) => s + r.quantity, 0),
        currentStage:       "PO Generated",
        startedAt:          poDate,
        expectedCompletion: eta,
        delayed:            false,
        applicableStages:   [...PRODUCTION_STAGES] as any,
        materialCategory:   null,
        materialItemId:     null,
        materialItemName:   null,
        comment:            `Auto-created from PO ${poNumber}`,
      } as any);
      toast.success("Production batch created automatically.");
    } catch {
      toast("Production batch could not be auto-created — add it manually in the SKU's Production tab.", { duration: 5000 });
    }
  };

  const handleSend = async () => {
    setSubmitting(true);
    try {
      await api.purchaseOrders.create(buildPayload("Sent") as any);
      toast.success(`PO ${poNumber} sent to ${partyForDoc?.name ?? "party"}.`);
      await createBatchFromPo();
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
      await createBatchFromPo();
      navigate({ to: "/purchase-orders" });
    } catch {
      toast.error("Failed to save purchase order.");
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = () => {
    const html = buildPoHtml({
      poNumber, poDate, materialType: material,
      quantity: computedItems.reduce((s, r) => s + r.quantity, 0),
      rate: lineItems[0]?.rate ?? 0,
      gstRate: lineItems[0]?.gstRate ?? 18,
      gstAmount: totalGst, total: grandTotal,
      items: computedItems, category, deliveryAt: deliveryAddress, notes, terms, vendor: partyForDoc as any, sku,
    });
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
              <Select value={skuId} onValueChange={handleSkuChange}>
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
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PM">PM — Packaging Material</SelectItem>
                  <SelectItem value="RM">RM — Raw Material</SelectItem>
                  <SelectItem value="FG">FG — Finished Goods</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            {/* Party type toggle */}
            <div className="flex rounded-lg border bg-muted/40 p-1 w-fit gap-1">
              {(["vendor", "manufacturer"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setPartyType(type)}
                  className={cn(
                    "rounded-md px-4 py-1.5 text-sm font-medium capitalize transition-all",
                    partyType === type ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {type === "vendor" ? "Vendor" : "Manufacturer"}
                </button>
              ))}
            </div>

            {partyType === "vendor" && (
              <div className="space-y-3">
                <Label className="text-xs text-muted-foreground">Select vendor</Label>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {vendors.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => setVendorId(v.id)}
                      className={cn("rounded-lg border bg-background p-4 text-left transition-all hover:border-primary", vendorId === v.id && "border-primary ring-2 ring-primary/20")}
                    >
                      <div className="font-medium">{v.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{v.contactPerson}{v.mobile ? ` · ${v.mobile}` : ""}</div>
                      {(v.address || v.city) && <div className="text-xs text-muted-foreground mt-0.5">{[v.address, v.city].filter(Boolean).join(", ")}</div>}
                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                        {v.gst && <span><span className="text-muted-foreground">GST </span><span className="font-mono">{v.gst}</span></span>}
                        {v.pan && <span><span className="text-muted-foreground">PAN </span><span className="font-mono uppercase">{v.pan}</span></span>}
                      </div>
                      <div className="mt-1.5 text-xs text-muted-foreground">{v.materials.join(", ")} · Lead {v.leadTimeDays}d · Rating {v.rating}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {partyType === "manufacturer" && (
              <div className="space-y-3">
                <Label className="text-xs text-muted-foreground">Select manufacturer</Label>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {manufacturers.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setManufacturerId(m.id)}
                      className={cn("rounded-lg border bg-background p-4 text-left transition-all hover:border-primary", manufacturerId === m.id && "border-primary ring-2 ring-primary/20")}
                    >
                      <div className="font-medium">{m.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{m.contactPerson}{m.mobile ? ` · ${m.mobile}` : ""}</div>
                      {(m.location || m.city) && <div className="text-xs text-muted-foreground mt-0.5">{[m.location, m.city].filter(Boolean).join(", ")}</div>}
                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                        {m.gst && <span><span className="text-muted-foreground">GST </span><span className="font-mono">{m.gst}</span></span>}
                        {m.pan && <span><span className="text-muted-foreground">PAN </span><span className="font-mono uppercase">{m.pan}</span></span>}
                      </div>
                      <div className="mt-1.5 text-xs text-muted-foreground">Lead {m.leadTimeDays}d · Rating {m.rating} · Cap {(m.capacityPerMonth ?? 0).toLocaleString()} units/mo</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            {/* Line items */}
            {lineItems.map((item, idx) => (
              <div key={idx} className="rounded-lg border bg-background p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Item {idx + 1}</span>
                  {lineItems.length > 1 && (
                    <button onClick={() => removeItem(idx)} className="text-destructive hover:text-destructive/80 p-1 rounded">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Description *</Label>
                  <Input
                    placeholder="e.g. Aluminium Can 200ml"
                    value={item.description}
                    onChange={(e) => setItem(idx, "description", e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label>Quantity</Label>
                    <Input type="number" value={item.qty || ""} onChange={(e) => setItem(idx, "qty", +e.target.value)} placeholder="0" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Rate per unit (₹)</Label>
                    <Input type="number" step="0.01" value={item.rate || ""} onChange={(e) => setItem(idx, "rate", +e.target.value)} placeholder="0.00" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>GST Rate</Label>
                    <Select value={String(item.gstRate)} onValueChange={(v) => setItem(idx, "gstRate", Number(v))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[0, 5, 12, 18, 28].map((g) => (
                          <SelectItem key={g} value={String(g)}>{g}%{g === 18 ? " (Std)" : g === 28 ? " (Luxury)" : g === 0 ? " (Exempt)" : ""}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {item.qty > 0 && item.rate > 0 && (
                  <div className="grid grid-cols-3 gap-2 rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    <div><span className="font-medium text-foreground">₹{(item.qty * item.rate).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span><br />Subtotal</div>
                    <div><span className="font-medium text-foreground">₹{computedItems[idx] ? computedItems[idx].gstAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}</span><br />GST @ {item.gstRate}%</div>
                    <div><span className="font-medium text-foreground">₹{computedItems[idx] ? computedItems[idx].total.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}</span><br />Item Total</div>
                  </div>
                )}
              </div>
            ))}

            <Button variant="outline" size="sm" onClick={addItem}>
              <Plus className="mr-1.5 h-4 w-4" />Add Another Item
            </Button>

            {/* Grand total summary */}
            <div className="rounded-lg border bg-muted/40 p-4 text-sm space-y-2">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal ({lineItems.length} item{lineItems.length > 1 ? "s" : ""})</span>
                <span className="tabular-nums">₹{totalSubtotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Total GST</span>
                <span className="tabular-nums">₹{totalGst.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between border-t pt-2 font-semibold text-base">
                <span>Grand Total</span>
                <span className="tabular-nums">₹{grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5"><Label>Expected delivery date</Label><Input type="date" value={eta} onChange={(e) => setEta(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Delivery address</Label><Input placeholder="e.g. Influx Healthtech Ltd., Udaipur" value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} /></div>
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
          <div className="max-h-[70vh] overflow-y-auto rounded-lg border bg-white p-2">
            <PODocument
              poNumber={poNumber}
              poDate={poDate}
              materialType={material}
              quantity={computedItems.reduce((s, r) => s + r.quantity, 0)}
              rate={lineItems[0]?.rate ?? 0}
              gstRate={lineItems[0]?.gstRate ?? 18}
              gstAmount={totalGst}
              total={grandTotal}
              items={computedItems}
              category={category}
              deliveryAt={deliveryAddress}
              notes={notes}
              terms={terms}
              vendor={partyForDoc as any}
              sku={sku}
            />
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
