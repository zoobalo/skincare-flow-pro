import { PageSkeleton } from "@/components/page-skeleton";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { Plus, LayoutGrid, List, Search, Trash2 } from "lucide-react";
import { ImageUpload } from "@/components/image-upload";
import React, { useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/skus/")({
  loader: async () => {
    if (typeof window === "undefined") return null;
    const [skus, manufacturers] = await Promise.all([api.skus.list(), api.manufacturers.list()]);
    return { skus, manufacturers };
  },
  pendingComponent: PageSkeleton,
  component: SkuListPage,
  head: () => ({ meta: [{ title: "SKU Management — Zoobalo" }] }),
});

const SKU_CATEGORIES = ["Sun Care", "Serums", "Moisturizers", "Cleansers", "Toners", "Exfoliators", "Eye Care", "Lip Care", "Body Care", "Skin Cure"];
const SKU_TYPES = ["Aerosol Spray", "Glass Dropper", "Pump Bottle", "Tube", "Jar", "Cream Tube", "Lotion Bottle", "Toner Bottle", "Stick", "Airless Glass Pump", "Airless Bottle", "PET Spray"];

const EMPTY_FORM = {
  code: "", name: "", category: "Serums", type: "Glass Dropper",
  description: "", image: "", manufacturerId: "",
  currentInventory: 0, minThreshold: 0, productionTimelineDays: 30,
};

function SkuListPage() {
  const loaderData = Route.useLoaderData();
  if (!loaderData) return <PageSkeleton />;
  return <SkuListContent skus={loaderData.skus} manufacturers={loaderData.manufacturers} />;
}

function SkuListContent({ skus, manufacturers }: {
  skus: Awaited<ReturnType<typeof api.skus.list>>;
  manufacturers: Awaited<ReturnType<typeof api.manufacturers.list>>;
}) {
  const router = useRouter();
  const [view, setView] = useState<"grid" | "table">("grid");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM, manufacturerId: manufacturers[0]?.id ?? "" });

  const categories = Array.from(new Set(skus.map((s) => s.category)));
  const filtered = skus.filter(
    (s) =>
      (cat === "all" || s.category === cat) &&
      (q.trim() === "" || s.name.toLowerCase().includes(q.toLowerCase()) || s.code.toLowerCase().includes(q.toLowerCase()))
  );

  // Group by category, preserving SKU_CATEGORIES order
  const grouped = SKU_CATEGORIES
    .filter((c) => filtered.some((s) => s.category === c))
    .map((c) => ({ category: c, items: filtered.filter((s) => s.category === c) }));
  // Append any categories not in SKU_CATEGORIES (shouldn't happen but safe)
  const knownCats = new Set(SKU_CATEGORIES);
  const extraCats = Array.from(new Set(filtered.filter(s => !knownCats.has(s.category)).map(s => s.category)));
  extraCats.forEach((c) => grouped.push({ category: c, items: filtered.filter((s) => s.category === c) }));

  const showGrouped = cat === "all" && q.trim() === "";

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleDelete = async (id: string, name: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await api.skus.delete(id);
      toast.success(`"${name}" deleted.`);
      await router.invalidate();
    } catch {
      toast.error("Failed to delete SKU.");
    }
  };

  const handleCreate = async () => {
    if (!form.code || !form.name || !form.manufacturerId) {
      toast.error("Code, name and manufacturer are required.");
      return;
    }
    setSaving(true);
    try {
      await api.skus.create({
        ...form,
        currentInventory: Number(form.currentInventory),
        minThreshold: Number(form.minThreshold),
        productionTimelineDays: Number(form.productionTimelineDays),
      });
      toast.success(`SKU "${form.name}" created.`);
      setOpen(false);
      setForm({ ...EMPTY_FORM, manufacturerId: manufacturers[0]?.id ?? "" });
      await router.invalidate();
    } catch {
      toast.error("Failed to create SKU.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="SKU Management"
        description={`${skus.length} active SKUs across ${categories.length} categories`}
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />Add SKU
          </Button>
        }
      />

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search SKUs by name or code…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" />
          </div>
          <Select value={cat} onValueChange={setCat}>
            <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="inline-flex rounded-md border bg-card p-0.5">
          <button onClick={() => setView("grid")} className={`flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-xs ${view === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}><LayoutGrid className="h-3.5 w-3.5" />Cards</button>
          <button onClick={() => setView("table")} className={`flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-xs ${view === "table" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}><List className="h-3.5 w-3.5" />Table</button>
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="rounded-xl border bg-card p-12 text-center text-sm text-muted-foreground">No SKUs match your search.</div>
      )}

      {view === "grid" ? (
        <div className="space-y-8">
          {(showGrouped ? grouped : [{ category: cat === "all" ? "Results" : cat, items: filtered }]).map(({ category, items }) => (
            <div key={category}>
              {showGrouped && (
                <div className="mb-3 flex items-center gap-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{category}</h2>
                  <div className="flex-1 border-t" />
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{items.length}</span>
                </div>
              )}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {items.map((sku) => {
                  const low = sku.currentInventory < sku.minThreshold;
                  return (
                    <div key={sku.id} className="relative group">
                      <Link to="/skus/$skuId" params={{ skuId: sku.id }} className="flex flex-col overflow-hidden rounded-xl border bg-card transition-all hover:shadow-md">
                        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                          {sku.image ? <img src={sku.image} alt={sku.name} className="h-full w-full object-cover transition-transform group-hover:scale-105" loading="lazy" /> : <div className="h-full w-full bg-muted" />}
                          <div className="absolute left-2 top-2"><StatusBadge status={low ? "Low Stock" : "Healthy"} /></div>
                        </div>
                        <div className="flex flex-1 flex-col p-4">
                          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{sku.code} · {sku.category}</p>
                          <h3 className="mt-1 line-clamp-2 text-sm font-semibold text-foreground">{sku.name}</h3>
                          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                            <div><div className="text-muted-foreground">Stock</div><div className="font-semibold tabular-nums">{sku.currentInventory.toLocaleString()}</div></div>
                            <div><div className="text-muted-foreground">Lead time</div><div className="font-semibold tabular-nums">{sku.productionTimelineDays}d</div></div>
                          </div>
                        </div>
                      </Link>
                      <button
                        onClick={(e) => handleDelete(sku.id, sku.name, e)}
                        className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md bg-background/80 text-destructive opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">SKU Code</th>
                <th className="px-4 py-2.5 font-medium">Name</th>
                {!showGrouped && <th className="px-4 py-2.5 font-medium">Category</th>}
                <th className="px-4 py-2.5 font-medium text-right">Stock</th>
                <th className="px-4 py-2.5 font-medium text-right">Min</th>
                <th className="px-4 py-2.5 font-medium text-right">Lead time</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {(showGrouped ? grouped : [{ category: "", items: filtered }]).map(({ category, items }) => (
                <React.Fragment key={category}>
                  {showGrouped && (
                    <tr className="border-t bg-muted/30">
                      <td colSpan={7} className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {category} <span className="ml-1.5 font-normal">({items.length})</span>
                      </td>
                    </tr>
                  )}
                  {items.map((sku) => {
                    const low = sku.currentInventory < sku.minThreshold;
                    return (
                      <tr key={sku.id} className="border-t hover:bg-muted/30">
                        <td className="px-4 py-2.5"><Link to="/skus/$skuId" params={{ skuId: sku.id }} className="font-medium text-primary hover:underline">{sku.code}</Link></td>
                        <td className="px-4 py-2.5">{sku.name}</td>
                        {!showGrouped && <td className="px-4 py-2.5 text-muted-foreground">{sku.category}</td>}
                        <td className="px-4 py-2.5 text-right tabular-nums">{sku.currentInventory.toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{sku.minThreshold.toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{sku.productionTimelineDays}d</td>
                        <td className="px-4 py-2.5"><StatusBadge status={low ? "Low Stock" : "Healthy"} /></td>
                        <td className="px-4 py-2.5">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={(e) => handleDelete(sku.id, sku.name, e)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create SKU Sheet */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Add New SKU</SheetTitle>
          </SheetHeader>
          <div className="mt-6 grid grid-cols-1 gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>SKU Code *</Label>
                <Input placeholder="e.g. INV-SS-150" value={form.code} onChange={set("code")} />
              </div>
              <div className="space-y-1.5">
                <Label>Category *</Label>
                <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SKU_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Product Name *</Label>
              <Input placeholder="e.g. Hydra-Glow Vitamin C Serum" value={form.name} onChange={set("name")} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SKU_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Manufacturer *</Label>
                <Select value={form.manufacturerId} onValueChange={(v) => setForm((f) => ({ ...f, manufacturerId: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{manufacturers.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea rows={2} value={form.description} onChange={set("description")} placeholder="Short product description" />
            </div>
            <div className="space-y-1.5">
              <Label>Product Image</Label>
              <ImageUpload value={form.image} onChange={(url) => setForm(f => ({ ...f, image: url }))} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Current Stock</Label>
                <Input type="number" value={form.currentInventory} onChange={set("currentInventory")} />
              </div>
              <div className="space-y-1.5">
                <Label>Min Threshold</Label>
                <Input type="number" value={form.minThreshold} onChange={set("minThreshold")} />
              </div>
              <div className="space-y-1.5">
                <Label>Lead time (days)</Label>
                <Input type="number" value={form.productionTimelineDays} onChange={set("productionTimelineDays")} />
              </div>
            </div>
          </div>
          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving ? "Creating…" : "Create SKU"}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
