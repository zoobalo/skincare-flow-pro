import { createFileRoute, useRouter } from "@tanstack/react-router";
import { PageSkeleton } from "@/components/page-skeleton";
import { PageHeader } from "@/components/page-header";
import { api, type ApiMftNote, type ApiSku } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit2, Trash2, Search, CalendarDays, Package, MessageSquare } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PersonalModuleTabs } from "@/components/personal-module-tabs";

export const Route = createFileRoute("/_app/mft/")({
  loader: async () => {
    if (typeof window === "undefined") return null;
    const [notes, skus] = await Promise.all([api.mft.list(), api.skus.list()]);
    return { notes, skus };
  },
  pendingComponent: PageSkeleton,
  component: MftPage,
  head: () => ({ meta: [{ title: "MFT — Zoobalo" }] }),
});

const GENERAL = "__general__";

function MftPage() {
  const data = Route.useLoaderData();
  if (!data) return <PageSkeleton />;
  return <MftContent notes={data.notes} skus={data.skus} />;
}

function fmtDateLabel(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "short", year: "numeric" });
}

function fmtDateShort(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

const EMPTY_FORM = { skuId: GENERAL, date: "", notes: "" };

function MftContent({ notes: initialNotes, skus }: { notes: ApiMftNote[]; skus: ApiSku[] }) {
  const router = useRouter();
  const [sharedUserId, setSharedUserId] = useState<string | undefined>(undefined);
  const [notes, setNotes] = useState(initialNotes);

  useEffect(() => { setNotes(initialNotes); }, [initialNotes]);

  useEffect(() => {
    if (sharedUserId === undefined) { setNotes(initialNotes); return; }
    api.mft.list(sharedUserId).then(setNotes).catch(() => {});
  }, [sharedUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  const reload = () => {
    if (sharedUserId) {
      api.mft.list(sharedUserId).then(setNotes).catch(() => {});
    } else {
      router.invalidate();
    }
  };

  const skuMap = Object.fromEntries(skus.map((s) => [s.id, s]));

  const [search, setSearch] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<ApiMftNote | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Filter
  const filtered = notes.filter((n) => {
    const skuName = n.skuId ? (skuMap[n.skuId]?.name ?? n.skuId) : "General";
    const haystack = `${skuName} ${n.notes} ${n.date}`.toLowerCase();
    return haystack.includes(search.toLowerCase());
  });

  // Group by date (sorted newest first, already from API)
  const groups = filtered.reduce<Record<string, ApiMftNote[]>>((acc, note) => {
    (acc[note.date] ??= []).push(note);
    return acc;
  }, {});
  const sortedDates = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  const openAdd = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, date: new Date().toISOString().slice(0, 10) });
    setSheetOpen(true);
  };

  const openEdit = (note: ApiMftNote) => {
    setEditing(note);
    setForm({
      skuId: note.skuId ?? GENERAL,
      date: note.date,
      notes: note.notes,
    });
    setSheetOpen(true);
  };

  const save = async () => {
    if (!form.date || !form.notes.trim()) return;
    setSaving(true);
    try {
      const payload = {
        skuId: form.skuId === GENERAL ? null : form.skuId,
        date: form.date,
        notes: form.notes,
      };
      if (editing) {
        await api.mft.update(editing.id, payload);
        toast.success("Note updated");
      } else {
        await api.mft.create(payload, sharedUserId);
        toast.success("Note added");
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
    if (!confirm("Delete this MFT note?")) return;
    try {
      await api.mft.delete(id);
      toast.success("Deleted");
      await reload();
    } catch {
      toast.error("Delete failed");
    }
  };

  // Stats
  const totalDates = sortedDates.length;
  const totalNotes = notes.length;
  const skuCount = new Set(notes.filter((n) => n.skuId).map((n) => n.skuId)).size;

  return (
    <div className="space-y-6 p-6">
      <PersonalModuleTabs module="mft" activeSharedUserId={sharedUserId} onChange={setSharedUserId} />
      <PageHeader
        title="MFT"
        description="Weekly manufacturing follow-up meeting notes"
        actions={
          <Button onClick={openAdd} size="sm">
            <Plus className="mr-1 h-4 w-4" /> Add Note
          </Button>
        }
      />

      {/* Summary strip */}
      {notes.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">Total Meetings</p>
            <p className="mt-0.5 text-2xl font-semibold tabular-nums">{totalDates}</p>
          </div>
          <div className="rounded-xl border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">Total Notes</p>
            <p className="mt-0.5 text-2xl font-semibold tabular-nums">{totalNotes}</p>
          </div>
          <div className="rounded-xl border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">SKUs Covered</p>
            <p className="mt-0.5 text-2xl font-semibold tabular-nums">{skuCount}</p>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by SKU, content, or date..."
          className="pl-8"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Empty state */}
      {notes.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center text-muted-foreground">
          <CalendarDays className="mb-3 h-10 w-10 opacity-30" />
          <p className="text-sm font-medium">No MFT notes yet</p>
          <p className="mt-1 text-xs">Click "Add Note" to record your first weekly meeting update.</p>
        </div>
      )}

      {/* Timeline */}
      <div className="space-y-8">
        {sortedDates.map((date) => {
          const dayNotes = groups[date];
          const skuNotes = dayNotes.filter((n) => n.skuId);
          const generalNotes = dayNotes.filter((n) => !n.skuId);

          return (
            <div key={date}>
              {/* Date header */}
              <div className="mb-3 flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  <h2 className="text-base font-semibold">{fmtDateLabel(date)}</h2>
                </div>
                <div className="flex-1 border-t" />
                <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  {dayNotes.length} {dayNotes.length === 1 ? "note" : "notes"}
                </span>
              </div>

              <div className="space-y-3 pl-2">
                {/* SKU-specific notes */}
                {skuNotes.length > 0 && (
                  <div className="space-y-2">
                    {skuNotes.map((note) => {
                      const sku = note.skuId ? skuMap[note.skuId] : null;
                      const skuLabel = sku ? `${sku.code} — ${sku.name}` : (note.skuId ?? "Unknown SKU");
                      return (
                        <NoteCard
                          key={note.id}
                          note={note}
                          label={skuLabel}
                          labelStyle="bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/30 dark:text-blue-400"
                          icon={<Package className="h-3 w-3" />}
                          onEdit={() => openEdit(note)}
                          onDelete={() => handleDelete(note.id)}
                        />
                      );
                    })}
                  </div>
                )}

                {/* General notes */}
                {generalNotes.length > 0 && (
                  <div className="space-y-2">
                    {generalNotes.map((note) => (
                      <NoteCard
                        key={note.id}
                        note={note}
                        label="General"
                        labelStyle="bg-muted text-muted-foreground border"
                        icon={<MessageSquare className="h-3 w-3" />}
                        onEdit={() => openEdit(note)}
                        onDelete={() => handleDelete(note.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editing ? "Edit Meeting Note" : "Add Meeting Note"}</SheetTitle>
          </SheetHeader>

          <div className="mt-4 space-y-4">
            <div>
              <Label>Meeting Date *</Label>
              <input
                type="date"
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={form.date}
                onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
              />
            </div>

            <div>
              <Label>SKU / Topic</Label>
              <Select value={form.skuId} onValueChange={(v) => setForm((p) => ({ ...p, skuId: v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select SKU or General" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={GENERAL}>General / Non-SKU Discussion</SelectItem>
                  {skus.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.code} — {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Notes *</Label>
              <Textarea
                className="mt-1"
                rows={8}
                placeholder="Write the meeting updates, action items, decisions…"
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              />
            </div>
          </div>

          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setSheetOpen(false)}>Cancel</Button>
            <Button
              onClick={save}
              disabled={saving || !form.date || !form.notes.trim()}
            >
              {saving ? "Saving…" : editing ? "Save Changes" : "Add Note"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function NoteCard({
  note, label, labelStyle, icon, onEdit, onDelete,
}: {
  note: ApiMftNote;
  label: string;
  labelStyle: string;
  icon: React.ReactNode;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group rounded-xl border bg-card p-4 transition-shadow hover:shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn("flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", labelStyle)}>
            {icon}
            {label}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
            <Edit2 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <p className="mt-2.5 text-sm leading-relaxed whitespace-pre-wrap">{note.notes}</p>
    </div>
  );
}
