import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, type ApiArtworkEntry, type ApiSku } from "@/lib/api";
import { Plus, Pencil, Trash2, Copy, Check, Search, Palette, X, Files } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const ARTWORK_TYPES = ["Label", "Outer Carton", "Tray", "Insert", "Hologram", "Sticker", "Others"] as const;
const OTHERS = "Others";

export const Route = createFileRoute("/_app/artwork/")({
  loader: async () => {
    if (typeof window === "undefined") return null;
    const sharedTeamId = new URLSearchParams(window.location.search).get("sharedTeamId") ?? undefined;
    const [items, skus] = await Promise.all([
      api.artwork.list(sharedTeamId),
      api.skus.list(undefined, undefined, sharedTeamId),
    ]);
    return { items, skus, sharedTeamId };
  },
  pendingComponent: PageSkeleton,
  component: ArtworkPage,
  head: () => ({ meta: [{ title: "Artwork — Zoobalo" }] }),
});

function ArtworkPage() {
  const data = Route.useLoaderData();
  if (!data) return <PageSkeleton />;
  return <ArtworkContent {...data} />;
}

/**
 * Click-to-copy value. Rendered as a button so it is keyboard reachable;
 * the icon only appears on hover/focus to keep the list uncluttered.
 */
function Copyable({
  value, copyKey, label, copied, onCopy, className, title,
}: {
  value: string;
  copyKey: string;
  label: string;
  copied: boolean;
  onCopy: (value: string, key: string, label: string) => void;
  className?: string;
  title?: string;
}) {
  if (!value) return <span className="italic text-muted-foreground">—</span>;
  return (
    <button
      type="button"
      title={title ?? `Copy ${label}`}
      onClick={() => onCopy(value, copyKey, label)}
      className={cn(
        "group/c inline-flex max-w-full items-start gap-1.5 rounded text-left",
        "hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <span className="min-w-0 whitespace-pre-wrap">{value}</span>
      {copied
        ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
        : <Copy className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover/c:opacity-60" />}
    </button>
  );
}

type SectionRow = { name: string; data: string };
const BLANK_ROW: SectionRow = { name: "", data: "" };

function ArtworkContent({
  items: initialItems,
  skus,
  sharedTeamId,
}: {
  items: ApiArtworkEntry[];
  skus: ApiSku[];
  sharedTeamId?: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  useEffect(() => { setItems(initialItems); }, [initialItems]);

  const [search, setSearch] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  async function copy(text: string, key: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1500);
      toast.success(`${label} copied.`);
    } catch {
      toast.error("Could not copy — your browser blocked clipboard access.");
    }
  }

  // ── Group artworks under their SKU ─────────────────────────────────────────
  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const match = (a: ApiArtworkEntry) =>
      !q ||
      (a.sku?.name ?? "").toLowerCase().includes(q) ||
      (a.sku?.code ?? "").toLowerCase().includes(q) ||
      a.artworkType.toLowerCase().includes(q) ||
      a.sections.some((s) => s.name.toLowerCase().includes(q) || s.data.toLowerCase().includes(q));

    const map = new Map<string, { name: string; code: string; artworks: ApiArtworkEntry[] }>();
    for (const a of items.filter(match)) {
      const key = a.sku?.id ?? a.skuId;
      if (!map.has(key)) {
        map.set(key, { name: a.sku?.name ?? "Unknown SKU", code: a.sku?.code ?? "", artworks: [] });
      }
      map.get(key)!.artworks.push(a);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [items, search]);

  // ── Add / edit form ────────────────────────────────────────────────────────
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ApiArtworkEntry | null>(null);
  const [skuId, setSkuId] = useState("");
  const [typeChoice, setTypeChoice] = useState("");
  const [customType, setCustomType] = useState("");
  const [rows, setRows] = useState<SectionRow[]>([{ ...BLANK_ROW }]);
  const [saving, setSaving] = useState(false);

  function openAdd() {
    setEditing(null);
    setSkuId("");
    setTypeChoice("");
    setCustomType("");
    setRows([{ ...BLANK_ROW }]);
    setOpen(true);
  }

  function openEdit(a: ApiArtworkEntry) {
    setEditing(a);
    setSkuId(a.skuId);
    const known = (ARTWORK_TYPES as readonly string[]).includes(a.artworkType) && a.artworkType !== OTHERS;
    setTypeChoice(known ? a.artworkType : OTHERS);
    setCustomType(known ? "" : a.artworkType);
    setRows(a.sections.length ? a.sections.map((s) => ({ name: s.name, data: s.data })) : [{ ...BLANK_ROW }]);
    setOpen(true);
  }

  const resolvedType = typeChoice === OTHERS ? customType.trim() : typeChoice;

  async function handleSave() {
    if (!skuId) { toast.error("Select a SKU."); return; }
    if (!typeChoice) { toast.error("Choose an artwork type."); return; }
    if (typeChoice === OTHERS && !customType.trim()) { toast.error("Enter the artwork type name."); return; }

    const sections = rows
      .map((r) => ({ name: r.name.trim(), data: r.data }))
      .filter((r) => r.name.length > 0);
    if (!sections.length) { toast.error("Add at least one section with a name."); return; }

    setSaving(true);
    try {
      if (editing) {
        await api.artwork.update(editing.id, { skuId, artworkType: resolvedType, sections }, sharedTeamId);
        toast.success("Artwork updated.");
      } else {
        await api.artwork.create({ skuId, artworkType: resolvedType, sections }, sharedTeamId);
        toast.success("Artwork saved.");
      }
      setOpen(false);
      router.invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(a: ApiArtworkEntry) {
    if (!confirm(`Delete the ${a.artworkType} artwork for ${a.sku?.name ?? "this SKU"}?`)) return;
    try {
      await api.artwork.delete(a.id, sharedTeamId);
      toast.success("Artwork deleted.");
      router.invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete.");
    }
  }

  const setRow = (i: number, patch: Partial<SectionRow>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const artworkAsText = (a: ApiArtworkEntry) =>
    [`${a.sku?.name ?? ""} — ${a.artworkType}`, "", ...a.sections.map((s) => `${s.name}\n${s.data}`)]
      .join("\n").trim();

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Artwork"
        description="Printable details for every SKU, kept in one place for the design team to copy from."
        actions={
          <Button size="sm" onClick={openAdd}>
            <Plus className="mr-1.5 h-4 w-4" /> Add SKU
          </Button>
        }
      />

      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search SKU, type or details…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {grouped.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center">
          <Palette className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            {items.length === 0
              ? "No artwork yet. Click “Add SKU” to add the first one."
              : "Nothing matches your search."}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map((group) => (
            <div key={group.name + group.code} className="space-y-3">
              <div className="flex items-baseline gap-2 border-b pb-2">
                <h2 className="text-base font-semibold">
                  <Copyable
                    value={group.name}
                    copyKey={`sku-${group.name}`}
                    label="SKU name"
                    copied={copiedKey === `sku-${group.name}`}
                    onCopy={copy}
                  />
                </h2>
                {group.code && (
                  <span className="text-xs text-muted-foreground">
                    <Copyable
                      value={group.code}
                      copyKey={`code-${group.code}`}
                      label="SKU code"
                      copied={copiedKey === `code-${group.code}`}
                      onCopy={copy}
                    />
                  </span>
                )}
                <span className="ml-auto text-xs text-muted-foreground">
                  {group.artworks.length} artwork{group.artworks.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                {group.artworks.map((a) => (
                  <div key={a.id} className="rounded-xl border bg-card">
                    <div className="flex items-center gap-2 border-b px-4 py-2.5">
                      <Badge variant="secondary" className="font-medium">
                        <Copyable
                          value={a.artworkType}
                          copyKey={`t-${a.id}`}
                          label="Artwork type"
                          copied={copiedKey === `t-${a.id}`}
                          onCopy={copy}
                        />
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {a.sections.length} section{a.sections.length === 1 ? "" : "s"}
                      </span>
                      <div className="ml-auto flex items-center gap-0.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 gap-1 px-2 text-xs"
                          onClick={() => copy(artworkAsText(a), `aw-${a.id}`, "Artwork")}
                        >
                          {copiedKey === `aw-${a.id}`
                            ? <Check className="h-3.5 w-3.5 text-emerald-600" />
                            : <Files className="h-3.5 w-3.5" />}
                          Copy all
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(a)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(a)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div className="divide-y">
                      {a.sections.map((s) => (
                        <div key={s.id} className="px-4 py-2.5">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            <Copyable
                              value={s.name}
                              copyKey={`sn-${s.id}`}
                              label="Section name"
                              copied={copiedKey === `sn-${s.id}`}
                              onCopy={copy}
                            />
                          </p>
                          <p className="mt-0.5 text-sm leading-relaxed">
                            <Copyable
                              value={s.data}
                              copyKey={`sd-${s.id}`}
                              label={s.name}
                              copied={copiedKey === `sd-${s.id}`}
                              onCopy={copy}
                            />
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Add / edit ───────────────────────────────────────────────────── */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{editing ? "Edit artwork" : "Add artwork"}</SheetTitle>
            <SheetDescription>
              Pick the SKU and packaging type, then enter the details to be printed.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-5">
            <div className="space-y-1.5">
              <Label>SKU <span className="text-destructive">*</span></Label>
              <Select value={skuId} onValueChange={setSkuId}>
                <SelectTrigger><SelectValue placeholder="Select a SKU" /></SelectTrigger>
                <SelectContent>
                  {skus.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}{s.code ? ` · ${s.code}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {skus.length === 0 && (
                <p className="text-xs text-destructive">
                  No SKUs found. Add products in SKU Management first.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Artwork type <span className="text-destructive">*</span></Label>
              <Select value={typeChoice} onValueChange={setTypeChoice}>
                <SelectTrigger><SelectValue placeholder="Choose artwork type" /></SelectTrigger>
                <SelectContent>
                  {ARTWORK_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
              {typeChoice === OTHERS && (
                <Input
                  className="mt-2"
                  placeholder="Enter artwork type name"
                  value={customType}
                  onChange={(e) => setCustomType(e.target.value)}
                />
              )}
            </div>

            <div className="space-y-2 border-t pt-4">
              <div className="flex items-center justify-between">
                <Label>Details</Label>
                <span className="text-xs text-muted-foreground">{rows.length} section{rows.length === 1 ? "" : "s"}</span>
              </div>

              {rows.map((row, i) => (
                <div key={i} className="space-y-2 rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Section name — e.g. Manufactured by"
                      value={row.name}
                      onChange={(e) => setRow(i, { name: e.target.value })}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                      title="Remove section"
                      disabled={rows.length === 1}
                      onClick={() => setRows((rs) => rs.filter((_, idx) => idx !== i))}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <Textarea
                    rows={2}
                    placeholder="Section data — e.g. Derma Goodness Private Limited"
                    value={row.data}
                    onChange={(e) => setRow(i, { data: e.target.value })}
                  />
                </div>
              ))}

              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => setRows((rs) => [...rs, { ...BLANK_ROW }])}
              >
                <Plus className="mr-1.5 h-4 w-4" /> Add another section
              </Button>
            </div>
          </div>

          <SheetFooter className="mt-6 flex gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
