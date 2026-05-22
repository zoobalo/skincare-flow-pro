import { PageSkeleton } from "@/components/page-skeleton";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { api, type ApiVendor } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Plus, ShoppingBag, Pencil, Trash2, Mail, MapPin, Phone, Star, Search } from "lucide-react";
import { ContactsEditor } from "@/components/contacts-editor";
import { useState } from "react";
import { toast } from "sonner";
import type { ApiContact } from "@/lib/api";

export const Route = createFileRoute("/_app/vendors/")({
  loader: async () => {
    if (typeof window === "undefined") return null;
    return api.vendors.list();
  },
  pendingComponent: PageSkeleton,
  component: VendorsPage,
  head: () => ({ meta: [{ title: "Vendors — Zoobalo" }] }),
});

const EMPTY = {
  name: "", contactPerson: "", mobile: "", email: "", gst: "",
  address: "", city: "", materials: "",
  leadTimeDays: 21, paymentTerms: "Net 30", rating: 4.0,
  reliability: 85, delayPercent: 10, totalOrders: 0, runningOrders: 0, totalSpend: 0,
  contacts: [] as ApiContact[],
};

function VendorSheet({
  open, onOpenChange, initial, onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Partial<ApiVendor>;
  onSave: (data: typeof EMPTY) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<typeof EMPTY>({
    ...EMPTY,
    ...initial,
    materials: Array.isArray(initial?.materials) ? initial.materials.join(", ") : (initial?.materials ?? ""),
    contacts: (initial?.contacts as ApiContact[]) ?? [],
  });
  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSave = async () => {
    if (!form.name || !form.email || !form.city) {
      toast.error("Name, email and city are required.");
      return;
    }
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
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{initial?.id ? "Edit Vendor" : "Add Vendor"}</SheetTitle>
        </SheetHeader>
        <div className="mt-6 grid grid-cols-1 gap-4">
          <div className="space-y-1.5">
            <Label>Vendor Name *</Label>
            <Input placeholder="e.g. Alpha Aluminium Co." value={form.name} onChange={set("name")} />
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
              <Label>Email *</Label>
              <Input type="email" placeholder="vendor@company.com" value={form.email} onChange={set("email")} />
            </div>
            <div className="space-y-1.5">
              <Label>GST Number</Label>
              <Input placeholder="27AAAPL1234C1Z5" value={form.gst} onChange={set("gst")} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>City *</Label>
              <Input placeholder="Mumbai" value={form.city} onChange={set("city")} />
            </div>
            <div className="space-y-1.5">
              <Label>Address</Label>
              <Input placeholder="Plot 14, MIDC…" value={form.address} onChange={set("address")} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Materials Supplied (comma separated)</Label>
            <Input placeholder="Aluminium Can, Valve, Cap" value={form.materials} onChange={set("materials")} />
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
          <div className="border-t pt-4">
            <ContactsEditor contacts={form.contacts} onChange={(contacts) => setForm((f) => ({ ...f, contacts }))} />
          </div>
        </div>
        <SheetFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : (initial?.id ? "Save changes" : "Add Vendor")}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function VendorsPage() {
  const loaderData = Route.useLoaderData();
  if (!loaderData) return <PageSkeleton />;
  return <VendorsContent vendors={loaderData} />;
}

function VendorsContent({ vendors }: { vendors: Awaited<ReturnType<typeof api.vendors.list>> }) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ApiVendor | null>(null);
  const [search, setSearch] = useState("");

  const filtered = vendors.filter((v) => {
    const q = search.toLowerCase();
    return (
      v.name.toLowerCase().includes(q) ||
      (v.city ?? "").toLowerCase().includes(q) ||
      v.contactPerson.toLowerCase().includes(q) ||
      v.email.toLowerCase().includes(q) ||
      v.materials.some((m) => m.toLowerCase().includes(q))
    );
  });

  const handleCreate = async (form: typeof EMPTY) => {
    await api.vendors.create({
      ...form,
      materials: (form.materials as any).split(",").map((s: string) => s.trim()).filter(Boolean),
      leadTimeDays: Number(form.leadTimeDays),
      rating: Number(form.rating) as any,
      reliability: Number(form.reliability),
      delayPercent: Number(form.delayPercent),
      totalOrders: Number(form.totalOrders),
      runningOrders: Number(form.runningOrders),
      totalSpend: Number(form.totalSpend) as any,
      contacts: form.contacts,
    });
    toast.success(`Vendor "${form.name}" added.`);
    await router.invalidate();
  };

  const handleEdit = async (form: typeof EMPTY) => {
    await api.vendors.update(editTarget!.id, {
      ...form,
      materials: (form.materials as any).split(",").map((s: string) => s.trim()).filter(Boolean),
      leadTimeDays: Number(form.leadTimeDays),
      rating: Number(form.rating) as any,
      reliability: Number(form.reliability),
      delayPercent: Number(form.delayPercent),
      totalOrders: Number(form.totalOrders),
      runningOrders: Number(form.runningOrders),
      totalSpend: Number(form.totalSpend) as any,
      contacts: form.contacts,
    });
    toast.success(`Vendor "${form.name}" updated.`);
    setEditTarget(null);
    await router.invalidate();
  };

  const handleDelete = async (v: ApiVendor) => {
    if (!confirm(`Delete "${v.name}"? This cannot be undone.`)) return;
    try {
      await api.vendors.delete(v.id);
      toast.success(`"${v.name}" deleted.`);
      await router.invalidate();
    } catch {
      toast.error("Failed to delete vendor.");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vendors"
        description={`${vendors.length} active vendors across India`}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />Add Vendor
          </Button>
        }
      />

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search vendors…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {filtered.length === 0 && (
        <div className="rounded-xl border bg-card p-12 text-center text-sm text-muted-foreground">
          {vendors.length === 0 ? 'No vendors yet. Click "Add Vendor" to get started.' : "No vendors match your search."}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {filtered.map((v) => (
          <div key={v.id} className="rounded-xl border bg-card p-5">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <Link to="/vendors/$vendorId" params={{ vendorId: v.id }} className="text-base font-semibold hover:text-primary hover:underline">
                  {v.name}
                </Link>
                <p className="text-xs text-muted-foreground">{v.city || v.address} · {v.contactPerson} · {v.mobile}</p>
              </div>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setEditTarget(v)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:text-destructive" onClick={() => handleDelete(v)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <ShoppingBag className="h-5 w-5" />
                </div>
              </div>
            </div>

            {/* Contact & location details */}
            <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              {v.email && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Mail className="h-3 w-3 shrink-0" /><span className="truncate">{v.email}</span>
                </div>
              )}
              {v.gst && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="font-medium text-foreground">GST</span>
                  <span className="font-mono">{v.gst}</span>
                </div>
              )}
              {v.mobile && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Phone className="h-3 w-3 shrink-0" /><span>{v.mobile}</span>
                </div>
              )}
              {(v.address || v.city) && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">{[v.address, v.city].filter(Boolean).join(", ")}</span>
                </div>
              )}
              {v.paymentTerms && (
                <div><span className="text-muted-foreground">Payment · </span><span className="font-medium">{v.paymentTerms}</span></div>
              )}
              {v.leadTimeDays > 0 && (
                <div><span className="text-muted-foreground">Lead time · </span><span className="font-medium">{v.leadTimeDays}d</span></div>
              )}
            </div>

            {/* Materials */}
            {v.materials.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {v.materials.map((m, i) => (
                  <span key={i} className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">{m}</span>
                ))}
              </div>
            )}

            {/* Key metrics */}
            <div className="mt-4 grid grid-cols-3 gap-3 border-t pt-4 text-xs">
              <div><div className="text-muted-foreground">Total orders</div><div className="text-base font-semibold tabular-nums">{v.totalOrders}</div></div>
              <div><div className="text-muted-foreground">Running</div><div className="text-base font-semibold tabular-nums">{v.runningOrders}</div></div>
              <div><div className="text-muted-foreground">Total spend</div><div className="text-base font-semibold tabular-nums">₹{((v.totalSpend ?? 0) / 100000).toFixed(1)}L</div></div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
              <div className="flex items-center gap-1">
                <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                <span className="font-semibold tabular-nums">{v.rating}</span>
                <span className="text-muted-foreground">/ 5</span>
              </div>
              <div><div className="text-muted-foreground">Reliability</div><div className="font-semibold tabular-nums">{v.reliability}%</div></div>
              <div><div className="text-muted-foreground">Delay %</div><div className={`font-semibold tabular-nums ${v.delayPercent > 10 ? "text-destructive" : "text-success"}`}>{v.delayPercent}%</div></div>
            </div>

            {/* Department contacts */}
            {v.contacts && v.contacts.length > 0 && (
              <div className="mt-4 border-t pt-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">Department Contacts</p>
                <div className="grid grid-cols-2 gap-2">
                  {v.contacts.map((c, i) => (
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

      <VendorSheet open={createOpen} onOpenChange={setCreateOpen} onSave={handleCreate} />
      <VendorSheet
        key={editTarget?.id ?? "edit"}
        open={!!editTarget}
        onOpenChange={(v) => { if (!v) setEditTarget(null); }}
        initial={editTarget ?? undefined}
        onSave={handleEdit}
      />
    </div>
  );
}
