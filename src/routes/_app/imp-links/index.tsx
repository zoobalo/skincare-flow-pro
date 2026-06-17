import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { api, ApiImpLink } from "@/lib/api";
import { Plus, Pencil, Trash2, Link2, ExternalLink, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/imp-links/")({
  loader: async () => {
    if (typeof window === "undefined") return null;
    const sharedTeamId = new URLSearchParams(window.location.search).get("sharedTeamId") ?? undefined;
    return { items: await api.impLinks.list(sharedTeamId), sharedTeamId };
  },
  component: ImpLinksPage,
  head: () => ({ meta: [{ title: "IMP Links — Zoobalo" }] }),
});

function ImpLinksPage() {
  const data = Route.useLoaderData();
  if (!data) return <PageSkeleton />;
  return <ImpLinksContent items={data.items} sharedTeamId={data.sharedTeamId} />;
}

const EMPTY_FORM = { name: "", link: "", comment: "" };

function ImpLinksContent({ items, sharedTeamId }: { items: ApiImpLink[]; sharedTeamId?: string }) {
  const router = useRouter();
  const reload = () => router.invalidate();

  const [search, setSearch] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ApiImpLink | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  const filtered = items.filter((item) => {
    const q = search.toLowerCase();
    return !q
      || item.name.toLowerCase().includes(q)
      || item.link.toLowerCase().includes(q)
      || (item.comment ?? "").toLowerCase().includes(q);
  });

  function openCreate() {
    setEditTarget(null);
    setForm({ ...EMPTY_FORM });
    setSheetOpen(true);
  }

  function openEdit(item: ApiImpLink) {
    setEditTarget(item);
    setForm({ name: item.name, link: item.link, comment: item.comment ?? "" });
    setSheetOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.link.trim()) {
      toast.error("Name and link are required.");
      return;
    }
    let url = form.link.trim();
    if (url && !/^https?:\/\//i.test(url)) url = "https://" + url;

    setSaving(true);
    try {
      const payload = { name: form.name.trim(), link: url, comment: form.comment.trim() || null };
      if (editTarget) {
        await api.impLinks.update(editTarget.id, payload);
        toast.success("Link updated.");
      } else {
        await api.impLinks.create(payload, sharedTeamId);
        toast.success("Link saved.");
      }
      setSheetOpen(false);
      reload();
    } catch {
      toast.error("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: ApiImpLink) {
    if (!confirm(`Delete "${item.name}"?`)) return;
    try {
      await api.impLinks.delete(item.id);
      toast.success("Link deleted.");
      reload();
    } catch {
      toast.error("Failed to delete.");
    }
  }

  const set = (k: keyof typeof EMPTY_FORM) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="IMP Links"
        description="Save and access important links in one place."
        actions={
          <Button onClick={openCreate} size="sm">
            <Plus className="mr-1.5 h-4 w-4" /> Add Link
          </Button>
        }
      />

      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search links…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center">
          <Link2 className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            {search ? "No links match your search." : "No links saved yet. Add one to get started."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <div key={item.id} className="group relative flex flex-col gap-2 rounded-xl border bg-card p-4 transition-shadow hover:shadow-md">
              {/* Actions */}
              <div className="absolute right-3 top-3 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(item)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => handleDelete(item)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Name */}
              <p className="pr-16 text-sm font-semibold leading-snug">{item.name}</p>

              {/* Link */}
              <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-primary hover:underline break-all"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="h-3 w-3 shrink-0" />
                <span className="line-clamp-1">{item.link}</span>
              </a>

              {/* Comment */}
              {item.comment && (
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3 whitespace-pre-wrap">
                  {item.comment}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editTarget ? "Edit Link" : "Add Link"}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name <span className="text-destructive">*</span></Label>
              <Input id="name" placeholder="e.g. Supplier Portal, Packaging Spec Sheet" value={form.name} onChange={set("name")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="link">Link <span className="text-destructive">*</span></Label>
              <Input id="link" placeholder="https://example.com" value={form.link} onChange={set("link")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="comment">Comment</Label>
              <Textarea id="comment" placeholder="Any notes about this link…" rows={3} value={form.comment} onChange={set("comment")} />
            </div>
          </div>
          <SheetFooter className="mt-6 flex gap-2">
            <Button variant="outline" onClick={() => setSheetOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : editTarget ? "Save changes" : "Add Link"}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
