import { createFileRoute, useRouter } from "@tanstack/react-router";
import { PageSkeleton } from "@/components/page-skeleton";
import { PageHeader } from "@/components/page-header";
import { api, type ApiArtworkItem } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Plus, Trash2, Edit2, ImageIcon, Search, Upload, Calendar, ZoomIn } from "lucide-react";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const API_BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:3001"}`;

const ARTWORK_TYPES = [
  "Outer Carton Artwork",
  "Label Artwork",
  "Print Artwork",
  "Insert Artwork",
  "Box Artwork",
  "Pouch Artwork",
  "Sticker Artwork",
  "Other",
];

export const Route = createFileRoute("/_app/artwork/")({
  loader: async () => {
    if (typeof window === "undefined") return null;
    return { items: await api.artwork.list() };
  },
  pendingComponent: PageSkeleton,
  component: ArtworkPage,
  head: () => ({ meta: [{ title: "Artwork — Zoobalo" }] }),
});

const EMPTY: Omit<ApiArtworkItem, "id" | "createdAt" | "updatedAt"> = {
  skuName: "", artworkType: "", imageUrl: null,
  statusRemark: null, statusUpdatedAt: null, comment: null,
};

function ArtworkPage() {
  const data = Route.useLoaderData();
  if (!data) return <PageSkeleton />;
  return <ArtworkContent items={data.items} />;
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function ArtworkContent({ items }: { items: ApiArtworkItem[] }) {
  const router = useRouter();
  const reload = () => router.invalidate();

  const [search, setSearch] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<ApiArtworkItem | null>(null);
  const [form, setForm] = useState<typeof EMPTY>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = items.filter(
    (i) =>
      i.skuName.toLowerCase().includes(search.toLowerCase()) ||
      i.artworkType.toLowerCase().includes(search.toLowerCase()) ||
      (i.statusRemark ?? "").toLowerCase().includes(search.toLowerCase())
  );

  // Group by SKU name
  const grouped = filtered.reduce<Record<string, ApiArtworkItem[]>>((acc, item) => {
    (acc[item.skuName] ??= []).push(item);
    return acc;
  }, {});

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY);
    setSheetOpen(true);
  };

  const openEdit = (item: ApiArtworkItem) => {
    setEditing(item);
    setForm({
      skuName: item.skuName,
      artworkType: item.artworkType,
      imageUrl: item.imageUrl,
      statusRemark: item.statusRemark,
      statusUpdatedAt: item.statusUpdatedAt ? item.statusUpdatedAt.slice(0, 10) : null,
      comment: item.comment,
    });
    setSheetOpen(true);
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${API_BASE}/api/upload`, { method: "POST", body: fd });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Upload failed");
      setForm((p) => ({ ...p, imageUrl: `${API_BASE}${body.url}` }));
      toast.success("Image uploaded");
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!form.skuName.trim() || !form.artworkType) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        statusUpdatedAt: form.statusUpdatedAt || null,
      };
      if (editing) {
        await api.artwork.update(editing.id, payload);
        toast.success("Artwork updated");
      } else {
        await api.artwork.create(payload);
        toast.success("Artwork added");
      }
      setSheetOpen(false);
      await reload();
    } catch {
      toast.error("Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this artwork entry?")) return;
    try {
      await api.artwork.delete(id);
      toast.success("Deleted");
      await reload();
    } catch {
      toast.error("Delete failed");
    }
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Artwork"
        description="Track artwork versions and approval status for each SKU"
        actions={
          <Button onClick={openAdd} size="sm">
            <Plus className="mr-1 h-4 w-4" /> Add Artwork
          </Button>
        }
      />

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by SKU, type, status..."
          className="pl-8"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Empty state */}
      {items.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center text-muted-foreground">
          <ImageIcon className="mb-3 h-10 w-10 opacity-30" />
          <p className="text-sm">No artwork entries yet. Add one to start tracking.</p>
        </div>
      )}

      {/* Grouped by SKU */}
      <div className="space-y-6">
        {Object.entries(grouped).map(([skuName, skuItems]) => (
          <div key={skuName}>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{skuName}</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {skuItems.map((item) => (
                <div key={item.id} className="group relative rounded-xl border bg-card shadow-sm overflow-hidden">
                  {/* Image */}
                  <div className="relative h-40 bg-muted flex items-center justify-center overflow-hidden">
                    {item.imageUrl ? (
                      <div
                        className="group/img h-full w-full cursor-zoom-in"
                        onClick={() => setLightbox(item.imageUrl!)}
                      >
                        <img
                          src={item.imageUrl}
                          alt={item.artworkType}
                          className="h-full w-full object-contain p-2"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover/img:bg-black/20 transition-colors">
                          <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover/img:opacity-100 transition-opacity drop-shadow" />
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-muted-foreground">
                        <ImageIcon className="h-8 w-8 opacity-30" />
                        <span className="text-xs">No image</span>
                      </div>
                    )}
                    {/* Actions overlay */}
                    <div className="absolute right-2 top-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="secondary" size="icon" className="h-7 w-7 shadow"
                        onClick={() => openEdit(item)}
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="secondary" size="icon" className="h-7 w-7 shadow text-destructive hover:text-destructive"
                        onClick={() => handleDelete(item.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        {item.artworkType}
                      </span>
                      {item.statusUpdatedAt && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {fmtDate(item.statusUpdatedAt)}
                        </span>
                      )}
                    </div>

                    {item.statusRemark && (
                      <p className="text-sm font-medium leading-snug">{item.statusRemark}</p>
                    )}

                    {item.comment && (
                      <p className="text-xs text-muted-foreground line-clamp-2 italic">{item.comment}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox */}
      <Dialog open={!!lightbox} onOpenChange={(o) => !o && setLightbox(null)}>
        <DialogContent className="max-w-4xl p-2 bg-black border-0">
          {lightbox && (
            <img
              src={lightbox}
              alt="Artwork full view"
              className="max-h-[85vh] w-full object-contain rounded"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editing ? "Edit Artwork" : "Add Artwork"}</SheetTitle>
          </SheetHeader>

          <div className="mt-4 space-y-4">
            <div>
              <Label>SKU Name *</Label>
              <Input
                value={form.skuName}
                onChange={(e) => setForm((p) => ({ ...p, skuName: e.target.value }))}
                placeholder="e.g. CASS-50"
              />
            </div>

            <div>
              <Label>Artwork Type *</Label>
              <Select value={form.artworkType} onValueChange={(v) => setForm((p) => ({ ...p, artworkType: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {ARTWORK_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Artwork Image</Label>
              <div
                className={cn(
                  "mt-1 flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-4 text-center cursor-pointer transition-colors hover:bg-muted/50",
                  uploading && "opacity-60 pointer-events-none"
                )}
                onClick={() => fileRef.current?.click()}
              >
                {form.imageUrl ? (
                  <img src={form.imageUrl} alt="preview" className="mb-2 max-h-32 object-contain rounded" />
                ) : (
                  <Upload className="mb-2 h-6 w-6 text-muted-foreground" />
                )}
                <p className="text-xs text-muted-foreground">
                  {uploading ? "Uploading…" : form.imageUrl ? "Click to replace image" : "Click to upload image"}
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
                />
              </div>
            </div>

            <div>
              <Label>Current Status Remark</Label>
              <Input
                value={form.statusRemark ?? ""}
                onChange={(e) => setForm((p) => ({ ...p, statusRemark: e.target.value || null }))}
                placeholder="e.g. Approved, In Review, Changes Required"
              />
            </div>

            <div>
              <Label>Last Status Update Date</Label>
              <Input
                type="date"
                value={form.statusUpdatedAt ?? ""}
                onChange={(e) => setForm((p) => ({ ...p, statusUpdatedAt: e.target.value || null }))}
              />
            </div>

            <div>
              <Label>Comments</Label>
              <Textarea
                value={form.comment ?? ""}
                onChange={(e) => setForm((p) => ({ ...p, comment: e.target.value || null }))}
                placeholder="Any notes or feedback..."
                rows={3}
              />
            </div>
          </div>

          <SheetFooter className="mt-6">
            <Button
              onClick={save}
              disabled={saving || !form.skuName.trim() || !form.artworkType}
              className="w-full"
            >
              {saving ? "Saving..." : editing ? "Save Changes" : "Add Artwork"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
