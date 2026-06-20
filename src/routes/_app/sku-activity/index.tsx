import { createFileRoute, useRouter } from "@tanstack/react-router";
import { PageSkeleton } from "@/components/page-skeleton";
import { PageHeader } from "@/components/page-header";
import { api, type ApiSkuCommentWithSku, type ApiSkuDispatch, type ApiSkuDispatchWithSku, type ApiSku } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { MessageSquare, Truck, Plus, Trash2, Edit2, Send, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PostDispatchSection } from "@/components/post-dispatch-section";
import { fmtDate } from "@/lib/utils";

export const Route = createFileRoute("/_app/sku-activity/")({
  loader: async () => {
    if (typeof window === "undefined") return null;
    const sharedTeamId = new URLSearchParams(window.location.search).get("sharedTeamId") ?? undefined;
    const [comments, dispatches, skus] = await Promise.all([
      api.skus.listAllComments(sharedTeamId),
      api.skus.listAllDispatches(sharedTeamId),
      api.skus.list(undefined, undefined, sharedTeamId),
    ]);
    return { comments, dispatches, skus, sharedTeamId };
  },
  pendingComponent: PageSkeleton,
  component: SkuActivityPage,
  head: () => ({ meta: [{ title: "SKU Activity — Zoobalo" }] }),
});

const DISPATCH_STATUSES = ["Planned", "Dispatched", "In Transit", "Delivered", "Delayed"] as const;
const GOODS_TYPES = ["Final Goods", "Packaging Material"] as const;

const STATUS_STYLE: Record<string, string> = {
  Planned:     "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400",
  Dispatched:  "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  "In Transit":"bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  Delivered:   "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400",
  Delayed:     "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
};

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

function SkuActivityPage() {
  const data = Route.useLoaderData();
  if (!data) return <PageSkeleton />;
  return <SkuActivityContent comments={data.comments} dispatches={data.dispatches} skus={data.skus} />;
}

const EMPTY_DISPATCH = {
  goodsType: "Final Goods" as "Final Goods" | "Packaging Material",
  goodsName: "", quantity: 0, dispatchDate: "",
  from: "", to: "", transporterName: "", vehicleNumber: "",
  lrNumber: "", freight: 0, status: "Dispatched" as ApiSkuDispatch["status"], notes: "",
};

function SkuActivityContent({
  comments: initialComments,
  dispatches: initialDispatches,
  skus,
}: {
  comments: ApiSkuCommentWithSku[];
  dispatches: ApiSkuDispatchWithSku[];
  skus: ApiSku[];
}) {
  const router = useRouter();
  const reload = () => router.invalidate();

  // ── Comments state ──────────────────────────────────────────────────────────
  const [comments, setComments] = useState(initialComments);
  const [newComments, setNewComments] = useState<Record<string, string>>({});
  const [sendingComment, setSendingComment] = useState<string | null>(null);
  const [expandedSkus, setExpandedSkus] = useState<Record<string, boolean>>({});
  const [editingComment, setEditingComment] = useState<{ id: string; text: string } | null>(null);

  // ── Dispatch state ──────────────────────────────────────────────────────────
  const dispatchesBySkuId = initialDispatches.reduce<Record<string, ApiSkuDispatchWithSku[]>>((acc, d) => {
    (acc[d.skuId] ??= []).push(d);
    return acc;
  }, {});

  const [dispatchSheet, setDispatchSheet] = useState(false);
  const [dispatchSkuId, setDispatchSkuId] = useState<string | null>(null);
  const [editingDispatch, setEditingDispatch] = useState<ApiSkuDispatch | null>(null);
  const [dispatchForm, setDispatchForm] = useState({ ...EMPTY_DISPATCH });
  const [savingDispatch, setSavingDispatch] = useState(false);
  const [expandedDispatchSkus, setExpandedDispatchSkus] = useState<Record<string, boolean>>({});
  const [expandedHistorySkus, setExpandedHistorySkus] = useState<Record<string, boolean>>({});

  // ── Comment helpers ─────────────────────────────────────────────────────────
  const commentsBySkuId = comments.reduce<Record<string, ApiSkuCommentWithSku[]>>((acc, c) => {
    (acc[c.skuId] ??= []).push(c);
    return acc;
  }, {});

  const skusWithComments = skus.filter((s) => commentsBySkuId[s.id]?.length);
  const skusWithoutComments = skus.filter((s) => !commentsBySkuId[s.id]?.length);
  const allSkusForComment = [...skusWithComments, ...skusWithoutComments];

  const skusWithDispatches = skus.filter((s) => dispatchesBySkuId[s.id]?.length);
  const skusWithoutDispatches = skus.filter((s) => !dispatchesBySkuId[s.id]?.length);
  const allSkusForDispatch = [...skusWithDispatches, ...skusWithoutDispatches];

  const sendComment = async (skuId: string) => {
    const text = (newComments[skuId] ?? "").trim();
    if (!text) return;
    setSendingComment(skuId);
    try {
      const created = await api.skus.addComment(skuId, text);
      if (created.error) { toast.error(created.error); return; }
      const sku = skus.find((s) => s.id === skuId);
      setComments((prev) => [...prev, { ...created, skuCode: sku?.code ?? "", skuName: sku?.name ?? "" }]);
      setNewComments((p) => ({ ...p, [skuId]: "" }));
      setExpandedSkus((p) => ({ ...p, [skuId]: true }));
    } catch {
      toast.error("Failed to add comment");
    } finally {
      setSendingComment(null);
    }
  };

  const deleteComment = async (commentId: string) => {
    try {
      await api.skus.deleteComment(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch {
      toast.error("Failed to delete comment");
    }
  };

  const saveCommentEdit = async () => {
    if (!editingComment) return;
    try {
      await api.skus.updateComment(editingComment.id, editingComment.text);
      setComments((prev) => prev.map((c) => c.id === editingComment.id ? { ...c, comment: editingComment.text } : c));
      setEditingComment(null);
    } catch {
      toast.error("Failed to update comment");
    }
  };

  // ── Dispatch helpers ────────────────────────────────────────────────────────

  const openAddDispatch = (skuId: string) => {
    setDispatchSkuId(skuId);
    setEditingDispatch(null);
    setDispatchForm({ ...EMPTY_DISPATCH });
    setDispatchSheet(true);
  };

  const openEditDispatch = (skuId: string, d: ApiSkuDispatch) => {
    setDispatchSkuId(skuId);
    setEditingDispatch(d);
    setDispatchForm({
      goodsType: d.goodsType,
      goodsName: d.goodsName,
      quantity: d.quantity,
      dispatchDate: d.dispatchDate?.slice(0, 10) ?? "",
      from: d.from,
      to: d.to,
      transporterName: d.transporterName,
      vehicleNumber: d.vehicleNumber,
      lrNumber: d.lrNumber,
      freight: d.freight,
      status: d.status,
      notes: d.notes,
    });
    setDispatchSheet(true);
  };

  const saveDispatch = async () => {
    if (!dispatchSkuId) return;
    if (!dispatchForm.goodsName.trim() || !dispatchForm.dispatchDate) {
      toast.error("Goods name and dispatch date are required");
      return;
    }
    setSavingDispatch(true);
    try {
      if (editingDispatch) {
        await api.skus.updateDispatch(editingDispatch.id, dispatchForm);
        toast.success("Dispatch updated");
      } else {
        await api.skus.addDispatch(dispatchSkuId, dispatchForm);
        toast.success("Dispatch added");
      }
      setDispatchSheet(false);
      await reload();
    } catch {
      toast.error("Failed to save dispatch");
    } finally {
      setSavingDispatch(false);
    }
  };

  const deleteDispatch = async (id: string) => {
    if (!confirm("Delete this dispatch entry?")) return;
    try {
      await api.skus.deleteDispatch(id);
      toast.success("Deleted");
      await reload();
    } catch {
      toast.error("Failed to delete");
    }
  };

  const setDF = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setDispatchForm((p) => ({ ...p, [field]: e.target.value }));

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="SKU Activity"
        description="Comments and dispatch records for all SKUs"
      />

      <Tabs defaultValue="comments">
        <TabsList>
          <TabsTrigger value="comments" className="gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" /> Comments
          </TabsTrigger>
          <TabsTrigger value="dispatch" className="gap-1.5">
            <Truck className="h-3.5 w-3.5" /> Dispatch
          </TabsTrigger>
        </TabsList>

        {/* ── COMMENTS TAB ──────────────────────────────────────────────────── */}
        <TabsContent value="comments" className="mt-4 space-y-3">
          {skus.length === 0 ? (
            <div className="rounded-xl border border-dashed py-14 text-center text-sm text-muted-foreground">
              No SKUs found. Add SKUs first to track comments.
            </div>
          ) : (
            allSkusForComment.map((sku) => {
              const skuComments = commentsBySkuId[sku.id] ?? [];
              const expanded = expandedSkus[sku.id] ?? skuComments.length > 0;
              return (
                <div key={sku.id} className="rounded-xl border bg-card overflow-hidden">
                  {/* SKU header */}
                  <button
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
                    onClick={() => setExpandedSkus((p) => ({ ...p, [sku.id]: !expanded }))}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {expanded ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                      <span className="font-medium text-sm">{sku.code}</span>
                      <span className="text-sm text-muted-foreground truncate">{sku.name}</span>
                    </div>
                    <span className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                      skuComments.length > 0 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                    )}>
                      {skuComments.length} {skuComments.length === 1 ? "comment" : "comments"}
                    </span>
                  </button>

                  {expanded && (
                    <div className="border-t px-4 pb-4 pt-3 space-y-3">
                      {/* Existing comments */}
                      {skuComments.length > 0 && (
                        <div className="space-y-2">
                          {skuComments.map((c) => (
                            <div key={c.id} className="group rounded-lg bg-muted/40 px-3 py-2.5">
                              {editingComment?.id === c.id ? (
                                <div className="space-y-2">
                                  <Textarea
                                    className="text-sm min-h-[64px] resize-none"
                                    value={editingComment.text}
                                    onChange={(e) => setEditingComment({ ...editingComment, text: e.target.value })}
                                    autoFocus
                                  />
                                  <div className="flex gap-2">
                                    <Button size="sm" onClick={saveCommentEdit} disabled={!editingComment.text.trim()}>Save</Button>
                                    <Button size="sm" variant="ghost" onClick={() => setEditingComment(null)}>Cancel</Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm leading-relaxed">{c.comment}</p>
                                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                                      {c.authorName && <span className="font-medium text-foreground/60">{c.authorName} · </span>}
                                      {fmtDateTime(c.createdAt)}
                                    </p>
                                  </div>
                                  <div className="flex shrink-0 gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button
                                      variant="ghost" size="icon" className="h-6 w-6"
                                      onClick={() => setEditingComment({ id: c.id, text: c.comment })}
                                    >
                                      <Edit2 className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive"
                                      onClick={() => deleteComment(c.id)}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add new comment */}
                      <div className="flex gap-2">
                        <Input
                          placeholder="Add a comment…"
                          className="text-sm h-9"
                          value={newComments[sku.id] ?? ""}
                          onChange={(e) => setNewComments((p) => ({ ...p, [sku.id]: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === "Enter") sendComment(sku.id); }}
                        />
                        <Button
                          size="sm" className="h-9 shrink-0"
                          disabled={!newComments[sku.id]?.trim() || sendingComment === sku.id}
                          onClick={() => sendComment(sku.id)}
                        >
                          <Send className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </TabsContent>

        {/* ── DISPATCH TAB ──────────────────────────────────────────────────── */}
        <TabsContent value="dispatch" className="mt-4 space-y-3">
          {skus.length === 0 ? (
            <div className="rounded-xl border border-dashed py-14 text-center text-sm text-muted-foreground">
              No SKUs found. Add SKUs first to track dispatches.
            </div>
          ) : (
            allSkusForDispatch.map((sku) => {
              const allDispatches: ApiSkuDispatchWithSku[] = dispatchesBySkuId[sku.id] ?? [];
              const isHistoryEntry = (d: ApiSkuDispatchWithSku) => d.status === "Delivered" && d.qcStatus === "Done";
              const active  = allDispatches.filter((d) => !isHistoryEntry(d));
              const history = allDispatches.filter(isHistoryEntry);
              const expanded = expandedDispatchSkus[sku.id] ?? active.length > 0;
              const historyExpanded = expandedHistorySkus[sku.id] ?? false;

              const renderRow = (d: ApiSkuDispatchWithSku, muted = false) => (
                <div key={d.id} className={`group px-4 py-3 text-sm transition-colors ${muted ? "bg-muted/20 hover:bg-muted/30" : "hover:bg-muted/20"}`}>
                  <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-4 items-start">
                    <div>
                      <p className={`font-medium ${muted ? "text-muted-foreground" : ""}`}>{d.goodsName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{d.goodsType} · Qty {d.quantity}</p>
                      {d.dispatchDate && <p className="text-xs text-muted-foreground">{fmtDate(d.dispatchDate)}</p>}
                    </div>
                    <div className="text-xs space-y-0.5">
                      <p><span className="text-muted-foreground">From:</span> {d.from || "—"}</p>
                      <p><span className="text-muted-foreground">To:</span> {d.to || "—"}</p>
                      <p><span className="text-muted-foreground">Transporter:</span> {d.transporterName || "—"}</p>
                    </div>
                    <div className="space-y-1">
                      <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", STATUS_STYLE[d.status] ?? "bg-muted text-muted-foreground")}>
                        {d.status}
                      </span>
                      {d.lrNumber && <p className="text-xs text-muted-foreground">LR: {d.lrNumber}</p>}
                      {d.vehicleNumber && <p className="text-xs text-muted-foreground">Veh: {d.vehicleNumber}</p>}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDispatch(sku.id, d)}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteDispatch(d.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <PostDispatchSection dispatch={d} />
                </div>
              );

              return (
                <div key={sku.id} className="rounded-xl border bg-card overflow-hidden">
                  {/* SKU header */}
                  <div className="flex items-center justify-between gap-3 px-4 py-3">
                    <button
                      className="flex flex-1 items-center gap-3 min-w-0 text-left"
                      onClick={() => setExpandedDispatchSkus((p) => ({ ...p, [sku.id]: !expanded }))}
                    >
                      {expanded ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                      <span className="font-medium text-sm">{sku.code}</span>
                      <span className="text-sm text-muted-foreground truncate">{sku.name}</span>
                      <span className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                        active.length > 0 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                      )}>
                        {active.length} {active.length === 1 ? "active" : "active"}
                      </span>
                      {history.length > 0 && (
                        <span className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
                          {history.length} in history
                        </span>
                      )}
                    </button>
                    <Button size="sm" variant="outline" className="h-7 shrink-0" onClick={() => openAddDispatch(sku.id)}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add
                    </Button>
                  </div>

                  {expanded && (
                    <div className="border-t">
                      {/* Active rows */}
                      {active.length === 0 ? (
                        <p className="px-4 py-3 text-xs text-muted-foreground">No active dispatches.</p>
                      ) : (
                        <div className="divide-y">
                          {active.map((d) => renderRow(d))}
                        </div>
                      )}

                      {/* History toggle + rows */}
                      {history.length > 0 && (
                        <>
                          <button
                            type="button"
                            onClick={() => setExpandedHistorySkus((p) => ({ ...p, [sku.id]: !historyExpanded }))}
                            className="flex w-full items-center gap-2 border-t px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/20 hover:text-foreground transition-colors"
                          >
                            {historyExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                            Dispatch History ({history.length})
                          </button>
                          {historyExpanded && (
                            <div className="divide-y border-t">
                              {history.map((d) => renderRow(d, true))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </TabsContent>
      </Tabs>

      {/* ── Dispatch Sheet ─────────────────────────────────────────────────── */}
      <Sheet open={dispatchSheet} onOpenChange={setDispatchSheet}>
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{editingDispatch ? "Edit Dispatch" : "Add Dispatch"}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label>Goods Name *</Label>
              <Input value={dispatchForm.goodsName} onChange={setDF("goodsName")} placeholder="e.g. Final product boxes" />
            </div>
            <div className="space-y-1.5">
              <Label>Goods Type</Label>
              <Select value={dispatchForm.goodsType} onValueChange={(v) => setDispatchForm((p) => ({ ...p, goodsType: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{GOODS_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Quantity</Label>
              <Input type="number" value={dispatchForm.quantity} onChange={setDF("quantity")} min={0} />
            </div>
            <div className="space-y-1.5">
              <Label>Dispatch Date *</Label>
              <Input type="date" value={dispatchForm.dispatchDate} onChange={setDF("dispatchDate")} />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={dispatchForm.status} onValueChange={(v) => setDispatchForm((p) => ({ ...p, status: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{DISPATCH_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>From</Label>
              <Input value={dispatchForm.from} onChange={setDF("from")} placeholder="Origin location" />
            </div>
            <div className="space-y-1.5">
              <Label>To</Label>
              <Input value={dispatchForm.to} onChange={setDF("to")} placeholder="Destination" />
            </div>
            <div className="space-y-1.5">
              <Label>Transporter</Label>
              <Input value={dispatchForm.transporterName} onChange={setDF("transporterName")} placeholder="Transporter name" />
            </div>
            <div className="space-y-1.5">
              <Label>Vehicle No.</Label>
              <Input value={dispatchForm.vehicleNumber} onChange={setDF("vehicleNumber")} placeholder="e.g. MH12AB1234" />
            </div>
            <div className="space-y-1.5">
              <Label>LR Number</Label>
              <Input value={dispatchForm.lrNumber} onChange={setDF("lrNumber")} placeholder="Lorry receipt no." />
            </div>
            <div className="space-y-1.5">
              <Label>Freight (₹)</Label>
              <Input type="number" value={dispatchForm.freight} onChange={setDF("freight")} min={0} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={dispatchForm.notes} onChange={setDF("notes")} rows={3} placeholder="Any additional notes…" />
            </div>
          </div>
          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setDispatchSheet(false)}>Cancel</Button>
            <Button onClick={saveDispatch} disabled={savingDispatch}>
              {savingDispatch ? "Saving…" : editingDispatch ? "Save Changes" : "Add Dispatch"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
