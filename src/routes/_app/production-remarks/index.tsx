import { PageSkeleton } from "@/components/page-skeleton";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { api, type ApiProductionRemark, type ApiSku } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Edit2, MessageSquareWarning } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/production-remarks/")({
  loader: async () => {
    const [remarks, skus] = await Promise.all([api.productionRemarks.list(), api.skus.list()]);
    return { remarks, skus };
  },
  pendingComponent: PageSkeleton,
  component: ProductionRemarksPage,
  head: () => ({ meta: [{ title: "Production Remarks — Zoobalo" }] }),
});

const MATERIAL_TYPES = ["None", "Packaging Material", "Raw Material"] as const;
const STATUSES = ["Active", "Conveyed", "Resolved"] as const;

const STATUS_STYLES: Record<string, string> = {
  Active:   "bg-amber-100 text-amber-800 border-amber-200",
  Conveyed: "bg-blue-100 text-blue-800 border-blue-200",
  Resolved: "bg-green-100 text-green-800 border-green-200",
};

const EMPTY: Omit<ApiProductionRemark, "id" | "createdAt" | "updatedAt" | "skuCode" | "skuName"> = {
  skuId: null, materialType: "None", remark: "", status: "Active",
};

function ProductionRemarksPage() {
  const { remarks: rawRemarks, skus } = Route.useLoaderData();
  const router = useRouter();
  const reload = () => router.invalidate();

  const [sheetOpen, setSheetOpen]   = useState(false);
  const [editTarget, setEditTarget] = useState<ApiProductionRemark | null>(null);
  const [saving, setSaving]         = useState(false);
  const [form, setForm]             = useState({ ...EMPTY });

  // Filters
  const [filterSku,      setFilterSku]      = useState("__all__");
  const [filterType,     setFilterType]     = useState("__all__");
  const [filterStatus,   setFilterStatus]   = useState("__all__");

  const skuMap = Object.fromEntries(skus.map((s) => [s.id, s]));

  const remarks = rawRemarks.filter((r) => {
    if (filterSku    !== "__all__" && (r.skuId ?? "__none__") !== filterSku) return false;
    if (filterType   !== "__all__" && r.materialType !== filterType)          return false;
    if (filterStatus !== "__all__" && r.status !== filterStatus)              return false;
    return true;
  });

  const openCreate = () => { setForm({ ...EMPTY }); setEditTarget(null); setSheetOpen(true); };
  const openEdit   = (r: ApiProductionRemark) => {
    setForm({ skuId: r.skuId, materialType: r.materialType, remark: r.remark, status: r.status });
    setEditTarget(r);
    setSheetOpen(true);
  };

  const handleSave = async () => {
    if (!form.remark.trim()) { toast.error("Remark text is required."); return; }
    setSaving(true);
    try {
      const payload = { ...form };
      if (editTarget) {
        await api.productionRemarks.update(editTarget.id, payload);
        toast.success("Remark updated.");
      } else {
        await api.productionRemarks.create(payload);
        toast.success("Remark added.");
      }
      setSheetOpen(false);
      await reload();
    } catch { toast.error("Failed to save."); } finally { setSaving(false); }
  };

  const handleDelete = async (r: ApiProductionRemark) => {
    if (!confirm("Delete this remark?")) return;
    try { await api.productionRemarks.delete(r.id); toast.success("Deleted."); reload(); }
    catch { toast.error("Failed to delete."); }
  };

  const handleStatusChange = async (r: ApiProductionRemark, status: string) => {
    try { await api.productionRemarks.update(r.id, { status: status as ApiProductionRemark["status"] }); reload(); }
    catch { toast.error("Failed to update status."); }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Production Remarks"
        description={`${remarks.length} remark${remarks.length !== 1 ? "s" : ""} · reminders to convey to vendors on next PO`}
        actions={
          <Button onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" />Add Remark
          </Button>
        }
      />

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2">
        <Select value={filterSku} onValueChange={setFilterSku}>
          <SelectTrigger className="h-8 w-44 text-xs">
            <SelectValue placeholder="All SKUs" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All SKUs</SelectItem>
            <SelectItem value="__none__">No SKU</SelectItem>
            {skus.map((s) => <SelectItem key={s.id} value={s.id}>{s.code} — {s.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="h-8 w-44 text-xs">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All types</SelectItem>
            {MATERIAL_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All statuses</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>

        {(filterSku !== "__all__" || filterType !== "__all__" || filterStatus !== "__all__") && (
          <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setFilterSku("__all__"); setFilterType("__all__"); setFilterStatus("__all__"); }}>
            Clear filters
          </Button>
        )}
      </div>

      {remarks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border bg-card p-16 text-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MessageSquareWarning className="h-7 w-7" />
          </div>
          <div>
            <p className="font-semibold">No remarks yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Add remarks to remind yourself what to convey to vendors when raising the next PO.</p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-xs text-muted-foreground uppercase tracking-wide">
                <th className="px-4 py-2.5 text-left font-medium w-36">SKU</th>
                <th className="px-4 py-2.5 text-left font-medium w-36">Material Type</th>
                <th className="px-4 py-2.5 text-left font-medium">Remark</th>
                <th className="px-4 py-2.5 text-left font-medium w-36">Status</th>
                <th className="px-4 py-2.5 text-right font-medium w-20">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {remarks.map((r) => {
                const sku = r.skuId ? skuMap[r.skuId] : null;
                const resolved = r.status === "Resolved";
                return (
                  <tr key={r.id} className={resolved ? "opacity-50" : undefined}>
                    <td className="px-4 py-3 align-top">
                      {sku ? (
                        <div>
                          <p className={`font-medium leading-snug ${resolved ? "line-through" : ""}`}>{sku.name}</p>
                          <p className="text-xs text-muted-foreground">{sku.code}</p>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top">
                      {r.materialType !== "None" ? (
                        <span className="text-xs">{r.materialType}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <p className={`leading-relaxed whitespace-pre-wrap ${resolved ? "line-through text-muted-foreground" : ""}`}>{r.remark}</p>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <Select value={r.status} onValueChange={(v) => handleStatusChange(r, v)}>
                        <SelectTrigger className="h-7 w-28 text-xs border-0 p-0 focus:ring-0 shadow-none bg-transparent">
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[r.status]}`}>
                            {r.status}
                          </span>
                        </SelectTrigger>
                        <SelectContent>
                          {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-3 align-top text-right">
                      <div className="flex items-center justify-end gap-0.5">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(r)}>
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => handleDelete(r)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit Sheet */}
      <Sheet key={editTarget?.id ?? "new"} open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editTarget ? "Edit Remark" : "Add Remark"}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 grid grid-cols-1 gap-5">

            <div className="space-y-1.5">
              <Label>SKU</Label>
              <Select value={form.skuId ?? "__none__"} onValueChange={(v) => setForm((f) => ({ ...f, skuId: v === "__none__" ? null : v }))}>
                <SelectTrigger><SelectValue placeholder="Select SKU…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {skus.map((s) => <SelectItem key={s.id} value={s.id}>{s.code} — {s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Material Type</Label>
              <Select value={form.materialType} onValueChange={(v) => setForm((f) => ({ ...f, materialType: v as typeof form.materialType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MATERIAL_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Remark *</Label>
              <Textarea
                rows={5}
                placeholder="Describe what needs to be conveyed to the vendor on the next PO…"
                value={form.remark}
                onChange={(e) => setForm((f) => ({ ...f, remark: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as typeof form.status }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

          </div>
          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setSheetOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : (editTarget ? "Save changes" : "Add Remark")}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
