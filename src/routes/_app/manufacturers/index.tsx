import { createFileRoute, useRouter } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Plus, Factory, CheckCircle2, Clock, Truck, Pencil } from "lucide-react";
import { ProgressRail } from "@/components/progress-rail";
import { PRODUCTION_STAGES } from "@/lib/mock/types";
import { StatusBadge } from "@/components/status-badge";
import { useState } from "react";
import { toast } from "sonner";
import type { ApiManufacturer } from "@/lib/api";

export const Route = createFileRoute("/_app/manufacturers/")({
  loader: () => api.manufacturers.list(),
  component: ManufacturersPage,
  head: () => ({ meta: [{ title: "Manufacturers — SkinOps" }] }),
});

const EMPTY = { name: "", location: "", contactPerson: "", mobile: "", capacityPerMonth: 50000, qcPassRate: 97 };

function ManufacturerSheet({
  open, onOpenChange, initial, onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Partial<ApiManufacturer>;
  onSave: (data: typeof EMPTY) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...EMPTY, ...initial });
  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSave = async () => {
    if (!form.name || !form.location) { toast.error("Name and location are required."); return; }
    setSaving(true);
    try {
      await onSave(form);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{initial?.id ? "Edit Manufacturer" : "Add Manufacturer"}</SheetTitle>
        </SheetHeader>
        <div className="mt-6 grid grid-cols-1 gap-4">
          <div className="space-y-1.5">
            <Label>Company Name *</Label>
            <Input placeholder="e.g. Bluewave Personal Care" value={form.name} onChange={set("name")} />
          </div>
          <div className="space-y-1.5">
            <Label>Location *</Label>
            <Input placeholder="e.g. Daman" value={form.location} onChange={set("location")} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Contact Person</Label>
              <Input placeholder="Full name" value={form.contactPerson} onChange={set("contactPerson")} />
            </div>
            <div className="space-y-1.5">
              <Label>Mobile</Label>
              <Input placeholder="+91 98..." value={form.mobile} onChange={set("mobile")} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Capacity / month (units)</Label>
              <Input type="number" value={form.capacityPerMonth} onChange={set("capacityPerMonth")} />
            </div>
            <div className="space-y-1.5">
              <Label>QC Pass Rate (%)</Label>
              <Input type="number" step="0.1" min="0" max="100" value={form.qcPassRate} onChange={set("qcPassRate")} />
            </div>
          </div>
        </div>
        <SheetFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : (initial?.id ? "Save changes" : "Add Manufacturer")}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function ManufacturersPage() {
  const manufacturers = Route.useLoaderData();
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ApiManufacturer | null>(null);

  const handleCreate = async (form: typeof EMPTY) => {
    await api.manufacturers.create({
      ...form,
      capacityPerMonth: Number(form.capacityPerMonth),
      qcPassRate: Number(form.qcPassRate) as any,
      activeBatches: 0,
    });
    toast.success(`Manufacturer "${form.name}" added.`);
    await router.invalidate();
  };

  const handleEdit = async (form: typeof EMPTY) => {
    await api.manufacturers.update(editTarget!.id, {
      ...form,
      capacityPerMonth: Number(form.capacityPerMonth),
      qcPassRate: Number(form.qcPassRate) as any,
    });
    toast.success("Manufacturer updated.");
    setEditTarget(null);
    await router.invalidate();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manufacturers"
        description={`${manufacturers.length} active manufacturing partners`}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />Add Manufacturer
          </Button>
        }
      />

      {manufacturers.length === 0 && (
        <div className="rounded-xl border bg-card p-12 text-center text-sm text-muted-foreground">
          No manufacturers yet. Click "Add Manufacturer" to get started.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {manufacturers.map((m) => (
          <div key={m.id} className="rounded-xl border bg-card p-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-semibold">{m.name}</h3>
                <p className="text-xs text-muted-foreground">{m.location} · {m.contactPerson} · {m.mobile}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={() => setEditTarget(m)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Factory className="h-5 w-5" />
                </div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
              <div><div className="text-muted-foreground">Capacity / mo</div><div className="text-base font-semibold tabular-nums">{m.capacityPerMonth.toLocaleString()}</div></div>
              <div><div className="text-muted-foreground">Active batches</div><div className="text-base font-semibold tabular-nums">{m.activeBatches}</div></div>
              <div><div className="text-muted-foreground">QC pass rate</div><div className="text-base font-semibold tabular-nums text-success">{m.qcPassRate}%</div></div>
            </div>
            {m.productionBatches.length > 0 && (
              <div className="mt-4 border-t pt-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Live batches</p>
                <ul className="mt-3 space-y-3">
                  {m.productionBatches.map((b) => (
                    <li key={b.id} className="rounded-lg border bg-background p-3">
                      <div className="mb-2 flex items-center justify-between text-xs">
                        <span className="font-medium">{b.batchNumber} · {b.sku?.code}</span>
                        <StatusBadge status={b.delayed ? "Delayed" : "In Production"} />
                      </div>
                      <ProgressRail stages={PRODUCTION_STAGES} current={b.currentStage as any} delayed={b.delayed} />
                      <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />ETA {b.expectedCompletion}</span>
                        <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />Qty {b.quantity.toLocaleString()}</span>
                        <span className="inline-flex items-center gap-1"><Truck className="h-3 w-3" />Started {b.startedAt}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>

      <ManufacturerSheet open={createOpen} onOpenChange={setCreateOpen} onSave={handleCreate} />
      <ManufacturerSheet
        open={!!editTarget}
        onOpenChange={(v) => { if (!v) setEditTarget(null); }}
        initial={editTarget ?? undefined}
        onSave={handleEdit}
      />
    </div>
  );
}
