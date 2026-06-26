import { PageSkeleton } from "@/components/page-skeleton";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Plus, Factory, Pencil, Trash2, Mail, MapPin, Phone, Star, Search, FolderOpen } from "lucide-react";
import { ContactsEditor } from "@/components/contacts-editor";
import { useState } from "react";
import { toast } from "sonner";
import type { ApiManufacturer, ApiContact } from "@/lib/api";

export const Route = createFileRoute("/_app/manufacturers/")({
  loader: async () => {
    if (typeof window === "undefined") return null;
    const sharedTeamId = new URLSearchParams(window.location.search).get("sharedTeamId") ?? undefined;
    return { manufacturers: await api.manufacturers.list(sharedTeamId), sharedTeamId };
  },
  pendingComponent: PageSkeleton,
  component: ManufacturersPage,
  head: () => ({ meta: [{ title: "Manufacturers — Zoobalo" }] }),
});

const EMPTY = {
  name: "", location: "", city: "", email: "", gst: "", pan: "",
  contactPerson: "", mobile: "",
  capacityPerMonth: 50000, qcPassRate: 97,
  leadTimeDays: 30, paymentTerms: "Net 30",
  rating: 4.0, reliability: 90, delayPercent: 5,
  contacts: [] as ApiContact[],
  docsLink: "",
};

function ManufacturerSheet({
  open, onOpenChange, initial, onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Partial<ApiManufacturer>;
  onSave: (data: typeof EMPTY) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<typeof EMPTY>({ ...EMPTY, ...initial, pan: initial?.pan ?? "", contacts: (initial?.contacts as ApiContact[]) ?? [], docsLink: initial?.docsLink ?? "" });
  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSave = async () => {
    if (!form.name || !form.location || !form.city) { toast.error("Name, address and city are required."); return; }
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
              <Label>Email</Label>
              <Input type="email" placeholder="manufacturer@company.com" value={form.email} onChange={set("email")} />
            </div>
            <div className="space-y-1.5">
              <Label>GST Number</Label>
              <Input placeholder="27AAAPL1234C1Z5" value={form.gst} onChange={set("gst")} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>PAN</Label>
            <Input placeholder="AAAPL1234C" value={form.pan} onChange={set("pan")} className="uppercase" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Address *</Label>
              <Input placeholder="Plot 14, MIDC…" value={form.location} onChange={set("location")} />
            </div>
            <div className="space-y-1.5">
              <Label>City *</Label>
              <Input placeholder="e.g. Daman" value={form.city} onChange={set("city")} />
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
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Lead time (days)</Label>
              <Input type="number" value={form.leadTimeDays} onChange={set("leadTimeDays")} />
            </div>
            <div className="space-y-1.5">
              <Label>Payment Terms</Label>
              <Input placeholder="Net 30" value={form.paymentTerms} onChange={set("paymentTerms")} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Rating (0–5)</Label>
              <Input type="number" step="0.1" min="0" max="5" value={form.rating} onChange={set("rating")} />
            </div>
            <div className="space-y-1.5">
              <Label>Reliability %</Label>
              <Input type="number" min="0" max="100" value={form.reliability} onChange={set("reliability")} />
            </div>
            <div className="space-y-1.5">
              <Label>Delay %</Label>
              <Input type="number" min="0" max="100" value={form.delayPercent} onChange={set("delayPercent")} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Documents Link</Label>
            <Input type="url" placeholder="https://drive.google.com/..." value={form.docsLink} onChange={set("docsLink")} />
          </div>
          <div className="border-t pt-4">
            <ContactsEditor contacts={form.contacts} onChange={(contacts) => setForm((f) => ({ ...f, contacts }))} />
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
  const loaderData = Route.useLoaderData();
  if (!loaderData) return <PageSkeleton />;
  return <ManufacturersContent manufacturers={loaderData.manufacturers} sharedTeamId={loaderData.sharedTeamId} />;
}

function ManufacturersContent({ manufacturers: allManufacturers, sharedTeamId }: { manufacturers: Awaited<ReturnType<typeof api.manufacturers.list>>; sharedTeamId?: string }) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ApiManufacturer | null>(null);
  const [search, setSearch] = useState("");
  const manufacturers = allManufacturers.filter((m) => {
    const q = search.toLowerCase();
    return !q || m.name.toLowerCase().includes(q) || (m.city ?? "").toLowerCase().includes(q) || m.contactPerson.toLowerCase().includes(q) || (m.email ?? "").toLowerCase().includes(q);
  });

  const handleCreate = async (form: typeof EMPTY) => {
    await api.manufacturers.create({
      ...form,
      capacityPerMonth: Number(form.capacityPerMonth),
      qcPassRate: Number(form.qcPassRate) as any,
      leadTimeDays: Number(form.leadTimeDays),
      rating: Number(form.rating) as any,
      reliability: Number(form.reliability),
      delayPercent: Number(form.delayPercent),
      activeBatches: 0,
    }, sharedTeamId);
    toast.success(`Manufacturer "${form.name}" added.`);
    await router.invalidate();
  };

  const handleEdit = async (form: typeof EMPTY) => {
    await api.manufacturers.update(editTarget!.id, {
      ...form,
      capacityPerMonth: Number(form.capacityPerMonth),
      qcPassRate: Number(form.qcPassRate) as any,
      leadTimeDays: Number(form.leadTimeDays),
      rating: Number(form.rating) as any,
      reliability: Number(form.reliability),
      delayPercent: Number(form.delayPercent),
    });
    toast.success("Manufacturer updated.");
    setEditTarget(null);
    await router.invalidate();
  };

  const handleDelete = async (m: ApiManufacturer) => {
    if (!confirm(`Delete "${m.name}"? This cannot be undone.`)) return;
    try {
      await api.manufacturers.delete(m.id);
      toast.success(`"${m.name}" deleted.`);
      await router.invalidate();
    } catch {
      toast.error("Failed to delete manufacturer.");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manufacturers"
        description={`${allManufacturers.length} active manufacturing partners`}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />Add Manufacturer
          </Button>
        }
      />

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search manufacturers…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {manufacturers.length === 0 && (
        <div className="rounded-xl border bg-card p-12 text-center text-sm text-muted-foreground">
          {allManufacturers.length === 0 ? 'No manufacturers yet. Click "Add Manufacturer" to get started.' : "No manufacturers match your search."}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {manufacturers.map((m) => (
          <div key={m.id} className="rounded-xl border bg-card p-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-semibold">{m.name}</h3>
                <p className="text-xs text-muted-foreground">{m.city || m.location} · {m.contactPerson} · {m.mobile}</p>
              </div>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setEditTarget(m)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:text-destructive" onClick={() => handleDelete(m)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Factory className="h-5 w-5" />
                </div>
              </div>
            </div>
            {/* Contact & location details */}
            <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              {m.email && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Mail className="h-3 w-3 shrink-0" /><span className="truncate">{m.email}</span>
                </div>
              )}
              {m.gst && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="font-medium text-foreground">GST</span>
                  <span className="font-mono">{m.gst}</span>
                </div>
              )}
              {m.mobile && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Phone className="h-3 w-3 shrink-0" /><span>{m.mobile}</span>
                </div>
              )}
              {(m.location || m.city) && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">{[m.location, m.city].filter(Boolean).join(", ")}</span>
                </div>
              )}
              {m.paymentTerms && (
                <div><span className="text-muted-foreground">Payment · </span><span className="font-medium">{m.paymentTerms}</span></div>
              )}
              {m.leadTimeDays > 0 && (
                <div><span className="text-muted-foreground">Lead time · </span><span className="font-medium">{m.leadTimeDays}d</span></div>
              )}
              {m.docsLink && (
                <div className="col-span-2 flex items-center gap-1.5">
                  <FolderOpen className="h-3 w-3 shrink-0 text-primary" />
                  <a href={m.docsLink} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline truncate">
                    View Documents
                  </a>
                </div>
              )}
            </div>
            {/* Key metrics */}
            <div className="mt-4 grid grid-cols-3 gap-3 border-t pt-4 text-xs">
              <div><div className="text-muted-foreground">Capacity / mo</div><div className="text-base font-semibold tabular-nums">{(m.capacityPerMonth ?? 0).toLocaleString()}</div></div>
              <div><div className="text-muted-foreground">Active batches</div><div className="text-base font-semibold tabular-nums">{m.activeBatches}</div></div>
              <div><div className="text-muted-foreground">QC pass rate</div><div className="text-base font-semibold tabular-nums text-success">{m.qcPassRate}%</div></div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
              <div className="flex items-center gap-1">
                <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                <span className="font-semibold tabular-nums">{m.rating}</span>
                <span className="text-muted-foreground">/ 5</span>
              </div>
              <div><div className="text-muted-foreground">Reliability</div><div className="font-semibold tabular-nums">{m.reliability}%</div></div>
              <div><div className="text-muted-foreground">Delay %</div><div className={`font-semibold tabular-nums ${m.delayPercent > 10 ? "text-destructive" : "text-success"}`}>{m.delayPercent}%</div></div>
            </div>
            {m.contacts && m.contacts.length > 0 && (
              <div className="mt-4 border-t pt-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">Department Contacts</p>
                <div className="grid grid-cols-2 gap-2">
                  {m.contacts.map((c, i) => (
                    <div key={i} className="rounded-lg bg-muted/40 px-3 py-2 text-xs">
                      <div className="font-semibold text-primary">{c.department}</div>
                      <div className="font-medium">{c.name}</div>
                      {c.mobile && <div className="text-muted-foreground">{c.mobile}</div>}
                      {c.email && <div className="text-muted-foreground">{c.email}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <ManufacturerSheet open={createOpen} onOpenChange={setCreateOpen} onSave={handleCreate} />
      <ManufacturerSheet
        key={editTarget?.id ?? "edit"}
        open={!!editTarget}
        onOpenChange={(v) => { if (!v) setEditTarget(null); }}
        initial={editTarget ?? undefined}
        onSave={handleEdit}
      />
    </div>
  );
}
