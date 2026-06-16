import { createFileRoute, useRouter } from "@tanstack/react-router";
import { PageSkeleton } from "@/components/page-skeleton";
import { PageHeader } from "@/components/page-header";
import { api, type ApiArtworkItem, type ApiArtworkComment } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Plus, Trash2, Edit2, ImageIcon, Search, Upload, Calendar, ZoomIn, Link2, MessageSquare, Send } from "lucide-react";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getUser } from "@/lib/auth";

const API_BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:3001"}`;

const ARTWORK_TYPE_OPTIONS = [
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
  statusRemark: null, statusUpdatedAt: null, comment: null, fileLink: null,
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

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

function typeToDropdown(artworkType: string): string {
  if (!artworkType) return "";
  return ARTWORK_TYPE_OPTIONS.includes(artworkType) ? artworkType : "Other";
}

function ArtworkContent({ items }: { items: ApiArtworkItem[] }) {
  const router = useRouter();
  const reload = () => router.invalidate();

  const [search, setSearch] = useState("");

  // Edit/Add sheet
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<ApiArtworkItem | null>(null);
  const [form, setForm] = useState<typeof EMPTY>(EMPTY);
  const [typeSelection, setTypeSelection] = useState("");
  const [customType, setCustomType] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Lightbox
  const [lightbox, setLightbox] = useState<string | null>(null);

  // Comments panel
  const [commentArtwork, setCommentArtwork] = useState<ApiArtworkItem | null>(null);
  const [comments, setComments] = useState<ApiArtworkComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [sendingComment, setSendingComment] = useState(false);

  const filtered = items.filter(
    (i) =>
      i.skuName.toLowerCase().includes(search.toLowerCase()) ||
      i.artworkType.toLowerCase().includes(search.toLowerCase()) ||
      (i.statusRemark ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const grouped = filtered.reduce<Record<string, ApiArtworkItem[]>>((acc, item) => {
    (acc[item.skuName] ??= []).push(item);
    return acc;
  }, {});

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY);
    setTypeSelection("");
    setCustomType("");
    setSheetOpen(true);
  };

  const openEdit = (item: ApiArtworkItem) => {
    setEditing(item);
    const dropdown = typeToDropdown(item.artworkType);
    setTypeSelection(dropdown);
    setCustomType(dropdown === "Other" ? item.artworkType : "");
    setForm({
      skuName: item.skuName,
      artworkType: item.artworkType,
      imageUrl: item.imageUrl,
      statusRemark: item.statusRemark,
      statusUpdatedAt: item.statusUpdatedAt ? item.statusUpdatedAt.slice(0, 10) : null,
      comment: item.comment,
      fileLink: item.fileLink,
    });
    setSheetOpen(true);
  };

  const openComments = async (item: ApiArtworkItem) => {
    setCommentArtwork(item);
    setNewComment("");
    setCommentsLoading(true);
    try {
      const data = await api.artwork.listComments(item.id);
      setComments(data);
    } catch {
      toast.error("Failed to load comments");
    } finally {
      setCommentsLoading(false);
    }
  };

  const sendComment = async () => {
    if (!newComment.trim() || !commentArtwork) return;
    setSendingComment(true);
    try {
      const created = await api.artwork.addComment(commentArtwork.id, newComment.trim());
      if (created.error) { toast.error(created.error); return; }
      setComments((prev) => [...prev, created]);
      setNewComment("");
    } catch {
      toast.error("Failed to add comment");
    } finally {
      setSendingComment(false);
    }
  };

  const deleteComment = async (commentId: string) => {
    if (!commentArtwork) return;
    try {
      await api.artwork.deleteComment(commentArtwork.id, commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch {
      toast.error("Failed to delete comment");
    }
  };

  const handleTypeChange = (v: string) => {
    setTypeSelection(v);
    if (v !== "Other") {
      setCustomType("");
      setForm((p) => ({ ...p, artworkType: v }));
    } else {
      setForm((p) => ({ ...p, artworkType: "" }));
    }
  };

  const handleCustomTypeChange = (v: string) => {
    setCustomType(v);
    setForm((p) => ({ ...p, artworkType: v }));
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
    if (!form.skuName.trim()) { toast.error("SKU name is required"); return; }
    if (!form.artworkType.trim()) {
      toast.error(typeSelection === "Other" ? "Please enter the custom artwork type name" : "Artwork type is required");
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, statusUpdatedAt: form.statusUpdatedAt || null, fileLink: form.fileLink || null };
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

  const currentUser = getUser();

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

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by SKU, type, status..."
          className="pl-8"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {items.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center text-muted-foreground">
          <ImageIcon className="mb-3 h-10 w-10 opacity-30" />
          <p className="text-sm">No artwork entries yet. Add one to start tracking.</p>
        </div>
      )}

      <div className="space-y-6">
        {Object.entries(grouped).map(([skuName, skuItems]) => (
          <div key={skuName}>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{skuName}</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {skuItems.map((item) => (
                <div key={item.id} className="group rounded-xl border bg-card shadow-sm overflow-hidden">
                  <div className="p-4 space-y-3">
                    {/* Header row: type badge + action buttons */}
                    <div className="flex items-start justify-between gap-2">
                      <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary truncate max-w-[70%]">
                        {item.artworkType}
                      </span>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7"
                          title="Comments"
                          onClick={() => openComments(item)}
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7"
                          onClick={() => openEdit(item)}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(item.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Status + date */}
                    {(item.statusRemark || item.statusUpdatedAt) && (
                      <div className="space-y-0.5">
                        {item.statusRemark && (
                          <p className="text-sm font-medium leading-snug">{item.statusRemark}</p>
                        )}
                        {item.statusUpdatedAt && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {fmtDate(item.statusUpdatedAt)}
                          </span>
                        )}
                      </div>
                    )}

                    {/* File link */}
                    {item.fileLink && (
                      <a
                        href={item.fileLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs text-primary hover:underline truncate"
                      >
                        <Link2 className="h-3 w-3 shrink-0" />
                        <span className="truncate">View artwork file</span>
                      </a>
                    )}

                    {/* Comment */}
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

      {/* Lightbox (kept for any future image views) */}
      <Dialog open={!!lightbox} onOpenChange={(o) => !o && setLightbox(null)}>
        <DialogContent className="max-w-4xl p-2 bg-black border-0">
          {lightbox && <img src={lightbox} alt="Artwork full view" className="max-h-[85vh] w-full object-contain rounded" />}
        </DialogContent>
      </Dialog>

      {/* Comments Sheet */}
      <Sheet open={!!commentArtwork} onOpenChange={(o) => !o && setCommentArtwork(null)}>
        <SheetContent className="flex flex-col overflow-hidden sm:max-w-md">
          <SheetHeader className="shrink-0">
            <SheetTitle className="leading-tight">
              Comments
              {commentArtwork && (
                <span className="block text-sm font-normal text-muted-foreground mt-0.5">
                  {commentArtwork.skuName} · {commentArtwork.artworkType}
                </span>
              )}
            </SheetTitle>
          </SheetHeader>

          {/* Comments list */}
          <div className="flex-1 overflow-y-auto py-4 space-y-3 min-h-0">
            {commentsLoading ? (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">Loading…</div>
            ) : comments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <MessageSquare className="h-8 w-8 opacity-30 mb-2" />
                <p className="text-sm">No comments yet. Be the first to add one.</p>
              </div>
            ) : (
              comments.map((c) => (
                <div key={c.id} className="group rounded-lg border bg-muted/30 px-3 py-2.5 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold">{c.authorName}</span>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-muted-foreground">{fmtDateTime(c.createdAt)}</span>
                      <Button
                        variant="ghost" size="icon"
                        className="h-5 w-5 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                        onClick={() => deleteComment(c.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed">{c.text}</p>
                </div>
              ))
            )}
          </div>

          {/* Add comment input */}
          <div className="shrink-0 border-t pt-4">
            <div className="flex gap-2">
              <Textarea
                placeholder="Write a comment…"
                className="min-h-[64px] resize-none text-sm"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendComment(); }
                }}
              />
              <Button
                size="icon"
                className="h-auto self-end shrink-0"
                disabled={!newComment.trim() || sendingComment}
                onClick={sendComment}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="mt-1.5 text-[10px] text-muted-foreground">Press Enter to send · Shift+Enter for new line</p>
          </div>
        </SheetContent>
      </Sheet>

      {/* Edit / Add Sheet */}
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
              <Select value={typeSelection} onValueChange={handleTypeChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {ARTWORK_TYPE_OPTIONS.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {typeSelection === "Other" && (
                <Input
                  className="mt-2"
                  placeholder="Enter artwork type name..."
                  value={customType}
                  onChange={(e) => handleCustomTypeChange(e.target.value)}
                  autoFocus
                />
              )}
            </div>

            <div>
              <Label>Artwork File Link</Label>
              <div className="relative">
                <Link2 className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  value={form.fileLink ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, fileLink: e.target.value || null }))}
                  placeholder="https://drive.google.com/..."
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Paste a link to where the artwork file is saved (Drive, Dropbox, etc.)</p>
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
              disabled={saving || !form.skuName.trim() || !form.artworkType.trim()}
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
