import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { api, type ApiPmDetail, type ApiPmVendor, type ApiPmDispatch, type ApiPmComment, type ApiPmLink, type ApiVendor, type VendorStatus } from "@/lib/api";
import { fmtDate } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ExternalLink, FolderOpen, Plus, Pencil, Send, Trash2, AlertTriangle } from "lucide-react";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { getUser } from "@/lib/auth";
import { PageSkeleton } from "@/components/page-skeleton";

export const Route = createFileRoute("/_app/pm/$pmId")({
  loader: async ({ params }) => {
    if (typeof window === "undefined") return null;
    const [pm, vendors] = await Promise.all([
      api.pm.get(params.pmId),
      api.vendors.list(),
    ]);
    if (!pm) throw notFound();
    return { pm, vendors };
  },
  pendingComponent: PageSkeleton,
  component: PmDetailPage,
  head: ({ loaderData }) => ({ meta: [{ title: `${loaderData?.pm?.name ?? "PM"} — Zoobalo` }] }),
});

const VENDOR_STATUSES: VendorStatus[] = ["Currently Working", "Worked Before", "Never Worked"];
const DISPATCH_STATUSES = ["Planned", "Dispatched", "In Transit", "Delivered", "Delayed"] as const;

const EMPTY_VENDOR = { vendorId: "", vendorStatus: "Currently Working" as VendorStatus, moq: undefined as number | undefined, leadTimeDays: undefined as number | undefined, costPerUnit: undefined as number | undefined, notes: "" };
const EMPTY_DISPATCH = { quantity: 0, dispatchDate: "", from: "", to: "", transporterName: "", vehicleNumber: "", lrNumber: "", freight: 0, status: "Dispatched", notes: "" };
const EMPTY_LINK = { title: "", link: "", comment: "" };

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function PmDetailPage() {
  const loaderData = Route.useLoaderData();
  if (!loaderData) return <PageSkeleton />;
  return <PmDetailContent pm={loaderData.pm} vendors={loaderData.vendors} />;
}

function PmDetailContent({ pm: initialPm, vendors }: { pm: ApiPmDetail; vendors: ApiVendor[] }) {
  const currentUser = getUser();
  const [pm, setPm] = useState<ApiPmDetail>(initialPm);

  const vendorMap: Record<string, string> = Object.fromEntries(vendors.map((v) => [v.id, v.name]));

  const reload = async () => {
    const updated = await api.pm.get(pm.id);
    if (updated) setPm(updated);
  };

  // ── Comments ──────────────────────────────────────────────────────────────────
  const [comments, setComments] = useState<ApiPmComment[]>(initialPm.comments);
  const [newComment, setNewComment] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const sendComment = async () => {
    if (!newComment.trim()) return;
    setSendingComment(true);
    try {
      const created = await api.pm.addComment(pm.id, newComment.trim());
      if (created?.id) {
        setComments((prev) => [...prev, created as ApiPmComment]);
        setNewComment("");
        textareaRef.current?.focus();
      } else toast.error(created?.error ?? "Failed to add comment.");
    } catch { toast.error("Failed to add comment."); }
    finally { setSendingComment(false); }
  };

  const deleteComment = async (cid: string) => {
    await api.pm.deleteComment(pm.id, cid);
    setComments((prev) => prev.filter((c) => c.id !== cid));
  };

  // ── Vendor sheet ──────────────────────────────────────────────────────────────
  const [vendorSheet, setVendorSheet] = useState<{ open: boolean; target?: ApiPmVendor }>({ open: false });
  const [vendorForm, setVendorForm] = useState(EMPTY_VENDOR);

  const openVendorSheet = (target?: ApiPmVendor) => {
    setVendorForm(target ? { vendorId: target.vendorId, vendorStatus: target.vendorStatus, moq: target.moq ?? undefined, leadTimeDays: target.leadTimeDays ?? undefined, costPerUnit: target.costPerUnit ?? undefined, notes: target.notes } : { ...EMPTY_VENDOR });
    setVendorSheet({ open: true, target });
  };

  const saveVendor = async () => {
    if (!vendorForm.vendorId) { toast.error("Please select a vendor."); return; }
    if (vendorSheet.target) {
      await api.pm.updateVendor(vendorSheet.target.id, vendorForm);
    } else {
      await api.pm.addVendor(pm.id, vendorForm);
    }
    setVendorSheet({ open: false });
    await reload();
  };

  const deleteVendor = async (vid: string) => {
    if (!confirm("Remove this vendor?")) return;
    await api.pm.deleteVendor(vid);
    await reload();
  };

  // ── Dispatch sheet ────────────────────────────────────────────────────────────
  const [dispatchSheet, setDispatchSheet] = useState<{ open: boolean; target?: ApiPmDispatch }>({ open: false });
  const [dispatchForm, setDispatchForm] = useState(EMPTY_DISPATCH);

  const openDispatchSheet = (target?: ApiPmDispatch) => {
    setDispatchForm(target ? { quantity: target.quantity, dispatchDate: target.dispatchDate, from: target.from, to: target.to, transporterName: target.transporterName, vehicleNumber: target.vehicleNumber, lrNumber: target.lrNumber, freight: target.freight, status: target.status, notes: target.notes } : { ...EMPTY_DISPATCH });
    setDispatchSheet({ open: true, target });
  };

  const saveDispatch = async () => {
    if (!dispatchForm.dispatchDate || !dispatchForm.quantity) { toast.error("Date and quantity are required."); return; }
    if (dispatchSheet.target) {
      await api.pm.updateDispatch(dispatchSheet.target.id, dispatchForm);
    } else {
      await api.pm.addDispatch(pm.id, dispatchForm);
    }
    setDispatchSheet({ open: false });
    await reload();
  };

  const deleteDispatch = async (did: string) => {
    if (!confirm("Delete this dispatch record?")) return;
    await api.pm.deleteDispatch(did);
    await reload();
  };

  // ── Link sheet ────────────────────────────────────────────────────────────────
  const [linkSheet, setLinkSheet] = useState<{ open: boolean; target?: ApiPmLink }>({ open: false });
  const [linkForm, setLinkForm] = useState(EMPTY_LINK);

  const openLinkSheet = (target?: ApiPmLink) => {
    setLinkForm(target ? { title: target.title, link: target.link, comment: target.comment } : { ...EMPTY_LINK });
    setLinkSheet({ open: true, target });
  };

  const saveLink = async () => {
    if (!linkForm.title.trim() || !linkForm.link.trim()) { toast.error("Title and URL are required."); return; }
    if (linkSheet.target) {
      await api.pm.updateLink(linkSheet.target.id, linkForm);
    } else {
      await api.pm.addLink(pm.id, linkForm);
    }
    setLinkSheet({ open: false });
    await reload();
  };

  const deleteLink = async (lid: string) => {
    if (!confirm("Delete this link?")) return;
    await api.pm.deleteLink(lid);
    await reload();
  };

  const lowStock = pm.minThreshold > 0 && pm.currentStock < pm.minThreshold;

  return (
    <div className="space-y-6">
      <PageHeader
        title={pm.name}
        description={`${pm.code} · ${pm.category}`}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/pm"><ArrowLeft className="mr-1.5 h-4 w-4" />Back</Link>
          </Button>
        }
      />

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className={`rounded-xl border p-4 ${lowStock ? "border-destructive/50 bg-destructive/5" : "bg-card"}`}>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            {lowStock && <AlertTriangle className="h-3 w-3 text-destructive" />}
            Current Stock
          </div>
          <div className={`mt-1 text-2xl font-semibold tabular-nums ${lowStock ? "text-destructive" : ""}`}>
            {pm.currentStock.toLocaleString()}
          </div>
          {lowStock && <p className="text-[11px] text-destructive">Below threshold ({pm.minThreshold})</p>}
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="text-xs text-muted-foreground">MOQ</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{pm.moq.toLocaleString()}</div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="text-xs text-muted-foreground">Lead Time</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{pm.leadTimeDays}d</div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="text-xs text-muted-foreground">Cost / unit</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {pm.costPerUnit != null ? `₹${pm.costPerUnit.toFixed(2)}` : "—"}
          </div>
        </div>
      </div>

      {pm.docsLink && (
        <a href={pm.docsLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
          <FolderOpen className="h-4 w-4" />Open document folder
        </a>
      )}

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="vendors">Vendors ({pm.vendors.length})</TabsTrigger>
          <TabsTrigger value="dispatch">Dispatch ({pm.dispatches.length})</TabsTrigger>
          <TabsTrigger value="comments">Comments ({comments.length})</TabsTrigger>
          <TabsTrigger value="links">Links ({pm.links.length})</TabsTrigger>
        </TabsList>

        {/* ── Details ── */}
        <TabsContent value="details" className="mt-4">
          <div className="rounded-xl border bg-card p-5">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
              <div><dt className="text-xs text-muted-foreground">Code</dt><dd className="mt-0.5 font-mono font-medium">{pm.code}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Category</dt><dd className="mt-0.5">{pm.category}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Name</dt><dd className="mt-0.5 font-medium">{pm.name}</dd></div>
              {pm.description && (
                <div className="col-span-2 sm:col-span-3">
                  <dt className="text-xs text-muted-foreground">Description</dt>
                  <dd className="mt-0.5">{pm.description}</dd>
                </div>
              )}
              {pm.specifications && (
                <div className="col-span-2 sm:col-span-3">
                  <dt className="text-xs text-muted-foreground">Product Specifications</dt>
                  <dd className="mt-0.5 whitespace-pre-wrap text-sm">{pm.specifications}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-muted-foreground">Current Stock</dt>
                <dd className={`mt-0.5 font-semibold ${lowStock ? "text-destructive" : ""}`}>
                  {pm.currentStock.toLocaleString()}
                  {lowStock && <span className="ml-1 text-[11px] font-normal">(low)</span>}
                </dd>
              </div>
              <div><dt className="text-xs text-muted-foreground">Min. Threshold</dt><dd className="mt-0.5">{pm.minThreshold.toLocaleString()}</dd></div>
              <div><dt className="text-xs text-muted-foreground">MOQ</dt><dd className="mt-0.5">{pm.moq.toLocaleString()}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Lead Time</dt><dd className="mt-0.5">{pm.leadTimeDays} days</dd></div>
              <div><dt className="text-xs text-muted-foreground">Cost / unit</dt><dd className="mt-0.5">{pm.costPerUnit != null ? `₹${pm.costPerUnit.toFixed(2)}` : "—"}</dd></div>
              {pm.docsLink && (
                <div className="col-span-2 sm:col-span-3">
                  <dt className="text-xs text-muted-foreground flex items-center gap-1"><FolderOpen className="h-3 w-3" />Documents</dt>
                  <dd className="mt-0.5">
                    <a href={pm.docsLink} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-primary hover:underline">
                      Open document folder
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </TabsContent>

        {/* ── Vendors ── */}
        <TabsContent value="vendors" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => openVendorSheet()}>
              <Plus className="mr-1.5 h-4 w-4" />Add Vendor
            </Button>
          </div>
          {pm.vendors.length === 0 ? (
            <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">No vendors linked yet.</div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {pm.vendors.map((v) => (
                <div key={v.id} className="rounded-xl border bg-card p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-sm">{vendorMap[v.vendorId] ?? v.vendorId}</p>
                      <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        v.vendorStatus === "Currently Working" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                        v.vendorStatus === "Worked Before" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" :
                        "bg-muted text-muted-foreground"
                      }`}>{v.vendorStatus}</span>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openVendorSheet(v)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => deleteVendor(v.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    {v.moq != null && <div><span className="text-muted-foreground">MOQ </span><span className="font-medium">{(v.moq as number).toLocaleString()}</span></div>}
                    {v.leadTimeDays != null && <div><span className="text-muted-foreground">Lead </span><span className="font-medium">{v.leadTimeDays}d</span></div>}
                    {v.costPerUnit != null && <div><span className="text-muted-foreground">Cost </span><span className="font-medium">₹{(v.costPerUnit as number).toFixed(2)}</span></div>}
                  </div>
                  {v.notes && <p className="mt-2 text-xs text-muted-foreground">{v.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Dispatch ── */}
        <TabsContent value="dispatch" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => openDispatchSheet()}>
              <Plus className="mr-1.5 h-4 w-4" />Add Dispatch
            </Button>
          </div>
          {pm.dispatches.length === 0 ? (
            <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">No dispatch records yet.</div>
          ) : (
            <div className="overflow-x-auto rounded-xl border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Date</th>
                    <th className="px-4 py-2.5 font-medium text-right">Qty</th>
                    <th className="px-4 py-2.5 font-medium">From → To</th>
                    <th className="px-4 py-2.5 font-medium">Transporter</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {pm.dispatches.map((d) => (
                    <tr key={d.id} className="border-t">
                      <td className="px-4 py-2.5">{fmtDate(d.dispatchDate)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-medium">{d.quantity.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{[d.from, d.to].filter(Boolean).join(" → ") || "—"}</td>
                      <td className="px-4 py-2.5">{d.transporterName || "—"}</td>
                      <td className="px-4 py-2.5">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          d.status === "Delivered" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                          d.status === "Delayed" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                          d.status === "In Transit" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                          "bg-muted text-muted-foreground"
                        }`}>{d.status}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openDispatchSheet(d)}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => deleteDispatch(d.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* ── Comments ── */}
        <TabsContent value="comments" className="mt-4">
          <div className="rounded-xl border bg-card">
            <div className="border-b px-4 py-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Comments</h3>
              {comments.length > 0 && <span className="text-xs text-muted-foreground">{comments.length} comment{comments.length !== 1 ? "s" : ""}</span>}
            </div>
            <div className="p-4 space-y-4">
              <div className="flex gap-2 items-end">
                <Textarea
                  ref={textareaRef}
                  rows={2}
                  placeholder="Add a comment…"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendComment(); } }}
                  className="resize-none text-sm"
                />
                <Button size="sm" onClick={sendComment} disabled={sendingComment || !newComment.trim()} className="shrink-0 h-9 w-9 p-0">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              {comments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No comments yet.</p>
              ) : (
                <div className="space-y-3">
                  {comments.map((c) => (
                    <div key={c.id} className="group flex items-start gap-3">
                      <div className="flex-1 rounded-lg bg-muted/40 px-3 py-2.5">
                        <div className="flex items-baseline gap-2 flex-wrap mb-1">
                          <span className="text-xs font-semibold">{c.authorName}</span>
                          <span className="text-[11px] text-muted-foreground">{fmtDateTime(c.createdAt)}</span>
                        </div>
                        <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">{c.text}</p>
                      </div>
                      {c.authorId === currentUser?.id && (
                        <button
                          type="button"
                          onClick={() => deleteComment(c.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity mt-2 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ── Links ── */}
        <TabsContent value="links" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => openLinkSheet()}>
              <Plus className="mr-1.5 h-4 w-4" />Add Link
            </Button>
          </div>
          {pm.links.length === 0 ? (
            <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">No links added yet.</div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {pm.links.map((l) => (
                <div key={l.id} className="rounded-xl border bg-card p-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <a href={l.link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{l.title}</span>
                    </a>
                    {l.comment && <p className="mt-1 text-xs text-muted-foreground">{l.comment}</p>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openLinkSheet(l)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => deleteLink(l.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Vendor Sheet ── */}
      <Sheet open={vendorSheet.open} onOpenChange={(v) => setVendorSheet((s) => ({ ...s, open: v }))}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{vendorSheet.target ? "Edit Vendor" : "Add Vendor"}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label>Vendor *</Label>
              <select
                value={vendorForm.vendorId}
                onChange={(e) => setVendorForm((f) => ({ ...f, vendorId: e.target.value }))}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Select vendor…</option>
                {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={vendorForm.vendorStatus} onValueChange={(v) => setVendorForm((f) => ({ ...f, vendorStatus: v as VendorStatus }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VENDOR_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>MOQ</Label>
                <Input type="number" min="0" placeholder="e.g. 500"
                  value={vendorForm.moq ?? ""}
                  onChange={(e) => setVendorForm((f) => ({ ...f, moq: e.target.value ? Number(e.target.value) : undefined }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Lead time (days)</Label>
                <Input type="number" min="0" placeholder="e.g. 14"
                  value={vendorForm.leadTimeDays ?? ""}
                  onChange={(e) => setVendorForm((f) => ({ ...f, leadTimeDays: e.target.value ? Number(e.target.value) : undefined }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Cost per unit (₹)</Label>
              <Input type="number" step="0.01" min="0" placeholder="0.00"
                value={vendorForm.costPerUnit ?? ""}
                onChange={(e) => setVendorForm((f) => ({ ...f, costPerUnit: e.target.value ? Number(e.target.value) : undefined }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input placeholder="Any notes about this vendor…"
                value={vendorForm.notes}
                onChange={(e) => setVendorForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setVendorSheet((s) => ({ ...s, open: false }))}>Cancel</Button>
            <Button onClick={saveVendor}>{vendorSheet.target ? "Save changes" : "Add Vendor"}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ── Dispatch Sheet ── */}
      <Sheet open={dispatchSheet.open} onOpenChange={(v) => setDispatchSheet((s) => ({ ...s, open: v }))}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{dispatchSheet.target ? "Edit Dispatch" : "Add Dispatch"}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Dispatch Date *</Label>
                <Input type="date" value={dispatchForm.dispatchDate}
                  onChange={(e) => setDispatchForm((f) => ({ ...f, dispatchDate: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Quantity *</Label>
                <Input type="number" min="1" value={dispatchForm.quantity || ""}
                  onChange={(e) => setDispatchForm((f) => ({ ...f, quantity: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>From</Label>
                <Input placeholder="Origin" value={dispatchForm.from}
                  onChange={(e) => setDispatchForm((f) => ({ ...f, from: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>To</Label>
                <Input placeholder="Destination" value={dispatchForm.to}
                  onChange={(e) => setDispatchForm((f) => ({ ...f, to: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Transporter</Label>
                <Input value={dispatchForm.transporterName}
                  onChange={(e) => setDispatchForm((f) => ({ ...f, transporterName: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Vehicle No.</Label>
                <Input placeholder="MH 01 AB 1234" value={dispatchForm.vehicleNumber}
                  onChange={(e) => setDispatchForm((f) => ({ ...f, vehicleNumber: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>LR Number</Label>
                <Input value={dispatchForm.lrNumber}
                  onChange={(e) => setDispatchForm((f) => ({ ...f, lrNumber: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Freight (₹)</Label>
                <Input type="number" min="0" step="0.01" value={dispatchForm.freight || ""}
                  onChange={(e) => setDispatchForm((f) => ({ ...f, freight: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={dispatchForm.status} onValueChange={(v) => setDispatchForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DISPATCH_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input value={dispatchForm.notes}
                onChange={(e) => setDispatchForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setDispatchSheet((s) => ({ ...s, open: false }))}>Cancel</Button>
            <Button onClick={saveDispatch}>{dispatchSheet.target ? "Save changes" : "Add Dispatch"}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ── Link Sheet ── */}
      <Sheet open={linkSheet.open} onOpenChange={(v) => setLinkSheet((s) => ({ ...s, open: v }))}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{linkSheet.target ? "Edit Link" : "Add Link"}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input placeholder="e.g. Artwork File" value={linkForm.title}
                onChange={(e) => setLinkForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>URL *</Label>
              <Input type="url" placeholder="https://…" value={linkForm.link}
                onChange={(e) => setLinkForm((f) => ({ ...f, link: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Comment</Label>
              <Input placeholder="Optional note" value={linkForm.comment}
                onChange={(e) => setLinkForm((f) => ({ ...f, comment: e.target.value }))} />
            </div>
          </div>
          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setLinkSheet((s) => ({ ...s, open: false }))}>Cancel</Button>
            <Button onClick={saveLink}>{linkSheet.target ? "Save changes" : "Add Link"}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
