import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, type ApiArtworkSku, type ApiArtworkSection, type ApiArtworkLibraryEntry } from "@/lib/api";
import {
  Plus, Pencil, Trash2, Copy, Check, Search, Palette, Library,
  BookmarkPlus, Files, LayoutList,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/** The printable surfaces a section can belong to. */
const PACKAGING_TYPES = [
  "Outer Carton",
  "Label",
  "Insert",
  "Pouch",
  "Sticker",
  "Box",
  "Tube",
  "Print",
] as const;

export const Route = createFileRoute("/_app/artwork/")({
  loader: async () => {
    if (typeof window === "undefined") return null;
    const sharedTeamId = new URLSearchParams(window.location.search).get("sharedTeamId") ?? undefined;
    const [skus, library] = await Promise.all([
      api.artwork.list(sharedTeamId),
      api.artwork.library.list(sharedTeamId),
    ]);
    return { skus, library, sharedTeamId };
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

const EMPTY_SECTION = { name: "", details: "", packagingTypes: [] as string[] };

function ArtworkContent({
  skus: initialSkus,
  library: initialLibrary,
  sharedTeamId,
}: {
  skus: ApiArtworkSku[];
  library: ApiArtworkLibraryEntry[];
  sharedTeamId?: string;
}) {
  const router = useRouter();
  const [skus, setSkus] = useState(initialSkus);
  const [library, setLibrary] = useState(initialLibrary);
  useEffect(() => { setSkus(initialSkus); }, [initialSkus]);
  useEffect(() => { setLibrary(initialLibrary); }, [initialLibrary]);

  const reload = () => router.invalidate();
  const reloadLibrary = () => api.artwork.library.list(sharedTeamId).then(setLibrary).catch(() => {});

  const [search, setSearch] = useState("");
  const [packagingFilter, setPackagingFilter] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // ── copy to clipboard ──────────────────────────────────────────────────────
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

  /** A section applies to a packaging type if it names it, or names none at all. */
  const appliesTo = (s: ApiArtworkSection, type: string | null) =>
    !type || s.packagingTypes.length === 0 || s.packagingTypes.includes(type);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return skus
      .map((sku) => {
        const sections = sku.sections.filter((s) => appliesTo(s, packagingFilter));
        return { sku, sections };
      })
      .filter(({ sku, sections }) => {
        if (packagingFilter && sections.length === 0) return false;
        if (!q) return true;
        return (
          sku.skuName.toLowerCase().includes(q) ||
          (sku.notes ?? "").toLowerCase().includes(q) ||
          sections.some((s) => s.name.toLowerCase().includes(q) || s.details.toLowerCase().includes(q))
        );
      });
  }, [skus, search, packagingFilter]);

  // ── SKU form ───────────────────────────────────────────────────────────────
  const [skuSheet, setSkuSheet] = useState(false);
  const [skuEditing, setSkuEditing] = useState<ApiArtworkSku | null>(null);
  const [skuForm, setSkuForm] = useState({ skuName: "", notes: "" });
  const [seedFrom, setSeedFrom] = useState<string>("none");
  const [seedLibraryIds, setSeedLibraryIds] = useState<string[]>([]);
  const [savingSku, setSavingSku] = useState(false);

  function openAddSku() {
    setSkuEditing(null);
    setSkuForm({ skuName: "", notes: "" });
    setSeedFrom("none");
    setSeedLibraryIds([]);
    setSkuSheet(true);
  }

  function openEditSku(sku: ApiArtworkSku) {
    setSkuEditing(sku);
    setSkuForm({ skuName: sku.skuName, notes: sku.notes ?? "" });
    setSkuSheet(true);
  }

  async function saveSku() {
    if (!skuForm.skuName.trim()) { toast.error("SKU name is required."); return; }
    setSavingSku(true);
    try {
      if (skuEditing) {
        await api.artwork.updateSku(skuEditing.id, {
          skuName: skuForm.skuName.trim(),
          notes: skuForm.notes.trim() || null,
        }, sharedTeamId);
        toast.success("SKU updated.");
      } else {
        await api.artwork.createSku({
          skuName: skuForm.skuName.trim(),
          notes: skuForm.notes.trim() || null,
          ...(seedFrom !== "none" ? { copyFromSkuId: seedFrom } : {}),
          ...(seedLibraryIds.length ? { libraryEntryIds: seedLibraryIds } : {}),
        }, sharedTeamId);
        toast.success("SKU added.");
      }
      setSkuSheet(false);
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSavingSku(false);
    }
  }

  async function removeSku(sku: ApiArtworkSku) {
    if (!confirm(`Delete "${sku.skuName}" and all ${sku.sections.length} of its sections?`)) return;
    try {
      await api.artwork.deleteSku(sku.id, sharedTeamId);
      toast.success("SKU deleted.");
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete.");
    }
  }

  // ── Section form ───────────────────────────────────────────────────────────
  const [secSheet, setSecSheet] = useState(false);
  const [secSkuId, setSecSkuId] = useState<string | null>(null);
  const [secEditing, setSecEditing] = useState<ApiArtworkSection | null>(null);
  const [secForm, setSecForm] = useState({ ...EMPTY_SECTION });
  const [savingSec, setSavingSec] = useState(false);

  function openAddSection(skuId: string) {
    setSecSkuId(skuId);
    setSecEditing(null);
    setSecForm({ ...EMPTY_SECTION });
    setSecSheet(true);
  }

  function openEditSection(section: ApiArtworkSection) {
    setSecSkuId(section.skuId);
    setSecEditing(section);
    setSecForm({ name: section.name, details: section.details, packagingTypes: [...section.packagingTypes] });
    setSecSheet(true);
  }

  async function saveSection() {
    if (!secForm.name.trim()) { toast.error("Section name is required."); return; }
    setSavingSec(true);
    try {
      const payload = {
        name: secForm.name.trim(),
        details: secForm.details,
        packagingTypes: secForm.packagingTypes,
      };
      if (secEditing) {
        await api.artwork.updateSection(secEditing.id, payload, sharedTeamId);
        toast.success("Section updated.");
      } else if (secSkuId) {
        await api.artwork.addSection(secSkuId, payload, sharedTeamId);
        toast.success("Section added.");
      }
      setSecSheet(false);
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSavingSec(false);
    }
  }

  async function removeSection(section: ApiArtworkSection) {
    if (!confirm(`Delete section "${section.name}"?`)) return;
    try {
      await api.artwork.deleteSection(section.id, sharedTeamId);
      toast.success("Section deleted.");
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete.");
    }
  }

  async function promoteToLibrary(section: ApiArtworkSection) {
    try {
      await api.artwork.sectionToLibrary(section.id, sharedTeamId);
      toast.success(`"${section.name}" saved to library.`);
      reloadLibrary();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save to library.");
    }
  }

  // ── Insert-from-library / copy-from-SKU pickers ────────────────────────────
  const [pickLibFor, setPickLibFor] = useState<ApiArtworkSku | null>(null);
  const [pickLibIds, setPickLibIds] = useState<string[]>([]);
  const [copyFor, setCopyFor] = useState<ApiArtworkSku | null>(null);
  const [copySource, setCopySource] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function doInsertFromLibrary() {
    if (!pickLibFor || !pickLibIds.length) return;
    setBusy(true);
    try {
      await api.artwork.insertFromLibrary(pickLibFor.id, pickLibIds, sharedTeamId);
      toast.success(`${pickLibIds.length} section${pickLibIds.length > 1 ? "s" : ""} added.`);
      setPickLibFor(null);
      setPickLibIds([]);
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to insert.");
    } finally {
      setBusy(false);
    }
  }

  async function doCopyFromSku() {
    if (!copyFor || !copySource) return;
    setBusy(true);
    try {
      await api.artwork.copyFrom(copyFor.id, copySource, sharedTeamId);
      toast.success("Sections copied.");
      setCopyFor(null);
      setCopySource("");
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to copy.");
    } finally {
      setBusy(false);
    }
  }

  // ── Library manager ────────────────────────────────────────────────────────
  const [libSheet, setLibSheet] = useState(false);
  const [libEditing, setLibEditing] = useState<ApiArtworkLibraryEntry | null>(null);
  const [libForm, setLibForm] = useState({ ...EMPTY_SECTION });
  const [savingLib, setSavingLib] = useState(false);

  function openLibraryNew() {
    setLibEditing(null);
    setLibForm({ ...EMPTY_SECTION });
  }

  async function saveLibraryEntry() {
    if (!libForm.name.trim()) { toast.error("Section name is required."); return; }
    setSavingLib(true);
    try {
      const payload = { name: libForm.name.trim(), details: libForm.details, packagingTypes: libForm.packagingTypes };
      if (libEditing) {
        await api.artwork.library.update(libEditing.id, payload, sharedTeamId);
        toast.success("Library entry updated.");
      } else {
        await api.artwork.library.create(payload, sharedTeamId);
        toast.success("Added to library.");
      }
      openLibraryNew();
      reloadLibrary();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSavingLib(false);
    }
  }

  async function removeLibraryEntry(entry: ApiArtworkLibraryEntry) {
    if (!confirm(`Remove "${entry.name}" from the library? SKUs already using it keep their copy.`)) return;
    try {
      await api.artwork.library.delete(entry.id, sharedTeamId);
      toast.success("Removed from library.");
      if (libEditing?.id === entry.id) openLibraryNew();
      reloadLibrary();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove.");
    }
  }

  /** Whole SKU as plain text, for pasting into a design brief. */
  function skuAsText(sku: ApiArtworkSku, sections: ApiArtworkSection[]) {
    const head = packagingFilter ? `${sku.skuName} — ${packagingFilter}` : sku.skuName;
    return [head, "", ...sections.map((s) => `${s.name}\n${s.details}`)].join("\n").trim();
  }

  const totalSections = skus.reduce((n, s) => n + s.sections.length, 0);

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Artwork"
        description="Central store of printable packaging copy. Designers copy from here for every repeat artwork."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => { openLibraryNew(); setLibSheet(true); }}>
              <Library className="mr-1.5 h-4 w-4" /> Library
              {library.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-xs">{library.length}</Badge>
              )}
            </Button>
            <Button size="sm" onClick={openAddSku}>
              <Plus className="mr-1.5 h-4 w-4" /> Add SKU
            </Button>
          </>
        }
      />

      {/* Search + packaging filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative sm:max-w-xs sm:flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search SKUs, sections, details…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            size="sm"
            variant={packagingFilter === null ? "secondary" : "ghost"}
            className="h-7 text-xs"
            onClick={() => setPackagingFilter(null)}
          >
            All packaging
          </Button>
          {PACKAGING_TYPES.map((t) => (
            <Button
              key={t}
              size="sm"
              variant={packagingFilter === t ? "secondary" : "ghost"}
              className="h-7 text-xs"
              onClick={() => setPackagingFilter(packagingFilter === t ? null : t)}
            >
              {t}
            </Button>
          ))}
        </div>
      </div>

      {packagingFilter && (
        <p className="-mt-2 text-xs text-muted-foreground">
          Showing copy for <span className="font-medium text-foreground">{packagingFilter}</span> — sections marked
          for all packaging are included.
        </p>
      )}

      {/* SKU list */}
      {visible.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center">
          <Palette className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            {skus.length === 0
              ? "No SKUs yet. Click “Add SKU” to start building the printable-copy library."
              : "No SKUs match your search or filter."}
          </p>
        </div>
      ) : (
        <Accordion type="multiple" className="space-y-3">
          {visible.map(({ sku, sections }) => (
            <AccordionItem key={sku.id} value={sku.id} className="rounded-xl border bg-card px-0">
              <div className="flex items-start gap-2 px-4 pt-3">
                <AccordionTrigger className="flex-1 py-1 hover:no-underline">
                  <div className="min-w-0 text-left">
                    <p className="truncate text-sm font-semibold">{sku.skuName}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {sections.length} section{sections.length === 1 ? "" : "s"}
                      {packagingFilter && sku.sections.length !== sections.length && (
                        <> of {sku.sections.length}</>
                      )}
                    </p>
                  </div>
                </AccordionTrigger>
                <div className="flex shrink-0 items-center gap-1 pt-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1 px-2 text-xs"
                    disabled={sections.length === 0}
                    onClick={() => copy(skuAsText(sku, sections), `sku-${sku.id}`, "All sections")}
                  >
                    {copiedKey === `sku-${sku.id}`
                      ? <Check className="h-3.5 w-3.5 text-emerald-600" />
                      : <Files className="h-3.5 w-3.5" />}
                    Copy all
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEditSku(sku)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    onClick={() => removeSku(sku)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <AccordionContent className="px-4 pb-4">
                {sku.notes && (
                  <p className="mb-3 rounded-lg bg-muted/50 p-2.5 text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">
                    {sku.notes}
                  </p>
                )}

                {sections.length === 0 ? (
                  <p className="py-3 text-xs text-muted-foreground">
                    No sections yet. Add one, or pull common copy in from the library.
                  </p>
                ) : (
                  <div className="divide-y rounded-lg border">
                    {sections.map((s) => (
                      <div key={s.id} className="group flex items-start gap-3 p-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              {s.name}
                            </span>
                            {s.packagingTypes.length === 0 ? (
                              <Badge variant="outline" className="h-4 px-1.5 text-[10px] font-normal">
                                all packaging
                              </Badge>
                            ) : (
                              s.packagingTypes.map((t) => (
                                <Badge key={t} variant="secondary" className="h-4 px-1.5 text-[10px] font-normal">
                                  {t}
                                </Badge>
                              ))
                            )}
                          </div>
                          <p className={cn(
                            "mt-1 whitespace-pre-wrap text-sm leading-relaxed",
                            !s.details && "italic text-muted-foreground",
                          )}>
                            {s.details || "No details entered"}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            title="Copy details"
                            onClick={() => copy(s.details, `sec-${s.id}`, s.name)}
                          >
                            {copiedKey === `sec-${s.id}`
                              ? <Check className="h-3.5 w-3.5 text-emerald-600" />
                              : <Copy className="h-3.5 w-3.5" />}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            title="Save to library for reuse"
                            onClick={() => promoteToLibrary(s)}
                          >
                            <BookmarkPlus className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Edit" onClick={() => openEditSection(s)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            title="Delete"
                            onClick={() => removeSection(s)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openAddSection(sku.id)}>
                    <Plus className="mr-1 h-3.5 w-3.5" /> Add section
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    disabled={library.length === 0}
                    onClick={() => { setPickLibFor(sku); setPickLibIds([]); }}
                  >
                    <Library className="mr-1 h-3.5 w-3.5" /> Insert from library
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    disabled={skus.length < 2}
                    onClick={() => { setCopyFor(sku); setCopySource(""); }}
                  >
                    <LayoutList className="mr-1 h-3.5 w-3.5" /> Copy from another SKU
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      {skus.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {skus.length} SKU{skus.length === 1 ? "" : "s"} · {totalSections} section
          {totalSections === 1 ? "" : "s"} · {library.length} in library
        </p>
      )}

      {/* ── SKU sheet ────────────────────────────────────────────────────── */}
      <Sheet open={skuSheet} onOpenChange={setSkuSheet}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{skuEditing ? "Edit SKU" : "Add SKU"}</SheetTitle>
            <SheetDescription>
              {skuEditing
                ? "Rename this SKU or update its notes."
                : "Name the product, then optionally pre-fill its sections."}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="skuName">SKU name <span className="text-destructive">*</span></Label>
              <Input
                id="skuName"
                placeholder="e.g. Night Knight, Hydration Shots"
                value={skuForm.skuName}
                onChange={(e) => setSkuForm((f) => ({ ...f, skuName: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="skuNotes">Notes</Label>
              <Textarea
                id="skuNotes"
                rows={3}
                placeholder="Anything the designer should know about this product's artwork…"
                value={skuForm.notes}
                onChange={(e) => setSkuForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>

            {!skuEditing && (
              <>
                <div className="space-y-1.5 border-t pt-4">
                  <Label>Copy sections from an existing SKU</Label>
                  <Select value={seedFrom} onValueChange={setSeedFrom}>
                    <SelectTrigger><SelectValue placeholder="Start empty" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Start empty</SelectItem>
                      {skus.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.skuName} ({s.sections.length})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Useful for a variant of a product you have already set up.
                  </p>
                </div>

                {library.length > 0 && (
                  <div className="space-y-2">
                    <Label>Also insert from library</Label>
                    <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-lg border p-2.5">
                      {library.map((e) => (
                        <label key={e.id} className="flex cursor-pointer items-start gap-2 text-sm">
                          <Checkbox
                            checked={seedLibraryIds.includes(e.id)}
                            onCheckedChange={(v) =>
                              setSeedLibraryIds((ids) => (v ? [...ids, e.id] : ids.filter((x) => x !== e.id)))
                            }
                            className="mt-0.5"
                          />
                          <span className="min-w-0">
                            <span className="font-medium">{e.name}</span>
                            {e.details && (
                              <span className="block truncate text-xs text-muted-foreground">{e.details}</span>
                            )}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          <SheetFooter className="mt-6 flex gap-2">
            <Button variant="outline" onClick={() => setSkuSheet(false)}>Cancel</Button>
            <Button onClick={saveSku} disabled={savingSku}>
              {savingSku ? "Saving…" : skuEditing ? "Save changes" : "Add SKU"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ── Section sheet ────────────────────────────────────────────────── */}
      <Sheet open={secSheet} onOpenChange={setSecSheet}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{secEditing ? "Edit section" : "Add section"}</SheetTitle>
            <SheetDescription>
              A named piece of printable copy — the designer copies the details straight onto the artwork.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="secName">Section name <span className="text-destructive">*</span></Label>
              <Input
                id="secName"
                placeholder="e.g. Manufactured by, Net Weight, FSSAI License No."
                value={secForm.name}
                onChange={(e) => setSecForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="secDetails">Details</Label>
              <Textarea
                id="secDetails"
                rows={5}
                placeholder="e.g. Derma Goodness Private Limited"
                value={secForm.details}
                onChange={(e) => setSecForm((f) => ({ ...f, details: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">Exactly as it should be printed. Line breaks are kept.</p>
            </div>
            <div className="space-y-2">
              <Label>Appears on</Label>
              <div className="grid grid-cols-2 gap-1.5 rounded-lg border p-2.5">
                {PACKAGING_TYPES.map((t) => (
                  <label key={t} className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox
                      checked={secForm.packagingTypes.includes(t)}
                      onCheckedChange={(v) =>
                        setSecForm((f) => ({
                          ...f,
                          packagingTypes: v
                            ? [...f.packagingTypes, t]
                            : f.packagingTypes.filter((x) => x !== t),
                        }))
                      }
                    />
                    {t}
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Leave all unchecked if this copy belongs on every packaging type.
              </p>
            </div>
          </div>
          <SheetFooter className="mt-6 flex gap-2">
            <Button variant="outline" onClick={() => setSecSheet(false)}>Cancel</Button>
            <Button onClick={saveSection} disabled={savingSec}>
              {savingSec ? "Saving…" : secEditing ? "Save changes" : "Add section"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ── Insert from library ──────────────────────────────────────────── */}
      <Dialog open={!!pickLibFor} onOpenChange={(o) => !o && setPickLibFor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Insert from library</DialogTitle>
            <DialogDescription>
              Adds copies to <span className="font-medium">{pickLibFor?.skuName}</span>. Editing them there will not
              change the library entry.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-72 space-y-1.5 overflow-y-auto rounded-lg border p-2.5">
            {library.map((e) => (
              <label key={e.id} className="flex cursor-pointer items-start gap-2 text-sm">
                <Checkbox
                  checked={pickLibIds.includes(e.id)}
                  onCheckedChange={(v) =>
                    setPickLibIds((ids) => (v ? [...ids, e.id] : ids.filter((x) => x !== e.id)))
                  }
                  className="mt-0.5"
                />
                <span className="min-w-0">
                  <span className="font-medium">{e.name}</span>
                  {e.details && <span className="block text-xs text-muted-foreground">{e.details}</span>}
                </span>
              </label>
            ))}
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setPickLibFor(null)}>Cancel</Button>
            <Button onClick={doInsertFromLibrary} disabled={busy || pickLibIds.length === 0}>
              {busy ? "Adding…" : `Add ${pickLibIds.length || ""}`.trim()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Copy from another SKU ────────────────────────────────────────── */}
      <Dialog open={!!copyFor} onOpenChange={(o) => !o && setCopyFor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Copy sections</DialogTitle>
            <DialogDescription>
              Appends every section from the chosen SKU to{" "}
              <span className="font-medium">{copyFor?.skuName}</span>.
            </DialogDescription>
          </DialogHeader>
          <Select value={copySource} onValueChange={setCopySource}>
            <SelectTrigger><SelectValue placeholder="Choose a SKU to copy from" /></SelectTrigger>
            <SelectContent>
              {skus.filter((s) => s.id !== copyFor?.id && s.sections.length > 0).map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.skuName} ({s.sections.length})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setCopyFor(null)}>Cancel</Button>
            <Button onClick={doCopyFromSku} disabled={busy || !copySource}>
              {busy ? "Copying…" : "Copy sections"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Library manager ──────────────────────────────────────────────── */}
      <Sheet open={libSheet} onOpenChange={setLibSheet}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Reusable section library</SheetTitle>
            <SheetDescription>
              Copy that repeats across products — company name, licence numbers, care address. Define it once, insert
              it into any SKU.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4 rounded-xl border bg-muted/30 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {libEditing ? "Edit entry" : "New entry"}
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="libName">Section name <span className="text-destructive">*</span></Label>
              <Input
                id="libName"
                placeholder="e.g. Manufactured by"
                value={libForm.name}
                onChange={(e) => setLibForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="libDetails">Details</Label>
              <Textarea
                id="libDetails"
                rows={3}
                placeholder="e.g. Derma Goodness Private Limited"
                value={libForm.details}
                onChange={(e) => setLibForm((f) => ({ ...f, details: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Appears on</Label>
              <div className="grid grid-cols-2 gap-1.5">
                {PACKAGING_TYPES.map((t) => (
                  <label key={t} className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox
                      checked={libForm.packagingTypes.includes(t)}
                      onCheckedChange={(v) =>
                        setLibForm((f) => ({
                          ...f,
                          packagingTypes: v
                            ? [...f.packagingTypes, t]
                            : f.packagingTypes.filter((x) => x !== t),
                        }))
                      }
                    />
                    {t}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={saveLibraryEntry} disabled={savingLib}>
                {savingLib ? "Saving…" : libEditing ? "Save changes" : "Add to library"}
              </Button>
              {libEditing && (
                <Button size="sm" variant="ghost" onClick={openLibraryNew}>Cancel edit</Button>
              )}
            </div>
          </div>

          <div className="mt-5 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {library.length} entr{library.length === 1 ? "y" : "ies"}
            </p>
            {library.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">
                Nothing saved yet. Add an entry above, or use the bookmark icon on any section to save it here.
              </p>
            ) : (
              <div className="divide-y rounded-lg border">
                {library.map((e) => (
                  <div key={e.id} className="group flex items-start gap-2 p-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {e.name}
                        </span>
                        {e.packagingTypes.length === 0 ? (
                          <Badge variant="outline" className="h-4 px-1.5 text-[10px] font-normal">all packaging</Badge>
                        ) : (
                          e.packagingTypes.map((t) => (
                            <Badge key={t} variant="secondary" className="h-4 px-1.5 text-[10px] font-normal">{t}</Badge>
                          ))
                        )}
                      </div>
                      {e.details && (
                        <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{e.details}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        title="Copy details"
                        onClick={() => copy(e.details, `lib-${e.id}`, e.name)}
                      >
                        {copiedKey === `lib-${e.id}`
                          ? <Check className="h-3.5 w-3.5 text-emerald-600" />
                          : <Copy className="h-3.5 w-3.5" />}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        title="Edit"
                        onClick={() => { setLibEditing(e); setLibForm({ name: e.name, details: e.details, packagingTypes: [...e.packagingTypes] }); }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        title="Remove"
                        onClick={() => removeLibraryEntry(e)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
