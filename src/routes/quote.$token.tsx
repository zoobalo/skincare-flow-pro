import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, type ApiPublicQuoteRequest } from "@/lib/api";
import { CheckCircle2, Upload, X, Loader2, FileQuestion } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/quote/$token")({
  loader: async ({ params }) => {
    if (typeof window === "undefined") return null;
    try {
      return { request: await api.publicQuote.get(params.token), token: params.token };
    } catch {
      return { request: null, token: params.token };
    }
  },
  component: QuotePage,
  head: () => ({ meta: [{ title: "Submit a quotation — Zoobalo" }] }),
});

const MAX_IMAGES = 6;

function QuotePage() {
  const data = Route.useLoaderData();
  // Server render has no data (the API client is browser-only), so show a
  // placeholder rather than a blank page — this link goes to outsiders.
  if (!data) return <Loading />;
  if (!data.request) return <Invalid />;
  return <QuoteForm request={data.request} token={data.token} />;
}

function Loading() {
  return (
    <Shell>
      <div className="rounded-xl border bg-card p-10 text-center">
        <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading the request…</p>
        <noscript>
          <p className="mt-3 text-sm text-destructive">
            This page needs JavaScript enabled to submit a quotation.
          </p>
        </noscript>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-muted/30 px-4 py-10">
      <div className="mx-auto w-full max-w-2xl">{children}</div>
    </div>
  );
}

function Invalid() {
  return (
    <Shell>
      <div className="rounded-xl border bg-card p-10 text-center">
        <FileQuestion className="mx-auto mb-3 h-9 w-9 text-muted-foreground/40" />
        <h1 className="text-lg font-semibold">This link isn't valid</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          It may have been withdrawn or mistyped. Please ask your contact for a current link.
        </p>
      </div>
    </Shell>
  );
}

function QuoteForm({ request, token }: { request: ApiPublicQuoteRequest; token: string }) {
  const isPM = request.kind === "PM";
  const [form, setForm] = useState({ partyName: "", leadTime: "", cost: "", description: "" });
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  async function pickImages(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    if (images.length + files.length > MAX_IMAGES) {
      toast.error(`You can attach up to ${MAX_IMAGES} images.`);
      return;
    }
    setUploading(true);
    try {
      for (const file of files) {
        const body = new FormData();
        body.append("file", file);
        const res = await fetch(api.publicQuote.uploadUrl(token), { method: "POST", body });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) { toast.error(json?.error ?? "Upload failed."); continue; }
        setImages((prev) => [...prev, json.url]);
      }
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    if (!form.partyName.trim()) { toast.error("Please enter your company name."); return; }
    if (!form.cost.trim()) { toast.error("Please enter a cost."); return; }
    setSaving(true);
    try {
      await api.publicQuote.submit(token, { ...form, partyName: form.partyName.trim(), images });
      setDone(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <Shell>
        <div className="rounded-xl border bg-card p-10 text-center">
          <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-600" />
          <h1 className="text-lg font-semibold">Quotation received</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Thank you. Your quotation for <span className="font-medium text-foreground">{request.npdName}</span> has
            reached the procurement team. They will contact you if they need anything further.
          </p>
        </div>
      </Shell>
    );
  }

  if (request.status !== "open") {
    return (
      <Shell>
        <div className="rounded-xl border bg-card p-10 text-center">
          <h1 className="text-lg font-semibold">This request is closed</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Quotations for {request.npdName} are no longer being accepted.
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mb-5 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Zoobalo · Procurement</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Request for quotation</h1>
      </div>

      {/* Our requirement */}
      <div className="rounded-xl border bg-card p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
            {isPM ? "Packaging Material" : "Raw Material"}
          </span>
          <h2 className="text-base font-semibold">{request.npdName}</h2>
        </div>
        {request.brief ? (
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{request.brief}</p>
        ) : (
          <p className="mt-3 text-sm italic text-muted-foreground">No further details provided.</p>
        )}
      </div>

      {/* Their quotation */}
      <div className="mt-4 rounded-xl border bg-card p-5">
        <h2 className="text-sm font-semibold">Your quotation</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">Fields marked * are required.</p>

        <div className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="partyName">Party name <span className="text-destructive">*</span></Label>
            <Input id="partyName" placeholder="Your company name" value={form.partyName} onChange={set("partyName")} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cost">Cost <span className="text-destructive">*</span></Label>
              <Input id="cost" inputMode="decimal" placeholder="e.g. 142.50 per kg" value={form.cost} onChange={set("cost")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="leadTime">Lead time</Label>
              <Input id="leadTime" placeholder="e.g. 15 days" value={form.leadTime} onChange={set("leadTime")} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description" rows={4}
              placeholder="Specifications, grade, MOQ, payment terms, anything else we should know…"
              value={form.description} onChange={set("description")}
            />
          </div>

          {isPM && (
            <div className="space-y-2">
              <Label>Product images</Label>
              <p className="text-xs text-muted-foreground">
                Up to {MAX_IMAGES} images, 1 MB each. JPEG, PNG, WebP or GIF.
              </p>
              {images.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {images.map((src) => (
                    <div key={src} className="relative">
                      <img src={src} alt="" className="h-20 w-20 rounded-lg border object-cover" />
                      <button
                        type="button"
                        onClick={() => setImages((p) => p.filter((x) => x !== src))}
                        className="absolute -right-1.5 -top-1.5 rounded-full border bg-background p-0.5 shadow-sm"
                        aria-label="Remove image"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {images.length < MAX_IMAGES && (
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-2 text-sm hover:bg-muted">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {uploading ? "Uploading…" : "Add images"}
                  <input type="file" accept="image/*" multiple className="hidden" onChange={pickImages} disabled={uploading} />
                </label>
              )}
            </div>
          )}
        </div>

        <Button className="mt-6 w-full" onClick={submit} disabled={saving || uploading}>
          {saving ? "Submitting…" : "Submit quotation"}
        </Button>
      </div>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Your quotation is sent only to the Zoobalo procurement team.
      </p>
    </Shell>
  );
}
