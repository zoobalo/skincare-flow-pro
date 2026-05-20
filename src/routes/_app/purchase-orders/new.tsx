import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { Check, ChevronLeft, ChevronRight, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/purchase-orders/new")({
  loader: async () => {
    const [skus, vendors] = await Promise.all([api.skus.list(), api.vendors.list()]);
    return { skus, vendors };
  },
  component: NewPOWizard,
  head: () => ({ meta: [{ title: "Create Purchase Order — SkinOps" }] }),
});

const steps = ["SKU & Material", "Vendor", "Quantity & Pricing", "Delivery", "Review & Send"] as const;

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
  const { skus, vendors } = Route.useLoaderData();

  const [step, setStep] = useState(0);
  const [skuId, setSkuId]     = useState(skus[0]?.id ?? "");
  const [material, setMaterial] = useState("Aluminium Can");
  const [vendorId, setVendorId] = useState(vendors[0]?.id ?? "");
  const [qty, setQty]   = useState(10000);
  const [rate, setRate] = useState(28.5);
  const [eta, setEta]   = useState("2026-05-15");
  const [notes, setNotes] = useState("Please ensure batch certificates are sent along with dispatch.");
  const [submitting, setSubmitting] = useState(false);

  const next = () => setStep((s) => Math.min(s + 1, steps.length - 1));
  const prev = () => setStep((s) => Math.max(s - 1, 0));

  const sku    = skus.find((s) => s.id === skuId);
  const vendor = vendors.find((v) => v.id === vendorId);

  const submit = async () => {
    setSubmitting(true);
    try {
      await api.purchaseOrders.create({
        id:               crypto.randomUUID(),
        poNumber:         genPoNumber(),
        vendorId,
        skuId,
        materialType:     material,
        quantity:         qty,
        rate:             rate as any,
        total:            (qty * rate) as any,
        dispatchDate:     todayStr(),
        expectedDelivery: eta,
        status:           "Pending",
        notes:            notes || null,
      });
      toast.success("Purchase order created and sent to vendor.");
      navigate({ to: "/purchase-orders" });
    } catch {
      toast.error("Failed to create purchase order. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Create Purchase Order" description="Multi-step PO creation with vendor selection and email send" />

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

        {step === 2 && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-1.5"><Label>Quantity</Label><Input type="number" value={qty} onChange={(e) => setQty(+e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Rate per unit (₹)</Label><Input type="number" step="0.1" value={rate} onChange={(e) => setRate(+e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Total</Label><div className="flex h-9 items-center rounded-md border bg-muted px-3 text-sm font-semibold tabular-nums">₹{(qty * rate).toLocaleString()}</div></div>
          </div>
        )}

        {step === 3 && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5"><Label>Expected delivery date</Label><Input type="date" value={eta} onChange={(e) => setEta(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Delivery address</Label><Input defaultValue="SkinOps Warehouse, Andheri MIDC, Mumbai" /></div>
            <div className="md:col-span-2 space-y-1.5"><Label>Notes to vendor</Label><Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-background p-4 text-sm">
              <h4 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">PO Summary</h4>
              <dl className="grid grid-cols-2 gap-3">
                <div><dt className="text-xs text-muted-foreground">SKU</dt><dd>{sku?.code} — {sku?.name}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Material</dt><dd>{material}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Vendor</dt><dd>{vendor?.name}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Vendor email</dt><dd>{vendor?.email}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Quantity</dt><dd className="tabular-nums">{qty.toLocaleString()}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Total</dt><dd className="tabular-nums">₹{(qty * rate).toLocaleString()}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Expected delivery</dt><dd>{eta}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Payment terms</dt><dd>{vendor?.paymentTerms}</dd></div>
              </dl>
            </div>
            <div className="rounded-lg border bg-muted/40 p-4">
              <div className="flex items-center gap-2 text-sm font-medium"><Mail className="h-4 w-4" />Email preview</div>
              <p className="mt-2 text-xs text-muted-foreground">To: {vendor?.email}</p>
              <p className="text-xs text-muted-foreground">Subject: Purchase Order — {sku?.code} {material} — Qty {qty.toLocaleString()}</p>
              <p className="mt-3 text-sm whitespace-pre-line">Hi {vendor?.contactPerson},{"\n\n"}Please find our PO for {qty.toLocaleString()} units of {material} for SKU {sku?.code} at ₹{rate}/unit. Expected delivery by {eta}.{"\n\n"}{notes}{"\n\n"}Regards,{"\n"}SkinOps Procurement</p>
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
            <Button onClick={submit} disabled={submitting}>
              <Mail className="mr-1.5 h-4 w-4" />
              {submitting ? "Sending…" : "Send PO to vendor"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
