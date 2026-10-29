import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { api, type ApiNpdQuoteRequest } from "@/lib/api";
import {
  Link2, Copy, Check, ChevronDown, Trash2, Lock, Unlock, Send, Loader2, ImagePlus, X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const KIND_LABEL = { RM: "Raw Material", PM: "Packaging Material" } as const;
const MAX_REF_IMAGES = 8;
const API_BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:3001"}`;

const fmtCost = (c: string | null) =>
  c === null || c === "" ? "—" : Number(c).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

/**
 * RM and PM quotation panels for one NPD: write the brief, share one public
 * link per material, and read back what vendors submitted.
 */
export function NpdQuotations({
  npdId, requests, sharedTeamId, onChanged,
}: {
  npdId: string;
  requests: ApiNpdQuoteRequest[];
  sharedTeamId?: string;
  onChanged: () => void;
}) {
  const total = requests.reduce((n, r) => n + r.quotes.length, 0);
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-2 rounded-lg border bg-background">
      <CollapsibleTrigger className="flex w-full items-center gap-1.5 px-3 py-2 text-left hover:bg-muted/50">
        <Send className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Vendor Quotations
        </span>
        {total > 0 && <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">{total}</Badge>}
        {total === 0 && <span className="text-[11px] text-muted-foreground/70">none yet</span>}
        <ChevronDown className={cn("ml-auto h-3.5 w-3.5 text-muted-foreground transition-transform", open && "rotate-180")} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="grid gap-3 border-t p-3 lg:grid-cols-2">
          {(["RM", "PM"] as const).map((kind) => (
            <KindPanel
              key={kind}
              kind={kind}
              npdId={npdId}
              request={requests.find((r) => r.kind === kind) ?? null}
              sharedTeamId={sharedTeamId}
              onChanged={onChanged}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function KindPanel({
  kind, npdId, request, sharedTeamId, onChanged,
}: {
  kind: "RM" | "PM";
  npdId: string;
  request: ApiNpdQuoteRequest | null;
  sharedTeamId?: string;
  onChanged: () => void;
}) {
  const [brief, setBrief] = useState(request?.brief ?? "");
  const [images, setImages] = useState<string[]>(request?.images ?? []);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState(false);

  const link = request ? `${window.location.origin}/quote/${request.token}` : "";

  async function save() {
    if (!brief.trim()) { toast.error("Describe what you need before sharing a link."); return; }
    setBusy(true);
    try {
      await api.npdQuotes.open(npdId, kind, brief.trim(), images, sharedTeamId);
      toast.success(request ? "Requirement updated." : "Link created — share it with your vendors.");
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save.");
    } finally { setBusy(false); }
  }

  async function addImages(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    if (images.length + files.length > MAX_REF_IMAGES) {
      toast.error(`Up to ${MAX_REF_IMAGES} reference images.`);
      return;
    }
    setUploading(true);
    try {
      const token = localStorage.getItem("zoobalo_token");
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch(`${API_BASE}/api/upload`, {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: fd,
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) { toast.error(json?.error ?? "Upload failed."); continue; }
        setImages((prev) => [...prev, json.url]);
      }
      toast.message("Image added — press Update to save it to the requirement.");
    } finally { setUploading(false); }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true); setTimeout(() => setCopied(false), 1500);
      toast.success("Link copied — send it to your vendors.");
    } catch { toast.error("Could not copy the link."); }
  }

  async function toggleStatus() {
    if (!request) return;
    setBusy(true);
    try {
      const next = request.status === "open" ? "closed" : "open";
      await api.npdQuotes.update(request.id, { status: next }, sharedTeamId);
      toast.success(next === "closed" ? "Closed to new quotations." : "Reopened for quotations.");
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed.");
    } finally { setBusy(false); }
  }

  async function removeQuote(id: string, party: string) {
    if (!confirm(`Delete the quotation from ${party}?`)) return;
    try {
      await api.npdQuotes.removeQuote(id, sharedTeamId);
      toast.success("Quotation deleted.");
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete.");
    }
  }

  const quotes = request?.quotes ?? [];
  // Cheapest first so the comparison is immediate; unpriced quotes sink.
  const ranked = [...quotes].sort((a, b) => {
    const x = a.cost === null ? Infinity : Number(a.cost);
    const y = b.cost === null ? Infinity : Number(b.cost);
    return x - y;
  });

  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-xs font-semibold">{KIND_LABEL[kind]}</span>
        {request && (
          <Badge variant={request.status === "open" ? "secondary" : "outline"} className="h-4 px-1.5 text-[10px]">
            {request.status}
          </Badge>
        )}
        {quotes.length > 0 && (
          <span className="ml-auto text-[11px] text-muted-foreground">{quotes.length} quotation{quotes.length === 1 ? "" : "s"}</span>
        )}
      </div>

      <Textarea
        rows={3}
        className="text-xs"
        placeholder={kind === "RM"
          ? "What raw material do you need? Grade, quantity, purity, delivery location…"
          : "What packaging do you need? Material, size, print, quantity, finish…"}
        value={brief}
        onChange={(e) => setBrief(e.target.value)}
      />

      {images.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {images.map((src) => (
            <div key={src} className="relative">
              <img src={src} alt="" className="h-14 w-14 rounded border object-cover" />
              <button
                type="button"
                onClick={() => setImages((p) => p.filter((x) => x !== src))}
                className="absolute -right-1.5 -top-1.5 rounded-full border bg-background p-0.5 shadow-sm"
                aria-label="Remove reference image"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {images.length < MAX_REF_IMAGES && (
          <label className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-md border px-2 text-xs hover:bg-muted">
            {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImagePlus className="h-3 w-3" />}
            {uploading ? "Uploading…" : "Reference image"}
            <input type="file" accept="image/*" multiple className="hidden" onChange={addImages} disabled={uploading} />
          </label>
        )}
        <Button size="sm" className="h-7 text-xs" onClick={save} disabled={busy || uploading}>
          {busy ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Link2 className="mr-1 h-3 w-3" />}
          {request ? "Update" : "Create link"}
        </Button>
        {request && (
          <>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={copyLink}>
              {copied ? <Check className="mr-1 h-3 w-3 text-emerald-600" /> : <Copy className="mr-1 h-3 w-3" />}
              Copy link
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={toggleStatus} disabled={busy}>
              {request.status === "open"
                ? <><Lock className="mr-1 h-3 w-3" /> Close</>
                : <><Unlock className="mr-1 h-3 w-3" /> Reopen</>}
            </Button>
          </>
        )}
      </div>

      {request && (
        <p className="mt-1.5 break-all text-[10px] text-muted-foreground/80">{link}</p>
      )}

      {ranked.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {ranked.map((q, i) => (
            <div key={q.id} className="group rounded-lg border bg-background p-2 text-xs">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold">{q.partyName}</span>
                    {i === 0 && q.cost !== null && (
                      <Badge className="h-4 bg-emerald-600 px-1.5 text-[10px] hover:bg-emerald-600">lowest</Badge>
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-muted-foreground">
                    <span>Cost <span className="font-medium text-foreground">{fmtCost(q.cost)}</span></span>
                    {q.leadTime && <span>Lead {q.leadTime}</span>}
                    <span>{fmtWhen(q.submittedAt)}</span>
                  </div>
                  {q.description && (
                    <p className="mt-1 whitespace-pre-wrap leading-relaxed text-muted-foreground">{q.description}</p>
                  )}
                  {q.images.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {q.images.map((src) => (
                        <a key={src} href={src} target="_blank" rel="noopener noreferrer">
                          <img src={src} alt="" className="h-12 w-12 rounded border object-cover" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
                <Button
                  size="sm" variant="ghost"
                  className="h-6 w-6 shrink-0 p-0 text-destructive opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                  onClick={() => removeQuote(q.id, q.partyName)}
                  title="Delete quotation"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
