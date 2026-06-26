import { PageSkeleton } from "@/components/page-skeleton";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { api, type ApiPm, type ApiVendor } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import {
  Plus, Package, Pencil, Trash2, Search, FolderOpen, AlertTriangle, ArrowRight,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/pm/")({
  loader: async () => {
    if (typeof window === "undefined") return null;
    const [pms, vendors] = await Promise.all([
      api.pm.list(),
      api.vendors.list(),
    ]);
    return { pms, vendors };
  },
  pendingComponent: PageSkeleton,
  component: PmPage,
  head: () => ({ meta: [{ title: "PM Management — Zoobalo" }] }),
});

const PM_CATEGORIES = [
  "All",
  "Corrugated Box", "Rigid Box", "Other",
];

const EMPTY = {
  code: "", name: "", category: "Corrugated Box", description: "",
  currentStock: 0, minThreshold: 0, moq: 0, leadTimeDays: 30,
  costPerUnit: "" as string | number,
  docsLink: "",
};

function PmSheet({
  open, onOpenChange, initial, onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Partial<ApiPm>;
  onSave: (data: typeof EMPTY) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<typeof EMPTY>({
    ...EMPTY,
    ...initial,
    costPerUnit: initial?.costPerUnit ?? "",
    docsLink: initial?.docsLink ?? "",
  });
  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSave = async () => {
    if (!form.code.trim() || !form.name.trim()) { toast.error("Code and name are required."); return; }
    setSaving(true);
    try { await onSave(form); onOpenChange(false); }
    finally { setSaving(false); }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{initial?.id ? "Edit Packaging Material" : "Add Packaging Material"}</SheetTitle>
        </SheetHeader>
        <div className="mt-6 grid grid-cols-1 gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Code *</Label>
              <Input placeholder="PM-001" value={form.code} onChange={set("code")} className="uppercase" />
            </div>
            <div className="space-y-1.5">
              <Label>Category *</Label>
              <select
                value={form.category}
                onChange={set("category")}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {PM_CATEGORIES.filter((c) => c !== "All").map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Name *</Label>
            <Input placeholder="e.g. 200ml Airless Pump Bottle" value={form.name} onChange={set("name")} />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input placeholder="Brief description" value={form.description} onChange={set("description")} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Current Stock</Label>
              <Input type="number" min="0" value={form.currentStock} onChange={set("currentStock")} />
            </div>
            <div className="space-y-1.5">
              <Label>Min. Threshold</Label>
              <Input type="number" min="0" value={form.minThreshold} onChange={set("minThreshold")} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>MOQ</Label>
              <Input type="number" min="0" value={form.moq} onChange={set("moq")} />
            </div>
            <div className="space-y-1.5">
              <Label>Lead time (days)</Label>
              <Input type="number" min="0" value={form.leadTimeDays} onChange={set("leadTimeDays")} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Cost per unit (₹)</Label>
            <Input type="number" step="0.01" min="0" placeholder="0.00" value={form.costPerUnit} onChange={set("costPerUnit")} />
          </div>
          <div className="space-y-1.5">
            <Label>Documents Link</Label>
            <Input type="url" placeholder="https://drive.google.com/..." value={form.docsLink} onChange={set("docsLink")} />
          </div>
        </div>
        <SheetFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : (initial?.id ? "Save changes" : "Add PM")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function PmPage() {
  const loaderData = Route.useLoaderData();
  if (!loaderData) return <PageSkeleton />;
  return <PmContent pms={loaderData.pms} vendors={loaderData.vendors} />;
}

function PmContent({ pms: allPms, vendors }: { pms: ApiPm[]; vendors: ApiVendor[] }) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ApiPm | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");

  const vendorMap = Object.fromEntries(vendors.map((v) => [v.id, v.name]));

  const pms = allPms.filter((p) => {
    const q = search.toLowerCase();
    const matchSearch = !q || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
    const matchCat = categoryFilter === "All" || p.category === categoryFilter;
    return matchSearch && matchCat;
  });

  const handleCreate = async (form: typeof EMPTY) => {
    const res = await api.pm.create({
      ...form,
      code: form.code.toUpperCase(),
      currentStock:  Number(form.currentStock),
      minThreshold:  Number(form.minThreshold),
      moq:           Number(form.moq),
      leadTimeDays:  Number(form.leadTimeDays),
      costPerUnit:   form.costPerUnit !== "" ? Number(form.costPerUnit) : null,
    });
    if (res?.error) { toast.error(res.error); return; }
    toast.success(`"${form.name}" added.`);
    await router.invalidate();
  };

  const handleEdit = async (form: typeof EMPTY) => {
    const res = await api.pm.update(editTarget!.id, {
      ...form,
      code: form.code.toUpperCase(),
      currentStock:  Number(form.currentStock),
      minThreshold:  Number(form.minThreshold),
      moq:           Number(form.moq),
      leadTimeDays:  Number(form.leadTimeDays),
      costPerUnit:   form.costPerUnit !== "" ? Number(form.costPerUnit) : null,
    });
    if (res?.error) { toast.error(res.error); return; }
    toast.success("Updated.");
    setEditTarget(null);
    await router.invalidate();
  };

  const handleDelete = async (pm: ApiPm) => {
    if (!confirm(`Delete "${pm.name}"? This cannot be undone.`)) return;
    const res = await api.pm.delete(pm.id);
    if (res?.error) { toast.error(res.error); return; }
    toast.success(`"${pm.name}" deleted.`);
    await router.invalidate();
  };

  const counts = allPms.reduce<Record<string, number>>((acc, p) => {
    acc[p.category] = (acc[p.category] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <PageHeader
        title="PM Management"
        description={`${allPms.length} packaging material${allPms.length !== 1 ? "s" : ""}`}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />Add PM
          </Button>
        }
      />

      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        {PM_CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              categoryFilter === cat
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {cat}{cat !== "All" && counts[cat] ? ` (${counts[cat]})` : ""}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name or code…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {pms.length === 0 && (
        <div className="rounded-xl border bg-card p-12 text-center text-sm text-muted-foreground">
          {allPms.length === 0 ? 'No packaging materials yet. Click "Add PM" to get started.' : "No items match your search or filter."}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {pms.map((pm) => {
          const lowStock = pm.minThreshold > 0 && pm.currentStock < pm.minThreshold;
          return (
            <div key={pm.id} className="rounded-xl border bg-card p-5 flex flex-col gap-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-muted-foreground">{pm.code}</span>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                      {pm.category}
                    </span>
                  </div>
                  <h3 className="mt-0.5 text-sm font-semibold leading-tight">{pm.name}</h3>
                  {pm.description && <p className="mt-0.5 text-xs text-muted-foreground truncate">{pm.description}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setEditTarget(pm)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:text-destructive" onClick={() => handleDelete(pm)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Package className="h-4 w-4" />
                  </div>
                </div>
              </div>

              {/* Stock + key metrics */}
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className={`rounded-lg p-2 ${lowStock ? "bg-destructive/10" : "bg-muted/40"}`}>
                  <div className="text-muted-foreground flex items-center gap-1">
                    {lowStock && <AlertTriangle className="h-3 w-3 text-destructive" />}
                    Stock
                  </div>
                  <div className={`font-semibold tabular-nums ${lowStock ? "text-destructive" : ""}`}>
                    {pm.currentStock.toLocaleString()}
                  </div>
                </div>
                <div className="rounded-lg bg-muted/40 p-2">
                  <div className="text-muted-foreground">MOQ</div>
                  <div className="font-semibold tabular-nums">{pm.moq.toLocaleString()}</div>
                </div>
                <div className="rounded-lg bg-muted/40 p-2">
                  <div className="text-muted-foreground">Lead</div>
                  <div className="font-semibold tabular-nums">{pm.leadTimeDays}d</div>
                </div>
              </div>

              {pm.costPerUnit != null && (
                <p className="text-xs text-muted-foreground">
                  Cost: <span className="font-medium text-foreground">₹{pm.costPerUnit.toFixed(2)} / unit</span>
                </p>
              )}

              {pm.docsLink && (
                <a href={pm.docsLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
                  <FolderOpen className="h-3.5 w-3.5" />View Documents
                </a>
              )}

              <Link
                to="/pm/$pmId"
                params={{ pmId: pm.id }}
                className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-xs font-medium hover:bg-muted transition-colors"
              >
                <span>View details</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          );
        })}
      </div>

      <PmSheet open={createOpen} onOpenChange={setCreateOpen} onSave={handleCreate} />
      <PmSheet
        key={editTarget?.id ?? "edit"}
        open={!!editTarget}
        onOpenChange={(v) => { if (!v) setEditTarget(null); }}
        initial={editTarget ?? undefined}
        onSave={handleEdit}
      />
    </div>
  );
}
