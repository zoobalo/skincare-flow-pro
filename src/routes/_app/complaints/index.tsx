import { createFileRoute, useRouter } from "@tanstack/react-router";
import { PageSkeleton } from "@/components/page-skeleton";
import { PageHeader } from "@/components/page-header";
import { api, complaintsApi, type ApiComplaint, type ApiComplaintComment, type ApiSku } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import {
  Plus, Trash2, Send, MessageSquare, ChevronDown, ChevronUp,
  CircleAlert, CircleCheck,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/complaints/")({
  loader: async () => {
    if (typeof window === "undefined") return null;
    const [complaints, skus] = await Promise.all([complaintsApi.list(), api.skus.list()]);
    return { complaints, skus };
  },
  pendingComponent: PageSkeleton,
  component: ComplaintsPage,
  head: () => ({ meta: [{ title: "Complaints — Zoobalo" }] }),
});

function fmtStamp(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function ComplaintsPage() {
  const data = Route.useLoaderData();
  if (!data) return <PageSkeleton />;
  return <ComplaintsContent complaints={data.complaints} skus={data.skus} />;
}

function ComplaintsContent({ complaints: all, skus }: { complaints: ApiComplaint[]; skus: ApiSku[] }) {
  const router = useRouter();
  const reload = () => router.invalidate();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<{
    kind: "SKU" | "General"; skuId: string | null; title: string; against: string; details: string;
  }>({ kind: "General", skuId: null, title: "", against: "", details: "" });
  const [filter, setFilter] = useState<"Open" | "Resolved" | "__all__">("Open");
  const [kindFilter, setKindFilter] = useState<"SKU" | "General" | "__all__">("__all__");

  const open = all.filter((x) => x.status === "Open").length;
  const complaints = all.filter((x) => {
    if (filter !== "__all__" && x.status !== filter) return false;
    if (kindFilter !== "__all__" && x.kind !== kindFilter) return false;
    return true;
  });

  const raise = async () => {
    if (!form.title.trim()) { toast.error("Give the complaint a short title."); return; }
    if (form.kind === "SKU" && !form.skuId) { toast.error("Choose which SKU this is about."); return; }
    setSaving(true);
    try {
      await complaintsApi.create(form);
      toast.success("Complaint raised.");
      setForm({ kind: "General", skuId: null, title: "", against: "", details: "" });
      setSheetOpen(false);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not raise the complaint.");
    } finally { setSaving(false); }
  };

  const setStatus = async (x: ApiComplaint, status: "Open" | "Resolved") => {
    try {
      await complaintsApi.update(x.id, { status });
      toast.success(status === "Resolved" ? "Marked resolved." : "Reopened.");
      reload();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not update."); }
  };

  const remove = async (x: ApiComplaint) => {
    if (!confirm(`Delete “${x.title}” and its comments? This cannot be undone.`)) return;
    try { await complaintsApi.delete(x.id); toast.success("Deleted."); reload(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not delete."); }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Complaints"
        description={`${open} open · ${all.length} in total`}
        actions={
          <Button onClick={() => setSheetOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />Raise Complaint
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2">
        <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Open">Open</SelectItem>
            <SelectItem value="Resolved">Resolved</SelectItem>
            <SelectItem value="__all__">All complaints</SelectItem>
          </SelectContent>
        </Select>

        <Select value={kindFilter} onValueChange={(v) => setKindFilter(v as typeof kindFilter)}>
          <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Both types</SelectItem>
            <SelectItem value="SKU">SKU</SelectItem>
            <SelectItem value="General">General</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {complaints.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border bg-card p-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CircleAlert className="h-7 w-7" />
          </div>
          <div>
            <p className="font-semibold">
              {filter === "Open" ? "Nothing open" : "No complaints here"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Raise a complaint and work it through in the comments until it is resolved.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {complaints.map((x) => (
            <ComplaintCard key={x.id} complaint={x} onStatus={setStatus} onDelete={remove} />
          ))}
        </div>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader><SheetTitle>Raise a Complaint</SheetTitle></SheetHeader>
          <div className="mt-6 grid grid-cols-1 gap-5">
            <div className="space-y-1.5">
              <Label>Type of complaint *</Label>
              <Select
                value={form.kind}
                onValueChange={(v) => setForm((f) => ({
                  ...f,
                  kind: v as "SKU" | "General",
                  // Dropping back to General clears a SKU picked by mistake.
                  skuId: v === "SKU" ? f.skuId : null,
                }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SKU">SKU — about one product</SelectItem>
                  <SelectItem value="General">General — everything else</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.kind === "SKU" && (
              <div className="space-y-1.5">
                <Label>Which SKU? *</Label>
                <Select
                  value={form.skuId ?? ""}
                  onValueChange={(v) => setForm((f) => ({ ...f, skuId: v }))}
                >
                  <SelectTrigger><SelectValue placeholder="Select SKU…" /></SelectTrigger>
                  <SelectContent>
                    {skus.map((sk) => (
                      <SelectItem key={sk.id} value={sk.id}>{sk.code} — {sk.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>What is the problem? *</Label>
              <Input
                placeholder="Short title, e.g. Carton printing colour is off"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Against</Label>
              <Input
                placeholder="Vendor, manufacturer, SKU or team — optional"
                value={form.against}
                onChange={(e) => setForm((f) => ({ ...f, against: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Details</Label>
              <Textarea
                rows={6}
                placeholder="What happened, when, and what needs to be put right…"
                value={form.details}
                onChange={(e) => setForm((f) => ({ ...f, details: e.target.value }))}
              />
            </div>
          </div>
          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setSheetOpen(false)}>Cancel</Button>
            <Button onClick={raise} disabled={saving}>{saving ? "Raising…" : "Raise Complaint"}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function ComplaintCard({
  complaint, onStatus, onDelete,
}: {
  complaint: ApiComplaint;
  onStatus: (x: ApiComplaint, s: "Open" | "Resolved") => void;
  onDelete: (x: ApiComplaint) => void;
}) {
  const me = getUser();
  const resolved = complaint.status === "Resolved";
  // Seeded from the loader, then kept in step locally so a new comment shows
  // without a round trip through the whole page.
  const [comments, setComments] = useState<ApiComplaintComment[]>(complaint.comments ?? []);
  const [threadOpen, setThreadOpen] = useState(!resolved && (complaint.comments?.length ?? 0) > 0);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      const created = await complaintsApi.addComment(complaint.id, text.trim());
      setComments((p) => [...p, created]);
      setText("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add the comment.");
    } finally { setSending(false); }
  };

  const removeComment = async (commentId: string) => {
    try {
      await complaintsApi.deleteComment(complaint.id, commentId);
      setComments((p) => p.filter((c) => c.id !== commentId));
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not delete the comment."); }
  };

  return (
    <div className={`rounded-xl border bg-card p-4 ${resolved ? "opacity-70" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              {resolved ? <CircleCheck className="h-3 w-3" /> : <CircleAlert className="h-3 w-3" />}
              {complaint.status} · {complaint.kind}
            </span>
            <p className={`font-semibold leading-snug ${resolved ? "line-through" : ""}`}>{complaint.title}</p>
          </div>

          {complaint.kind === "SKU" && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              SKU:{" "}
              <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-sm font-semibold text-primary">
                {complaint.skuName ?? "—"}
              </span>
              {complaint.skuCode ? <span className="ml-1.5 opacity-70">({complaint.skuCode})</span> : null}
            </p>
          )}
          {complaint.against && (
            <p className="mt-1 text-xs text-muted-foreground">Against: {complaint.against}</p>
          )}
          {complaint.details && (
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{complaint.details}</p>
          )}

          <p className="mt-2 text-[11px] text-muted-foreground">
            Raised by {complaint.raisedByName} · {fmtStamp(complaint.createdAt)}
            {resolved && complaint.resolvedByName && complaint.resolvedAt && (
              <> · resolved by {complaint.resolvedByName} · {fmtStamp(complaint.resolvedAt)}</>
            )}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {resolved ? (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onStatus(complaint, "Open")}>
              Reopen
            </Button>
          ) : (
            <Button size="sm" className="h-7 text-xs" onClick={() => onStatus(complaint, "Resolved")}>
              <CircleCheck className="mr-1 h-3.5 w-3.5" />Mark Resolved
            </Button>
          )}
          {complaint.raisedById === me?.id && (
            <Button
              size="sm" variant="ghost"
              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
              onClick={() => onDelete(complaint)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* ── The working record: every update, with who wrote it and when ── */}
      <div className="mt-3 border-t pt-3">
        <button
          type="button"
          onClick={() => setThreadOpen((o) => !o)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          <span>{comments.length > 0 ? `Updates (${comments.length})` : "Add an update"}</span>
          {threadOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>

        {threadOpen && (
          <div className="mt-3 space-y-3">
            {comments.length === 0 && (
              <p className="text-xs text-muted-foreground">No updates yet.</p>
            )}

            {comments.map((c) => (
              <div key={c.id} className="group flex items-start gap-2">
                <div className="flex-1 rounded-lg bg-muted/40 px-3 py-2">
                  <div className="mb-0.5 flex flex-wrap items-baseline gap-2">
                    <span className="text-xs font-semibold">{c.authorName}</span>
                    <span className="text-[11px] text-muted-foreground">{fmtStamp(c.createdAt)}</span>
                  </div>
                  <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground/90">{c.text}</p>
                </div>
                {c.authorId === me?.id && (
                  <button
                    type="button"
                    onClick={() => removeComment(c.id)}
                    className="mt-1.5 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}

            <div className="flex items-end gap-2">
              <Textarea
                rows={1}
                placeholder="What happened today…"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                className="min-h-0 resize-none py-2 text-xs"
              />
              <Button size="sm" onClick={send} disabled={sending || !text.trim()} className="h-8 w-8 shrink-0 p-0">
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
