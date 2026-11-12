import { createFileRoute, useRouter } from "@tanstack/react-router";
import { PageSkeleton } from "@/components/page-skeleton";
import { PageHeader } from "@/components/page-header";
import { paymentsApi, type ApiPaymentInvoice, type ApiPaymentParty } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Search, Wallet, Check } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/payments/")({
  loader: async () => {
    if (typeof window === "undefined") return null;
    const [invoices, parties] = await Promise.all([paymentsApi.list(), paymentsApi.terms()]);
    return { invoices, parties };
  },
  pendingComponent: PageSkeleton,
  component: PaymentsPage,
  head: () => ({ meta: [{ title: "Payments — Zoobalo" }] }),
});

const QC_OPTIONS    = ["Pending", "Done"] as const;
const GO_OPTIONS    = ["Stop", "Go"] as const;
const PAY_OPTIONS   = ["Pending", "Conveyed to accounts team", "Completed"] as const;

const EDITABLE = {
  internalQc:    QC_OPTIONS,
  externalQc:    QC_OPTIONS,
  finalStatus:   GO_OPTIONS,
  paymentStatus: PAY_OPTIONS,
} as const;
type EditableKey = keyof typeof EDITABLE;

const COLOUR: Record<string, string> = {
  Pending: "text-red-600 dark:text-red-400",
  Done:    "text-green-700 dark:text-green-400",
  Stop:    "text-red-600 dark:text-red-400",
  Go:      "text-green-700 dark:text-green-400",
  "Conveyed to accounts team": "text-orange-600 dark:text-orange-400",
  Completed: "text-green-700 dark:text-green-400",
};

const fmtDate = (d: string | null) => {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return y && m && day ? `${day}-${m}-${y}` : d;
};

const today = () => new Date().toISOString().slice(0, 10);

/** Invoice date plus the credit days agreed when it was booked. */
function dueOn(invoiceDate: string | null, dueDays: number): string | null {
  if (!invoiceDate) return null;
  const d = new Date(`${invoiceDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() + dueDays);
  return d.toISOString().slice(0, 10);
}

/** Whole days between two ISO dates. */
const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/**
 * How far through the credit period an invoice is.
 * Once the agreed days have passed the count turns green: the money is due
 * and the invoice can go to accounts.
 */
function creditProgress(invoiceDate: string | null, dueDays: number) {
  if (!invoiceDate) return null;
  const elapsed = daysBetween(invoiceDate, today());
  return { elapsed, dueDays, complete: elapsed >= dueDays, remaining: dueDays - elapsed };
}

function PaymentsPage() {
  const data = Route.useLoaderData();
  if (!data) return <PageSkeleton />;
  return <PaymentsContent invoices={data.invoices} parties={data.parties} />;
}

function PaymentsContent({ invoices, parties }: {
  invoices: ApiPaymentInvoice[]; parties: ApiPaymentParty[];
}) {
  const router = useRouter();
  const reload = () => router.invalidate();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");
  const [pending, setPending] = useState<Record<string, Partial<ApiPaymentInvoice>>>({});

  const creditDays = useMemo(
    () => new Map(parties.map((p) => [`${p.partyType}:${p.partyId}`, p.creditDays])), [parties]);

  const EMPTY = {
    party: "", invoiceNumber: "", invoiceDate: today(), dueDays: "0",
    internalQc: "Pending", externalQc: "Pending", finalStatus: "Stop", comments: "",
  };
  const [form, setForm] = useState({ ...EMPTY });

  const merged = useMemo(
    () => invoices.map((r) => (pending[r.id] ? { ...r, ...pending[r.id] } : r)),
    [invoices, pending]);

  const needle = q.trim().toLowerCase();
  const matches = useMemo(() => merged.filter((r) =>
    !needle || [r.partyName, r.invoiceNumber].some((v) => v?.toLowerCase().includes(needle))),
    [merged, needle]);

  const open = useMemo(() => matches.filter((r) => r.paymentStatus !== "Completed"), [matches]);
  const done = useMemo(() => matches.filter((r) => r.paymentStatus === "Completed"), [matches]);
  const dueNow = useMemo(() => open.filter((r) => creditProgress(r.invoiceDate, r.dueDays)?.complete).length, [open]);

  const change = useCallback(async (r: ApiPaymentInvoice, key: EditableKey, value: string) => {
    const previous = r[key];
    setPending((p) => ({ ...p, [r.id]: { ...p[r.id], [key]: value } }));
    try {
      await paymentsApi.update(r.id, { [key]: value });
      // Completing a payment moves it to the other tab, so the list must reload.
      if (key === "paymentStatus" && (value === "Completed" || previous === "Completed")) {
        setPending((p) => { const n = { ...p }; delete n[r.id]; return n; });
        await reload();
      }
    } catch (e) {
      setPending((p) => ({ ...p, [r.id]: { ...p[r.id], [key]: previous } }));
      toast.error(e instanceof Error ? e.message : "Could not update.");
    }
  }, []);

  const remove = useCallback(async (r: ApiPaymentInvoice) => {
    if (!confirm(`Delete invoice ${r.invoiceNumber} from ${r.partyName}?`)) return;
    try { await paymentsApi.delete(r.id); toast.success("Deleted."); reload(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not delete."); }
  }, []);

  // Choosing the party fills in its agreed credit days; it stays editable,
  // because one invoice is sometimes agreed differently.
  const pickParty = (value: string) => {
    const party = parties.find((p) => `${p.partyType}:${p.partyId}` === value);
    setForm((f) => ({
      ...f,
      party: value,
      dueDays: party?.creditDays != null ? String(party.creditDays) : f.dueDays,
    }));
  };

  const book = async () => {
    const party = parties.find((p) => `${p.partyType}:${p.partyId}` === form.party);
    if (!party) { toast.error("Choose the vendor or manufacturer."); return; }
    if (!form.invoiceNumber.trim()) { toast.error("Invoice number is required."); return; }
    if (!form.invoiceDate) { toast.error("Invoice date is required."); return; }
    setSaving(true);
    try {
      await paymentsApi.create({
        partyId: party.partyId, partyType: party.partyType,
        invoiceNumber: form.invoiceNumber, invoiceDate: form.invoiceDate,
        dueDays: Number(form.dueDays) || 0,
        internalQc: form.internalQc, externalQc: form.externalQc,
        finalStatus: form.finalStatus, comments: form.comments,
      });
      toast.success("Invoice booked.");
      setForm({ ...EMPTY });
      setSheetOpen(false);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not book the invoice.");
    } finally { setSaving(false); }
  };

  const missingTerms = parties.filter((p) => p.creditDays == null).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        description={`${open.length} awaiting payment · ${dueNow} past their credit period · ${done.length} completed`}
        actions={
          <Button onClick={() => { setForm({ ...EMPTY }); setSheetOpen(true); }}>
            <Plus className="mr-1.5 h-4 w-4" />Book Invoice
          </Button>
        }
      />

      <Tabs defaultValue="open">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsList>
            <TabsTrigger value="open">Awaiting payment ({open.length})</TabsTrigger>
            <TabsTrigger value="done">Completed ({done.length})</TabsTrigger>
            <TabsTrigger value="terms">Credit Days</TabsTrigger>
          </TabsList>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input className="h-8 w-56 pl-8 text-xs" placeholder="Party or invoice number…"
              value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>

        <TabsContent value="open" className="mt-4">
          <InvoiceTable rows={open} onChange={change} onDelete={remove} emptyNote="Nothing is awaiting payment." />
        </TabsContent>

        <TabsContent value="done" className="mt-4">
          <InvoiceTable rows={done} onChange={change} onDelete={remove} emptyNote="No payments completed yet." />
        </TabsContent>

        <TabsContent value="terms" className="mt-4">
          <CreditDaysTab parties={parties} missing={missingTerms} onSaved={reload} />
        </TabsContent>
      </Tabs>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader><SheetTitle>Book Invoice</SheetTitle></SheetHeader>
          <div className="mt-6 grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label>Vendor / Manufacturer *</Label>
              <Select value={form.party} onValueChange={pickParty}>
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  {parties.map((p) => (
                    <SelectItem key={`${p.partyType}:${p.partyId}`} value={`${p.partyType}:${p.partyId}`}>
                      {p.partyName}
                      <span className="ml-1.5 text-xs text-muted-foreground">
                        {p.partyType}{p.creditDays != null ? ` · ${p.creditDays}d` : ""}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Invoice Number *</Label>
              <Input value={form.invoiceNumber}
                onChange={(e) => setForm((f) => ({ ...f, invoiceNumber: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Invoice Date *</Label>
              <Input type="date" value={form.invoiceDate}
                onChange={(e) => setForm((f) => ({ ...f, invoiceDate: e.target.value }))} />
            </div>

            <div className="col-span-2 space-y-1.5">
              <Label>Due days</Label>
              <Input type="number" min={0} value={form.dueDays}
                onChange={(e) => setForm((f) => ({ ...f, dueDays: e.target.value }))} />
              <p className="text-xs text-muted-foreground">
                {form.party
                  ? creditDays.get(form.party) != null
                    ? `From this party's credit days. Payment falls due ${fmtDate(dueOn(form.invoiceDate, Number(form.dueDays) || 0))}.`
                    : "No credit days recorded for this party yet — set them on the Credit Days tab."
                  : "Filled in from the party's credit days once you choose one."}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Internal QC</Label>
              <Select value={form.internalQc} onValueChange={(v) => setForm((f) => ({ ...f, internalQc: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {QC_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>External QC</Label>
              <Select value={form.externalQc} onValueChange={(v) => setForm((f) => ({ ...f, externalQc: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {QC_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Final Status</Label>
              <Select value={form.finalStatus} onValueChange={(v) => setForm((f) => ({ ...f, finalStatus: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GO_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2 space-y-1.5">
              <Label>Comments</Label>
              <Textarea rows={3} value={form.comments}
                onChange={(e) => setForm((f) => ({ ...f, comments: e.target.value }))} />
            </div>
          </div>
          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setSheetOpen(false)}>Cancel</Button>
            <Button onClick={book} disabled={saving}>{saving ? "Booking…" : "Book Invoice"}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

const Cell = memo(function Cell({ field, value, onChange }: {
  field: EditableKey; value: string; onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full cursor-pointer appearance-none whitespace-nowrap bg-transparent text-xs font-medium outline-none transition-opacity hover:opacity-60 ${
        COLOUR[value] ?? "text-muted-foreground"
      }`}
    >
      {EDITABLE[field].map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
});

const InvoiceRow = memo(function InvoiceRow({ r, onChange, onDelete }: {
  r: ApiPaymentInvoice;
  onChange: (r: ApiPaymentInvoice, key: EditableKey, value: string) => void;
  onDelete: (r: ApiPaymentInvoice) => void;
}) {
  const progress = creditProgress(r.invoiceDate, r.dueDays);
  return (
    <tr className="align-top">
      <td className="px-3 py-2.5 font-medium">{r.partyName || "—"}</td>
      <td className="px-3 py-2.5 text-xs text-muted-foreground">{r.partyType}</td>
      <td className="px-3 py-2.5">{r.invoiceNumber}</td>
      <td className="px-3 py-2.5 whitespace-nowrap">{fmtDate(r.invoiceDate)}</td>
      <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{r.dueDays}</td>
      <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
        {fmtDate(dueOn(r.invoiceDate, r.dueDays))}
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap tabular-nums">
        {/* Green once the agreed credit period has run its course. */}
        {progress ? (
          <span className={progress.complete
            ? "font-semibold text-green-700 dark:text-green-400"
            : "text-muted-foreground"}>
            {progress.complete
              ? `${progress.elapsed} / ${progress.dueDays} days`
              : `${progress.elapsed} / ${progress.dueDays} days`}
          </span>
        ) : "—"}
      </td>
      {(Object.keys(EDITABLE) as EditableKey[]).map((key) => (
        <td key={key} className="min-w-[120px] px-3 py-2">
          <Cell field={key} value={r[key]} onChange={(v) => onChange(r, key, v)} />
        </td>
      ))}
      <td className="px-3 py-2.5 max-w-[12rem] whitespace-pre-wrap text-xs text-muted-foreground">
        {r.comments || "—"}
      </td>
      <td className="px-3 py-2.5 text-right">
        <Button size="sm" variant="ghost"
          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
          onClick={() => onDelete(r)}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </td>
    </tr>
  );
});

function InvoiceTable({ rows, onChange, onDelete, emptyNote }: {
  rows: ApiPaymentInvoice[];
  onChange: (r: ApiPaymentInvoice, key: EditableKey, value: string) => void;
  onDelete: (r: ApiPaymentInvoice) => void;
  emptyNote: string;
}) {
  if (!rows.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border bg-card p-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Wallet className="h-7 w-7" />
        </div>
        <p className="font-semibold">{emptyNote}</p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full min-w-[1500px] text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-2.5 text-left font-medium">Party</th>
            <th className="px-3 py-2.5 text-left font-medium">Type</th>
            <th className="px-3 py-2.5 text-left font-medium">Invoice No</th>
            <th className="px-3 py-2.5 text-left font-medium">Invoice Date</th>
            <th className="px-3 py-2.5 text-right font-medium">Due Days</th>
            <th className="px-3 py-2.5 text-left font-medium">Due On</th>
            <th className="px-3 py-2.5 text-left font-medium">Days Elapsed</th>
            <th className="min-w-[120px] px-3 py-2.5 text-left font-medium">Internal QC</th>
            <th className="min-w-[120px] px-3 py-2.5 text-left font-medium">External QC</th>
            <th className="min-w-[120px] px-3 py-2.5 text-left font-medium">Final Status</th>
            <th className="min-w-[190px] px-3 py-2.5 text-left font-medium">Payment Status</th>
            <th className="px-3 py-2.5 text-left font-medium">Comments</th>
            <th className="px-3 py-2.5 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r) => <InvoiceRow key={r.id} r={r} onChange={onChange} onDelete={onDelete} />)}
        </tbody>
      </table>
    </div>
  );
}

/** Where the credit days come from that Book Invoice fills in. */
function CreditDaysTab({ parties, missing, onSaved }: {
  parties: ApiPaymentParty[]; missing: number; onSaved: () => void;
}) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const save = async (p: ApiPaymentParty) => {
    const k = `${p.partyType}:${p.partyId}`;
    const days = Number(draft[k]);
    if (!Number.isFinite(days) || days < 0) { toast.error("Enter a number of days."); return; }
    setBusy(k);
    try {
      await paymentsApi.setCreditDays(p.partyId, p.partyType, days);
      toast.success(`${p.partyName}: ${days} credit days.`);
      setDraft((d) => { const n = { ...d }; delete n[k]; return n; });
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save.");
    } finally { setBusy(null); }
  };

  return (
    <div className="space-y-3">
      {missing > 0 && (
        <p className="text-xs text-muted-foreground">
          {missing} of {parties.length} parties have no credit days yet. Booking an invoice for one
          of them starts at zero until you set them here.
        </p>
      )}
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2.5 text-left font-medium">Party</th>
              <th className="px-3 py-2.5 text-left font-medium">Type</th>
              <th className="px-3 py-2.5 text-left font-medium">Credit Days</th>
              <th className="px-3 py-2.5 text-right font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {parties.map((p) => {
              const k = `${p.partyType}:${p.partyId}`;
              const value = draft[k] ?? (p.creditDays != null ? String(p.creditDays) : "");
              const dirty = draft[k] !== undefined && draft[k] !== String(p.creditDays ?? "");
              return (
                <tr key={k}>
                  <td className="px-3 py-2 font-medium">{p.partyName}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{p.partyType}</td>
                  <td className="px-3 py-2">
                    <Input
                      type="number" min={0} className="h-8 w-28 text-xs"
                      placeholder="not set"
                      value={value}
                      onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === "Enter" && dirty) save(p); }}
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    {dirty && (
                      <Button size="sm" className="h-7 text-xs" disabled={busy === k} onClick={() => save(p)}>
                        <Check className="mr-1 h-3.5 w-3.5" />{busy === k ? "Saving…" : "Save"}
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
