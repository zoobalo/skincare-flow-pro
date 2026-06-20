import { createFileRoute } from "@tanstack/react-router";
import { PageSkeleton } from "@/components/page-skeleton";
import { PageHeader } from "@/components/page-header";
import { api, warehouseQcApi, type ApiWarehouseQc, type ApiSku } from "@/lib/api";
import { ImageUpload } from "@/components/image-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, ShieldCheck, ExternalLink, ImageIcon, Search, CalendarDays, User } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/warehouse-qc/")({
  loader: async () => {
    if (typeof window === "undefined") return null;
    const [records, skus] = await Promise.all([
      warehouseQcApi.list(),
      api.skus.list(),
    ]);
    return { records, skus };
  },
  pendingComponent: PageSkeleton,
  component: WarehouseQcPage,
  head: () => ({ meta: [{ title: "Warehouse QC — Zoobalo" }] }),
});

const QC_TYPES = ["Internal", "External"];

const EMPTY_FORM = {
  qcDate:         "",
  qcDoneBy:       "",
  qcTypes:        [] as string[],
  skuIds:         [] as string[],
  reportText:     "",
  reportImageUrl: "",
  reportLink:     "",
  comment:        "",
};

function fmtDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function WarehouseQcPage() {
  const data = Route.useLoaderData();
  if (!data) return <PageSkeleton />;
  return <WarehouseQcContent initialRecords={data.records} skus={data.skus} />;
}

function WarehouseQcContent({ initialRecords, skus }: { initialRecords: ApiWarehouseQc[]; skus: ApiSku[] }) {
  const [records, setRecords] = useState(initialRecords);
  const [search, setSearch] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<ApiWarehouseQc | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [skuSearch, setSkuSearch] = useState("");

  const skuMap = Object.fromEntries(skus.map((s) => [s.id, s]));

  const filtered = records.filter((r) => {
    const q = search.toLowerCase();
    if (!q) return true;
    const skuNames = r.skuIds.map((id) => skuMap[id]?.name ?? "").join(" ");
    return (
      r.qcDoneBy.toLowerCase().includes(q) ||
      r.qcDate.includes(q) ||
      r.reportText.toLowerCase().includes(q) ||
      r.comment.toLowerCase().includes(q) ||
      skuNames.toLowerCase().includes(q)
    );
  });

  const openAdd = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, qcDate: new Date().toISOString().slice(0, 10) });
    setSkuSearch("");
    setSheetOpen(true);
  };

  const openEdit = (r: ApiWarehouseQc) => {
    setEditing(r);
    setForm({
      qcDate:         r.qcDate,
      qcDoneBy:       r.qcDoneBy,
      qcTypes:        [...r.qcTypes],
      skuIds:         [...r.skuIds],
      reportText:     r.reportText,
      reportImageUrl: r.reportImageUrl ?? "",
      reportLink:     r.reportLink ?? "",
      comment:        r.comment,
    });
    setSkuSearch("");
    setSheetOpen(true);
  };

  const toggleQcType = (t: string) =>
    setForm((f) => ({
      ...f,
      qcTypes: f.qcTypes.includes(t) ? f.qcTypes.filter((x) => x !== t) : [...f.qcTypes, t],
    }));

  const toggleSku = (id: string) =>
    setForm((f) => ({
      ...f,
      skuIds: f.skuIds.includes(id) ? f.skuIds.filter((x) => x !== id) : [...f.skuIds, id],
    }));

  const save = async () => {
    if (!form.qcDate || !form.qcDoneBy.trim()) {
      toast.error("QC date and QC done by are required.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        qcDate:         form.qcDate,
        qcDoneBy:       form.qcDoneBy.trim(),
        qcTypes:        form.qcTypes,
        skuIds:         form.skuIds,
        reportText:     form.reportText,
        reportImageUrl: form.reportImageUrl || null,
        reportLink:     form.reportLink || null,
        comment:        form.comment,
      };
      if (editing) {
        const updated = await warehouseQcApi.update(editing.id, payload);
        if (updated.error) { toast.error(updated.error); return; }
        setRecords((prev) => prev.map((r) => r.id === editing.id ? updated : r));
        toast.success("QC record updated.");
      } else {
        const created = await warehouseQcApi.create(payload);
        if (created.error) { toast.error(created.error); return; }
        setRecords((prev) => [created, ...prev]);
        toast.success("QC record added.");
      }
      setSheetOpen(false);
    } catch {
      toast.error("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this QC record?")) return;
    try {
      await warehouseQcApi.delete(id);
      setRecords((prev) => prev.filter((r) => r.id !== id));
      toast.success("Deleted.");
    } catch {
      toast.error("Failed to delete.");
    }
  };

  const visibleSkus = skus.filter((s) => {
    const q = skuSearch.toLowerCase();
    return !q || s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Warehouse QC"
        description="Quality control records for SKUs"
        actions={
          <Button size="sm" onClick={openAdd}>
            <Plus className="mr-1.5 h-4 w-4" /> Add QC Record
          </Button>
        }
      />

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search records…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center text-muted-foreground">
          <ShieldCheck className="mb-3 h-10 w-10 opacity-30" />
          <p className="text-sm font-medium">No QC records yet.</p>
          <p className="mt-1 text-xs">Click "Add QC Record" to log your first quality check.</p>
        </div>
      )}

      {/* Records */}
      <div className="space-y-4">
        {filtered.map((r) => {
          const skuNames = r.skuIds.map((id) => skuMap[id]).filter(Boolean);
          return (
            <div key={r.id} className="group rounded-xl border bg-card shadow-sm overflow-hidden">
              {/* Header */}
              <div className="flex items-start justify-between gap-3 px-4 py-3 border-b bg-muted/20">
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  <div className="flex items-center gap-1.5 text-sm font-semibold">
                    <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                    {fmtDate(r.qcDate)}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <User className="h-3 w-3" />
                    {r.qcDoneBy}
                  </div>
                  {r.qcTypes.map((t) => (
                    <Badge key={t} variant="outline" className={cn(
                      "text-xs",
                      t === "Internal" && "border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400",
                      t === "External" && "border-purple-300 bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400",
                    )}>
                      {t}
                    </Badge>
                  ))}
                </div>
                <div className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(r)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(r.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <div className="px-4 py-3 space-y-3">
                {/* SKUs */}
                {skuNames.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {skuNames.map((s) => (
                      <Badge key={s!.id} variant="secondary" className="text-xs font-normal">
                        {s!.code} — {s!.name}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Report text */}
                {r.reportText && (
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{r.reportText}</p>
                )}

                {/* Report image */}
                {r.reportImageUrl && (
                  <a href={r.reportImageUrl} target="_blank" rel="noopener noreferrer">
                    <img
                      src={r.reportImageUrl}
                      alt="QC report"
                      className="h-40 w-auto max-w-full rounded-lg border object-cover hover:opacity-90 transition-opacity"
                    />
                  </a>
                )}

                {/* Report link + comment */}
                <div className="flex flex-wrap gap-x-6 gap-y-1">
                  {r.reportLink && (
                    <a
                      href={r.reportLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {r.reportLink}
                    </a>
                  )}
                  {r.comment && (
                    <p className="text-xs text-muted-foreground italic">{r.comment}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{editing ? "Edit QC Record" : "Add QC Record"}</SheetTitle>
          </SheetHeader>

          <div className="mt-4 space-y-5">
            {/* QC Date */}
            <div className="space-y-1.5">
              <Label>QC Date <span className="text-destructive">*</span></Label>
              <input
                type="date"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={form.qcDate}
                onChange={(e) => setForm((f) => ({ ...f, qcDate: e.target.value }))}
              />
            </div>

            {/* QC Done By */}
            <div className="space-y-1.5">
              <Label>QC Done By <span className="text-destructive">*</span></Label>
              <Input
                placeholder="Name of the person"
                value={form.qcDoneBy}
                onChange={(e) => setForm((f) => ({ ...f, qcDoneBy: e.target.value }))}
              />
            </div>

            {/* QC Type */}
            <div className="space-y-2">
              <Label>QC Type</Label>
              <div className="flex gap-3">
                {QC_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleQcType(t)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                      form.qcTypes.includes(t)
                        ? "border-primary bg-primary/10 text-primary font-medium"
                        : "border-input bg-background text-muted-foreground hover:border-primary/50"
                    )}
                  >
                    <div className={cn(
                      "h-4 w-4 rounded border-2 flex items-center justify-center flex-shrink-0",
                      form.qcTypes.includes(t) ? "border-primary bg-primary" : "border-muted-foreground"
                    )}>
                      {form.qcTypes.includes(t) && (
                        <svg className="h-2.5 w-2.5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* SKU selection */}
            <div className="space-y-2">
              <Label>SKUs</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search SKUs…"
                  className="pl-8 h-8 text-sm"
                  value={skuSearch}
                  onChange={(e) => setSkuSearch(e.target.value)}
                />
              </div>
              <div className="max-h-40 overflow-y-auto rounded-lg border divide-y">
                {visibleSkus.length === 0 && (
                  <p className="px-3 py-4 text-center text-xs text-muted-foreground">No SKUs found</p>
                )}
                {visibleSkus.map((s) => {
                  const selected = form.skuIds.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleSku(s.id)}
                      className={cn(
                        "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors",
                        selected ? "bg-primary/5" : "hover:bg-muted/50"
                      )}
                    >
                      <div className={cn(
                        "h-4 w-4 rounded border-2 flex items-center justify-center flex-shrink-0",
                        selected ? "border-primary bg-primary" : "border-muted-foreground/50"
                      )}>
                        {selected && (
                          <svg className="h-2.5 w-2.5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className="truncate">
                        <span className="font-mono text-xs text-muted-foreground">{s.code}</span>
                        {" — "}
                        {s.name}
                      </span>
                    </button>
                  );
                })}
              </div>
              {form.skuIds.length > 0 && (
                <p className="text-xs text-muted-foreground">{form.skuIds.length} SKU{form.skuIds.length > 1 ? "s" : ""} selected</p>
              )}
            </div>

            {/* Report text */}
            <div className="space-y-1.5">
              <Label>Report</Label>
              <Textarea
                placeholder="Detailed QC report…"
                rows={4}
                value={form.reportText}
                onChange={(e) => setForm((f) => ({ ...f, reportText: e.target.value }))}
              />
            </div>

            {/* Report image */}
            <div className="space-y-1.5">
              <Label>Report Image / File</Label>
              <ImageUpload
                value={form.reportImageUrl}
                onChange={(url) => setForm((f) => ({ ...f, reportImageUrl: url }))}
              />
            </div>

            {/* Report link */}
            <div className="space-y-1.5">
              <Label>Report Link</Label>
              <Input
                placeholder="https://drive.google.com/…"
                value={form.reportLink}
                onChange={(e) => setForm((f) => ({ ...f, reportLink: e.target.value }))}
              />
            </div>

            {/* Comment */}
            <div className="space-y-1.5">
              <Label>Comment</Label>
              <Textarea
                placeholder="Any additional notes…"
                rows={2}
                value={form.comment}
                onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))}
              />
            </div>
          </div>

          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setSheetOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : editing ? "Save Changes" : "Add Record"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
