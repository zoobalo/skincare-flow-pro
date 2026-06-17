import { createFileRoute, useRouter } from "@tanstack/react-router";
import { PageSkeleton } from "@/components/page-skeleton";
import { PageHeader } from "@/components/page-header";
import { api, type ApiDirectoryEntry } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, Edit2, BookUser, Phone, Mail, MapPin, MessageSquare } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/directory/")({
  loader: async () => {
    if (typeof window === "undefined") return null;
    const sharedTeamId = new URLSearchParams(window.location.search).get("sharedTeamId") ?? undefined;
    return { entries: await api.directory.list(sharedTeamId), sharedTeamId };
  },
  pendingComponent: PageSkeleton,
  component: DirectoryPage,
  head: () => ({ meta: [{ title: "Directory — Zoobalo" }] }),
});

const CATEGORIES = [
  "Transporter",
  "Contract Manufacturer",
  "Packaging Material",
  "Raw Material",
  "Lab & Testing",
  "Regulatory",
  "Other",
] as const;

const CATEGORY_COLORS: Record<string, string> = {
  "Transporter":           "bg-blue-100 text-blue-800 border-blue-200",
  "Contract Manufacturer": "bg-purple-100 text-purple-800 border-purple-200",
  "Packaging Material":    "bg-amber-100 text-amber-800 border-amber-200",
  "Raw Material":          "bg-green-100 text-green-800 border-green-200",
  "Lab & Testing":         "bg-cyan-100 text-cyan-800 border-cyan-200",
  "Regulatory":            "bg-rose-100 text-rose-800 border-rose-200",
  "Other":                 "bg-muted text-muted-foreground border-border",
};

const EMPTY: Omit<ApiDirectoryEntry, "id" | "createdAt" | "updatedAt"> = {
  name: "", category: "Other", address: "", state: "", country: "",
  contact1Name: "", contact1Phone: "", contact2Name: "", contact2Phone: "",
  email1: "", email2: "", comment: "",
};

function DirectoryPage() {
  const loaderData = Route.useLoaderData();
  if (!loaderData) return <PageSkeleton />;
  return <DirectoryContent items={loaderData.entries} sharedTeamId={loaderData.sharedTeamId} />;
}

function DirectoryContent({ items, sharedTeamId }: { items: Awaited<ReturnType<typeof api.directory.list>>; sharedTeamId?: string }) {
  const router = useRouter();
  const reload = () => router.invalidate();

  const [sheetOpen, setSheetOpen]   = useState(false);
  const [editTarget, setEditTarget] = useState<ApiDirectoryEntry | null>(null);
  const [saving, setSaving]         = useState(false);
  const [form, setForm]             = useState({ ...EMPTY });
  const [viewEntry, setViewEntry]   = useState<ApiDirectoryEntry | null>(null);

  const [filterCat, setFilterCat]   = useState("__all__");
  const [search, setSearch]         = useState("");

  const setF = (f: keyof typeof EMPTY) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((p) => ({ ...p, [f]: e.target.value }));

  const openCreate = () => { setForm({ ...EMPTY }); setEditTarget(null); setSheetOpen(true); };
  const openEdit   = (item: ApiDirectoryEntry) => {
    setForm({ name: item.name, category: item.category, address: item.address, state: item.state, country: item.country, contact1Name: item.contact1Name, contact1Phone: item.contact1Phone, contact2Name: item.contact2Name, contact2Phone: item.contact2Phone, email1: item.email1, email2: item.email2, comment: item.comment });
    setEditTarget(item);
    setSheetOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Name is required."); return; }
    setSaving(true);
    try {
      if (editTarget) { await api.directory.update(editTarget.id, form); toast.success("Entry updated."); }
      else            { await api.directory.create(form, sharedTeamId); toast.success("Entry added."); }
      setSheetOpen(false);
      await reload();
    } catch { toast.error("Failed to save."); } finally { setSaving(false); }
  };

  const handleDelete = async (item: ApiDirectoryEntry) => {
    if (!confirm(`Delete "${item.name}"?`)) return;
    try { await api.directory.delete(item.id); toast.success("Deleted."); reload(); }
    catch { toast.error("Failed to delete."); }
  };

  const filtered = items.filter((item) => {
    if (filterCat !== "__all__" && item.category !== filterCat) return false;
    if (search && !item.name.toLowerCase().includes(search.toLowerCase()) && !item.category.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Group by category for display
  const grouped = CATEGORIES.reduce<Record<string, ApiDirectoryEntry[]>>((acc, cat) => {
    const group = filtered.filter((i) => i.category === cat);
    if (group.length) acc[cat] = group;
    return acc;
  }, {});
  const otherGroup = filtered.filter((i) => !CATEGORIES.includes(i.category as any));
  if (otherGroup.length) grouped["Other"] = [...(grouped["Other"] ?? []), ...otherGroup];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Directory"
        description={`${items.length} contact${items.length !== 1 ? "s" : ""} across ${new Set(items.map((i) => i.category)).size} categories`}
        actions={
          <Button onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" />Add Contact
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Search by name or category…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 w-56 text-xs"
        />
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="h-8 w-48 text-xs">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All categories</SelectItem>
            {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        {(filterCat !== "__all__" || search) && (
          <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setFilterCat("__all__"); setSearch(""); }}>
            Clear
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border bg-card p-16 text-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <BookUser className="h-7 w-7" />
          </div>
          <div>
            <p className="font-semibold">No contacts yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Click "Add Contact" to build your directory.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([cat, entries]) => (
            <div key={cat}>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{cat} ({entries.length})</h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {entries.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border bg-card p-4 space-y-3 cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => setViewEntry(item)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{item.name}</p>
                        <span className={`mt-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${CATEGORY_COLORS[item.category] ?? CATEGORY_COLORS["Other"]}`}>
                          {item.category}
                        </span>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(item)}>
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => handleDelete(item)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {(item.contact1Name || item.contact1Phone) && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Phone className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{[item.contact1Name, item.contact1Phone].filter(Boolean).join(" · ")}</span>
                      </div>
                    )}
                    {item.email1 && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Mail className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{item.email1}</span>
                      </div>
                    )}
                    {(item.state || item.country) && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{[item.state, item.country].filter(Boolean).join(", ")}</span>
                      </div>
                    )}
                    {item.comment && (
                      <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                        <MessageSquare className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{item.comment}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!viewEntry} onOpenChange={(open) => { if (!open) setViewEntry(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {viewEntry?.name}
              <span className={`text-[11px] font-medium rounded-full border px-2 py-0.5 ${CATEGORY_COLORS[viewEntry?.category ?? ""] ?? CATEGORY_COLORS["Other"]}`}>
                {viewEntry?.category}
              </span>
            </DialogTitle>
          </DialogHeader>
          {viewEntry && (
            <div className="space-y-4 text-sm">
              {(viewEntry.address || viewEntry.state || viewEntry.country) && (
                <div className="space-y-0.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Address</p>
                  <p className="leading-relaxed">{[viewEntry.address, viewEntry.state, viewEntry.country].filter(Boolean).join(", ")}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {(viewEntry.contact1Name || viewEntry.contact1Phone) && (
                  <div className="space-y-0.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Contact 1</p>
                    {viewEntry.contact1Name  && <p className="font-medium">{viewEntry.contact1Name}</p>}
                    {viewEntry.contact1Phone && <p className="text-muted-foreground">{viewEntry.contact1Phone}</p>}
                  </div>
                )}
                {(viewEntry.contact2Name || viewEntry.contact2Phone) && (
                  <div className="space-y-0.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Contact 2</p>
                    {viewEntry.contact2Name  && <p className="font-medium">{viewEntry.contact2Name}</p>}
                    {viewEntry.contact2Phone && <p className="text-muted-foreground">{viewEntry.contact2Phone}</p>}
                  </div>
                )}
              </div>

              {(viewEntry.email1 || viewEntry.email2) && (
                <div className="space-y-0.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Email</p>
                  {viewEntry.email1 && <p>{viewEntry.email1}</p>}
                  {viewEntry.email2 && <p>{viewEntry.email2}</p>}
                </div>
              )}

              {viewEntry.comment && (
                <div className="space-y-0.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Comment</p>
                  <p className="leading-relaxed whitespace-pre-wrap text-muted-foreground">{viewEntry.comment}</p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button size="sm" variant="outline" onClick={() => { setViewEntry(null); openEdit(viewEntry); }}>
                  <Edit2 className="mr-1.5 h-3.5 w-3.5" />Edit
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create / Edit Sheet */}
      <Sheet key={editTarget?.id ?? "new"} open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editTarget ? "Edit Contact" : "Add Contact"}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 grid grid-cols-1 gap-4">

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label>Name *</Label>
                <Input placeholder="Company or person name" value={form.name} onChange={setF("name")} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Address</p>
              <div className="space-y-1.5">
                <Label>Address</Label>
                <Input placeholder="Street / area" value={form.address} onChange={setF("address")} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>State</Label>
                  <Input placeholder="e.g. Maharashtra" value={form.state} onChange={setF("state")} />
                </div>
                <div className="space-y-1.5">
                  <Label>Country</Label>
                  <Input placeholder="e.g. India" value={form.country} onChange={setF("country")} />
                </div>
              </div>
            </div>

            <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contacts</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Contact 1 — Name</Label>
                  <Input placeholder="Name" value={form.contact1Name} onChange={setF("contact1Name")} />
                </div>
                <div className="space-y-1.5">
                  <Label>Contact 1 — Phone</Label>
                  <Input placeholder="+91 …" value={form.contact1Phone} onChange={setF("contact1Phone")} />
                </div>
                <div className="space-y-1.5">
                  <Label>Contact 2 — Name</Label>
                  <Input placeholder="Name" value={form.contact2Name} onChange={setF("contact2Name")} />
                </div>
                <div className="space-y-1.5">
                  <Label>Contact 2 — Phone</Label>
                  <Input placeholder="+91 …" value={form.contact2Phone} onChange={setF("contact2Phone")} />
                </div>
              </div>
            </div>

            <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Email</p>
              <div className="space-y-1.5">
                <Label>Email 1</Label>
                <Input type="email" placeholder="primary@example.com" value={form.email1} onChange={setF("email1")} />
              </div>
              <div className="space-y-1.5">
                <Label>Email 2</Label>
                <Input type="email" placeholder="secondary@example.com" value={form.email2} onChange={setF("email2")} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Comment</Label>
              <Textarea rows={3} placeholder="Any additional notes…" value={form.comment} onChange={setF("comment")} />
            </div>

          </div>
          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setSheetOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : (editTarget ? "Save changes" : "Add Contact")}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
