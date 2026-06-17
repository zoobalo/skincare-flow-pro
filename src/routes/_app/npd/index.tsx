import { PageSkeleton } from "@/components/page-skeleton";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { api, type ApiNpd, type ApiNpdImageGroup } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, Edit2, ImageIcon, Upload, X, Calendar, FlaskConical, ChevronLeft, ChevronRight, Search, TableProperties } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/npd/")({
  loader: async () => {
    if (typeof window === "undefined") return null;
    const sharedTeamId = new URLSearchParams(window.location.search).get("sharedTeamId") ?? undefined;
    return { items: await api.npd.list(sharedTeamId), sharedTeamId };
  },
  pendingComponent: PageSkeleton,
  component: NpdPage,
  head: () => ({ meta: [{ title: "NPD — Zoobalo" }] }),
});

const API_BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:3001"}`;

const EMPTY: Omit<ApiNpd, "id" | "createdAt" | "updatedAt"> = {
  name: "", launchMonth: "", rmStatus: "", pmStatus: "", images: [], comments: "",
};

// ── Single-group image uploader (used inside ImageGroupManager) ───────────────
function MultiImageUpload({ images, onChange }: { images: string[]; onChange: (urls: string[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFiles = async (files: FileList) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    const newUrls: string[] = [];
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (!allowed.includes(file.type)) { toast.error(`${file.name}: unsupported format`); continue; }
        if (file.size > 5 * 1024 * 1024) { toast.error(`${file.name}: max 5 MB`); continue; }
        const fd = new FormData();
        fd.append("file", file);
        const res  = await fetch(`${API_BASE}/api/upload`, { method: "POST", body: fd });
        const body = await res.json();
        if (!res.ok) { toast.error(body.error ?? "Upload failed"); continue; }
        newUrls.push(`${API_BASE}${body.url}`);
      }
      if (newUrls.length) onChange([...images, ...newUrls]);
    } finally {
      setUploading(false);
    }
  };

  const remove = (idx: number) => onChange(images.filter((_, i) => i !== idx));

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        className="hidden"
        onChange={(e) => { if (e.target.files?.length) handleFiles(e.target.files); e.target.value = ""; }}
      />
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {images.map((url, i) => (
            <div key={i} className="relative group rounded-lg overflow-hidden border bg-muted aspect-square">
              <img src={url} className="h-full w-full object-cover" alt={`ref-${i + 1}`} />
              <button
                type="button"
                onClick={() => remove(i)}
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-background/80 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/30 py-6 text-sm text-muted-foreground transition-colors hover:border-primary hover:bg-primary/5 disabled:opacity-50"
      >
        {uploading ? <span className="text-xs">Uploading…</span> : (
          <>
            <ImageIcon className="h-6 w-6 opacity-40" />
            <span>Click to upload reference images</span>
            <span className="text-xs opacity-60">JPEG, PNG, WebP or GIF · max 5 MB each · multiple allowed</span>
          </>
        )}
      </button>
      {images.length > 0 && (
        <Button type="button" size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={uploading}>
          <Upload className="mr-1.5 h-3.5 w-3.5" />Add more images
        </Button>
      )}
    </div>
  );
}

// ── Image group manager ───────────────────────────────────────────────────────
function ImageGroupManager({ groups, onChange }: { groups: ApiNpdImageGroup[]; onChange: (g: ApiNpdImageGroup[]) => void }) {
  const addGroup = () => onChange([...groups, { name: "", images: [], comment: "" }]);
  const removeGroup = (i: number) => onChange(groups.filter((_, idx) => idx !== i));
  const update = (i: number, patch: Partial<ApiNpdImageGroup>) =>
    onChange(groups.map((g, idx) => (idx === i ? { ...g, ...patch } : g)));

  return (
    <div className="space-y-3">
      {groups.map((group, i) => (
        <div key={i} className="rounded-lg border p-3 space-y-2.5 bg-muted/20">
          <div className="flex items-center gap-2">
            <Input
              placeholder={`Group name (e.g. Packaging Ref ${i + 1})`}
              value={group.name}
              onChange={(e) => update(i, { name: e.target.value })}
              className="h-7 text-sm flex-1"
            />
            <button type="button" onClick={() => removeGroup(i)} className="text-destructive hover:opacity-70 shrink-0">
              <X className="h-4 w-4" />
            </button>
          </div>
          <MultiImageUpload images={group.images} onChange={(urls) => update(i, { images: urls })} />
          <Textarea
            rows={2}
            placeholder="Comment for this group (optional)…"
            value={group.comment}
            onChange={(e) => update(i, { comment: e.target.value })}
          />
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" onClick={addGroup}>
        <Plus className="mr-1.5 h-3.5 w-3.5" />Add image group
      </Button>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtLaunchMonth(val: string | null) {
  if (!val) return "—";
  const [y, m] = val.split("-");
  const names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${names[parseInt(m, 10) - 1] ?? m} ${y}`;
}

// Migrate legacy flat string[] to ImageGroup[] (old records stored images as string[])
function normalizeImageGroups(raw: any): ApiNpdImageGroup[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  if (typeof raw[0] === "string") return [];
  return raw as ApiNpdImageGroup[];
}

// ── Lightbox ──────────────────────────────────────────────────────────────────
function Lightbox({ lightbox, onClose, onPrev, onNext }: {
  lightbox: { urls: string[]; idx: number };
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90" onClick={onClose}>
      <div className="relative flex items-center justify-center w-full h-full" onClick={(e) => e.stopPropagation()}>
        <img src={lightbox.urls[lightbox.idx]} alt={`image-${lightbox.idx + 1}`} className="max-h-[85vh] max-w-[85vw] object-contain select-none rounded-lg" />
        <button type="button" onClick={onClose} className="absolute right-6 top-6 flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/40 transition-colors">
          <X className="h-5 w-5" />
        </button>
        {lightbox.idx > 0 && (
          <button type="button" onClick={(e) => { e.stopPropagation(); onPrev(); }} className="absolute left-6 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/40 transition-colors">
            <ChevronLeft className="h-7 w-7" />
          </button>
        )}
        {lightbox.idx < lightbox.urls.length - 1 && (
          <button type="button" onClick={(e) => { e.stopPropagation(); onNext(); }} className="absolute right-6 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/40 transition-colors">
            <ChevronRight className="h-7 w-7" />
          </button>
        )}
        {lightbox.urls.length > 1 && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-4 py-1.5 text-white/90 text-sm tabular-nums">
            {lightbox.idx + 1} / {lightbox.urls.length}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
function NpdPage() {
  const loaderData = Route.useLoaderData();
  if (!loaderData) return <PageSkeleton />;
  return <NpdContent rawItems={loaderData.items} sharedTeamId={loaderData.sharedTeamId} />;
}

function NpdContent({ rawItems, sharedTeamId }: { rawItems: ApiNpd[]; sharedTeamId?: string }) {
  const [search, setSearch] = useState("");
  const allItems = rawItems.map((item) => ({ ...item, images: normalizeImageGroups(item.images) }));
  const items = allItems.filter((item) => {
    const q = search.toLowerCase();
    return !q || item.name.toLowerCase().includes(q) || item.rmStatus.toLowerCase().includes(q) || item.pmStatus.toLowerCase().includes(q) || (item.comments ?? "").toLowerCase().includes(q);
  });
  const router = useRouter();
  const reload = () => router.invalidate();

  const [sheetOpen, setSheetOpen]   = useState(false);
  const [editTarget, setEditTarget] = useState<ApiNpd | null>(null);
  const [viewDialog, setViewDialog] = useState<{ title: string; content: string } | null>(null);
  const [viewImagesDialog, setViewImagesDialog] = useState<{ npdName: string; groups: ApiNpdImageGroup[] } | null>(null);
  const [lightbox, setLightbox] = useState<{ urls: string[]; idx: number } | null>(null);
  const lightboxPrev = () => setLightbox((l) => l && l.idx > 0 ? { ...l, idx: l.idx - 1 } : l);
  const lightboxNext = () => setLightbox((l) => l && l.idx < l.urls.length - 1 ? { ...l, idx: l.idx + 1 } : l);
  const [saving, setSaving]         = useState(false);
  const [form, setForm]             = useState({ ...EMPTY });

  const setF = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [f]: e.target.value }));

  const openCreate = () => { setForm({ ...EMPTY }); setEditTarget(null); setSheetOpen(true); };
  const openEdit   = (item: ApiNpd) => {
    setForm({ name: item.name, launchMonth: item.launchMonth ?? "", rmStatus: item.rmStatus, pmStatus: item.pmStatus, images: normalizeImageGroups(item.images), comments: item.comments });
    setEditTarget(item);
    setSheetOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("NPD name is required."); return; }
    setSaving(true);
    try {
      const payload = { ...form, launchMonth: form.launchMonth || null };
      if (editTarget) {
        await api.npd.update(editTarget.id, payload);
        toast.success("NPD updated.");
      } else {
        await api.npd.create(payload, sharedTeamId);
        toast.success("NPD added.");
      }
      setSheetOpen(false);
      await reload();
    } catch { toast.error("Failed to save."); } finally { setSaving(false); }
  };

  const handleDelete = async (item: ApiNpd) => {
    if (!confirm(`Delete "${item.name}"?`)) return;
    try { await api.npd.delete(item.id); toast.success("Deleted."); reload(); }
    catch { toast.error("Failed to delete."); }
  };

  const openInGoogleSheets = async () => {
    const cell = (v: string) => (v ?? "").replace(/\r?\n/g, " ").replace(/\t/g, " ");

    const HEADERS = [
      "Product Name", "Launch Month", "RM Status", "PM Status",
      "Group Name", "Image", "Open Full Size", "Group Comment", "General Comments", "_id",
    ];

    const rows: string[][] = [HEADERS];

    allItems.forEach((item) => {
      const base = [
        cell(item.name),
        cell(fmtLaunchMonth(item.launchMonth ?? null)),
        cell(item.rmStatus || ""),
        cell(item.pmStatus || ""),
      ];

      if (item.images.length === 0) {
        rows.push([...base, "", "", "", "", cell(item.comments || ""), `${item.id}_noimg`]);
        return;
      }

      item.images.forEach((group, gi) => {
        const groupName    = cell(group.name || "Unnamed Group");
        const groupComment = cell(group.comment || "");

        if (group.images.length === 0) {
          rows.push([...base, groupName, "", "", groupComment, cell(item.comments || ""), `${item.id}_g${gi}_noimg`]);
          return;
        }

        group.images.forEach((url, ii) => {
          rows.push([
            ...base,
            groupName,
            `=IMAGE("${url}")`,
            `=HYPERLINK("${url}","🔍 Open")`,
            groupComment,
            ii === 0 ? cell(item.comments || "") : "",
            `${item.id}_g${gi}_i${ii}`,
          ]);
        });
      });
    });

    try {
      const token = localStorage.getItem("zoobalo_token");
      const res  = await fetch(`${API_BASE}/api/npd/sync-sheet`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ rows }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Sync failed");
      window.open(data.url, "_blank");
      toast.success("Google Sheet updated! Opening now…");
    } catch (err: any) {
      toast.error(err?.message || "Failed to sync with Google Sheets.");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Product Development"
        description={`${allItems.length} product${allItems.length !== 1 ? "s" : ""} in pipeline`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={openInGoogleSheets} disabled={allItems.length === 0}>
              <TableProperties className="mr-1.5 h-4 w-4" />Open in Google Sheets
            </Button>
            <Button onClick={openCreate}>
              <Plus className="mr-1.5 h-4 w-4" />Add New NPD
            </Button>
          </div>
        }
      />

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search NPD entries…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border bg-card p-16 text-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <FlaskConical className="h-7 w-7" />
          </div>
          <div>
            {allItems.length === 0 ? (
              <>
                <p className="font-semibold">No NPD entries yet</p>
                <p className="mt-1 text-sm text-muted-foreground">Click "Add New NPD" to start tracking your R&D pipeline.</p>
              </>
            ) : (
              <>
                <p className="font-semibold">No entries match your search</p>
                <p className="mt-1 text-sm text-muted-foreground">Try a different search term.</p>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-xl border bg-card p-4 flex gap-6 items-start">

              {/* Col 1 — Name + launch + actions */}
              <div className="w-52 shrink-0 space-y-1">
                <h3 className="font-semibold leading-snug">{item.name}</h3>
                {item.launchMonth && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>{fmtLaunchMonth(item.launchMonth)}</span>
                  </div>
                )}
                <div className="flex items-center gap-0.5 pt-1">
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(item)}>
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => handleDelete(item)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* Col 2 — RM Status */}
              <div className="flex-1 min-w-0 rounded-lg bg-muted/40 p-2.5 text-xs">
                <div className="font-semibold text-muted-foreground mb-1 uppercase tracking-wide text-[10px]">RM Status</div>
                {item.rmStatus ? (
                  <>
                    <p className="leading-relaxed line-clamp-5">{item.rmStatus}</p>
                    <button type="button" onClick={() => setViewDialog({ title: "RM Status", content: item.rmStatus })} className="mt-1 text-[10px] text-primary hover:underline">View all</button>
                  </>
                ) : <span>—</span>}
              </div>

              {/* Col 3 — PM Status */}
              <div className="flex-1 min-w-0 rounded-lg bg-muted/40 p-2.5 text-xs">
                <div className="font-semibold text-muted-foreground mb-1 uppercase tracking-wide text-[10px]">PM Status</div>
                {item.pmStatus ? (
                  <>
                    <p className="leading-relaxed line-clamp-5">{item.pmStatus}</p>
                    <button type="button" onClick={() => setViewDialog({ title: "PM Status", content: item.pmStatus })} className="mt-1 text-[10px] text-primary hover:underline">View all</button>
                  </>
                ) : <span>—</span>}
              </div>

              {/* Col 4 — Image groups (preview) */}
              <div className="w-52 shrink-0">
                {item.images && item.images.length > 0 ? (() => {
                  const firstGroup = item.images[0];
                  const totalImages = item.images.reduce((s, g) => s + g.images.length, 0);
                  return (
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {firstGroup.name || "Group 1"} ({firstGroup.images.length})
                      </p>
                      <div className="flex gap-1.5 flex-wrap">
                        {firstGroup.images.slice(0, 3).map((url, i) => (
                          <button key={i} type="button" onClick={() => setLightbox({ urls: firstGroup.images, idx: i })}>
                            <img src={url} alt={`ref-${i + 1}`} className="h-12 w-12 rounded-md object-cover border hover:opacity-80 transition-opacity cursor-zoom-in" />
                          </button>
                        ))}
                        {firstGroup.images.length > 3 && (
                          <div className="h-12 w-12 rounded-md border bg-muted flex items-center justify-center text-[10px] text-muted-foreground font-medium">
                            +{firstGroup.images.length - 3}
                          </div>
                        )}
                      </div>
                      {firstGroup.comment && (
                        <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2">{firstGroup.comment}</p>
                      )}
                      <button
                        type="button"
                        onClick={() => setViewImagesDialog({ npdName: item.name, groups: item.images })}
                        className="mt-0.5 text-[10px] text-primary hover:underline"
                      >
                        View all · {item.images.length} group{item.images.length !== 1 ? "s" : ""} · {totalImages} image{totalImages !== 1 ? "s" : ""}
                      </button>
                    </div>
                  );
                })() : (
                  <span className="text-xs text-muted-foreground">No images</span>
                )}
              </div>

              {/* Col 5 — Comments */}
              <div className="flex-1 min-w-0 text-xs text-muted-foreground leading-relaxed">
                {item.comments ? (
                  <>
                    <div className="font-semibold text-muted-foreground mb-1 uppercase tracking-wide text-[10px]">Comments</div>
                    <p className="line-clamp-5">{item.comments}</p>
                    <button type="button" onClick={() => setViewDialog({ title: "Comments", content: item.comments })} className="mt-1 text-[10px] text-primary hover:underline">View all</button>
                  </>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>

            </div>
          ))}
        </div>
      )}

      {/* View all text Dialog */}
      <Dialog open={!!viewDialog} onOpenChange={(open) => { if (!open) setViewDialog(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{viewDialog?.title}</DialogTitle>
          </DialogHeader>
          <p className="text-sm leading-relaxed whitespace-pre-wrap max-h-[60vh] overflow-y-auto">
            {viewDialog?.content}
          </p>
        </DialogContent>
      </Dialog>

      {/* View all images Dialog */}
      <Dialog open={!!viewImagesDialog} onOpenChange={(open) => { if (!open) { setViewImagesDialog(null); setLightbox(null); } }}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{viewImagesDialog?.npdName} — Reference Images</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 space-y-6 pr-1">
            {viewImagesDialog?.groups.map((group, gi) => (
              <div key={gi} className="space-y-2">
                <h4 className="text-sm font-semibold">{group.name || `Group ${gi + 1}`} <span className="text-muted-foreground font-normal">({group.images.length} image{group.images.length !== 1 ? "s" : ""})</span></h4>
                {group.images.length > 0 ? (
                  <div className="grid grid-cols-4 gap-2">
                    {group.images.map((url, i) => (
                      <button key={i} type="button" onClick={() => setLightbox({ urls: group.images, idx: i })}>
                        <img src={url} alt={`ref-${i + 1}`} className="w-full aspect-square rounded-lg object-cover border hover:opacity-80 transition-opacity cursor-zoom-in" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No images in this group.</p>
                )}
                {group.comment && (
                  <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">{group.comment}</p>
                )}
              </div>
            ))}
          </div>
          {/* Lightbox inside dialog: Radix won't treat clicks as "outside" */}
          {lightbox && viewImagesDialog && <Lightbox lightbox={lightbox} onClose={() => setLightbox(null)} onPrev={lightboxPrev} onNext={lightboxNext} />}
        </DialogContent>
      </Dialog>

      {/* Standalone lightbox for direct image clicks (no dialog open) */}
      {lightbox && !viewImagesDialog && <Lightbox lightbox={lightbox} onClose={() => setLightbox(null)} onPrev={lightboxPrev} onNext={lightboxNext} />}

      {/* Create / Edit Sheet */}
      <Sheet key={editTarget?.id ?? "new"} open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editTarget ? "Edit NPD" : "Add New NPD"}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 grid grid-cols-1 gap-5">

            <div className="space-y-1.5">
              <Label>NPD Name *</Label>
              <Input placeholder="e.g. SPF 50+ Invisible Mist v2" value={form.name} onChange={setF("name")} />
            </div>

            <div className="space-y-1.5">
              <Label>Launch Month</Label>
              <Input type="month" value={form.launchMonth ?? ""} onChange={setF("launchMonth")} />
            </div>

            <div className="space-y-1.5">
              <Label>RM Status</Label>
              <Textarea rows={3} placeholder="Raw material procurement status…" value={form.rmStatus} onChange={setF("rmStatus")} />
            </div>

            <div className="space-y-1.5">
              <Label>PM Status</Label>
              <Textarea rows={3} placeholder="Packaging material status…" value={form.pmStatus} onChange={setF("pmStatus")} />
            </div>

            <div className="space-y-1.5">
              <Label>Reference Image Groups</Label>
              <p className="text-xs text-muted-foreground">Create named groups of images — each group can have its own images and a comment.</p>
              <ImageGroupManager
                groups={form.images}
                onChange={(groups) => setForm((f) => ({ ...f, images: groups }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Comments</Label>
              <Textarea rows={3} placeholder="Any additional notes…" value={form.comments} onChange={setF("comments")} />
            </div>

          </div>
          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setSheetOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : (editTarget ? "Save changes" : "Add NPD")}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
