import { createFileRoute, useRouter } from "@tanstack/react-router";
import { PageSkeleton } from "@/components/page-skeleton";
import { PageHeader } from "@/components/page-header";
import { api, receivingsApi, type ApiReceiving, type ApiSku } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Plus, Trash2, Edit2, Search, PackageCheck } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/receivings/")({
  loader: async () => {
    if (typeof window === "undefined") return null;
    const [rows, suggestions, skus] = await Promise.all([
      receivingsApi.list(), receivingsApi.suggestions(), api.skus.list(),
    ]);
    return { rows, suggestions, skus };
  },
  pendingComponent: PageSkeleton,
  component: ReceivingsPage,
  head: () => ({ meta: [{ title: "Receivings — Zoobalo" }] }),
});

// COA, GRN and the invoice all travel the same road: not here, here, put away.
const ARRIVAL_STATUSES = ["Not Received", "Received", "Stored"] as const;
const DONE_STATUSES    = ["Pending", "Done"] as const;

/** Rows kept in the DOM at once. Nineteen columns each; more than this and
 *  scrolling starts to cost more than paging does. */
const PAGE_SIZE = 50;

/** Red for outstanding, orange for in hand, green for finished. */
const STATUS_COLOUR: Record<string, string> = {
  "Not Received": "text-red-600 dark:text-red-400",
  "Pending":      "text-red-600 dark:text-red-400",
  "Received":     "text-orange-600 dark:text-orange-400",
  "Stored":       "text-green-700 dark:text-green-400",
  "Done":         "text-green-700 dark:text-green-400",
};


/** The five status columns, editable straight from the row. */
const STATUS_LABELS = {
  coaStatus: "COA", grnStatus: "GRN", invoiceStatus: "Invoice Status",
  qc: "QC", finalStatus: "Final Status",
} as const;

/** Wide enough for "Not Received" and for the longest heading above it. */
const STATUS_WIDTH = "min-w-[132px]";

const STATUS_COLUMNS = {
  coaStatus:     ARRIVAL_STATUSES,
  grnStatus:     ARRIVAL_STATUSES,
  invoiceStatus: ARRIVAL_STATUSES,
  qc:            DONE_STATUSES,
  finalStatus:   DONE_STATUSES,
} as const;
type StatusKey = keyof typeof STATUS_COLUMNS;

const EMPTY = {
  skuName: "", partyName: "", batchNo: "",
  receivedQty: "", receivedDate: "",
  poNumber: "", poDate: "", poQty: "",
  invoiceNumber: "", invoiceDate: "", invoiceQty: "",
  mfgDate: "", expDate: "", mrp: "",
  coaStatus: "Not Received", grnStatus: "Not Received", invoiceStatus: "Not Received",
  qc: "Pending", finalStatus: "Pending", comments: "",
};
type Form = typeof EMPTY;

/**
 * The Indian financial year a date falls in: April to March, so 14-10-2026
 * and 03-02-2027 are both "2026-2027". Receipts without a date belong to none.
 */
const NO_DATE = "__nodate__";
const ALL_YEARS = "__all__";

function financialYear(iso: string | null): string | null {
  if (!iso) return null;
  const [y, m] = iso.split("-").map(Number);
  if (!y || !m) return null;
  const start = m >= 4 ? y : y - 1;
  return `${start}-${start + 1}`;
}

/** "2026-04-01" as stored, "01-04-2026" as the warehouse writes it. */
const fmtDate = (d: string | null) => {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return y && m && day ? `${day}-${m}-${y}` : d;
};
const fmtQty = (v: string | null) =>
  v === null || v === "" ? "—" : Number(v).toLocaleString("en-IN");

/**
 * A status, changed where it is read.
 *
 * Deliberately the browser's own select. A page of receipts carries five of
 * these per row, and a few hundred rich popovers cost more to mount than the
 * whole rest of the table; the native control opens instantly and costs
 * almost nothing until it does.
 */
const StatusCell = memo(function StatusCell({ field, value, onChange }: {
  field: StatusKey; value: string; onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full cursor-pointer appearance-none whitespace-nowrap bg-transparent text-xs font-medium outline-none transition-opacity hover:opacity-60 focus:ring-0 ${
        STATUS_COLOUR[value] ?? "text-muted-foreground"
      }`}
    >
      {/* Rows carried over from the sheet have no status recorded yet. */}
      {!value && <option value="">—</option>}
      {STATUS_COLUMNS[field].map((s) => <option key={s} value={s}>{s}</option>)}
    </select>
  );
});

/** One row, re-rendering only when its own data changes. */
const ReceivingRow = memo(function ReceivingRow({ r, onStatus, onEdit, onDelete }: {
  r: ApiReceiving;
  onStatus: (r: ApiReceiving, key: StatusKey, value: string) => void;
  onEdit: (r: ApiReceiving) => void;
  onDelete: (r: ApiReceiving) => void;
}) {
  // Both numbers are kept so a short delivery is visible; say so.
  const short = r.invoiceQty && r.receivedQty && Number(r.receivedQty) < Number(r.invoiceQty);
  return (
    <tr className="align-top">
      <td className="px-3 py-2.5 font-medium">{r.skuName}</td>
      <td className="px-3 py-2.5 text-muted-foreground">{r.partyName}</td>
      <td className="px-3 py-2.5 text-muted-foreground">{r.batchNo || "—"}</td>
      <td className="px-3 py-2.5 text-right tabular-nums">
        {fmtQty(r.receivedQty)}
        {short && <span className="ml-1 text-[10px] text-amber-700">short</span>}
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap">{fmtDate(r.receivedDate)}</td>
      <td className="px-3 py-2.5 text-muted-foreground">{r.poNumber || "—"}</td>
      <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">{fmtDate(r.poDate)}</td>
      <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{fmtQty(r.poQty)}</td>
      <td className="px-3 py-2.5">{r.invoiceNumber || "—"}</td>
      <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">{fmtDate(r.invoiceDate)}</td>
      <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{fmtQty(r.invoiceQty)}</td>
      <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">{r.mfgDate || "—"}</td>
      <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">{r.expDate || "—"}</td>
      <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{fmtQty(r.mrp)}</td>
      {(Object.keys(STATUS_COLUMNS) as StatusKey[]).map((key) => (
        <td key={key} className={`px-3 py-2 ${STATUS_WIDTH}`}>
          <StatusCell field={key} value={r[key]} onChange={(v) => onStatus(r, key, v)} />
        </td>
      ))}
      <td className="px-3 py-2.5 max-w-[14rem] whitespace-pre-wrap text-xs text-muted-foreground">
        {r.comments || "—"}
      </td>
      <td className="px-3 py-2.5 text-right">
        <div className="flex items-center justify-end gap-0.5">
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => onEdit(r)}>
            <Edit2 className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost"
            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
            onClick={() => onDelete(r)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
});

function ReceivingsPage() {
  const data = Route.useLoaderData();
  if (!data) return <PageSkeleton />;
  return <ReceivingsContent {...data} />;
}

function ReceivingsContent({ rows, suggestions, skus }: {
  rows: ApiReceiving[];
  suggestions: { skuNames: string[]; partyNames: string[] };
  skus: ApiSku[];
}) {
  const router = useRouter();
  const reload = () => router.invalidate();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<ApiReceiving | null>(null);
  const [form, setForm] = useState<Form>({ ...EMPTY });
  const [saving, setSaving] = useState(false);

  // A status set from the row shows immediately and is reconciled when the
  // list comes back, so the table does not blink on every change.
  const [pending, setPending] = useState<Record<string, Partial<ApiReceiving>>>({});
  const [fy, setFy] = useState<string>(() => financialYear(new Date().toISOString().slice(0, 10))!);
  const [q, setQ] = useState("");
  const [party, setParty] = useState("__all__");
  const [status, setStatus] = useState("__all__");

  // The catalogue seeds the suggestions; what has been received before fills
  // in everything the catalogue does not carry — packaging, refills, couriers.
  const skuOptions = useMemo(
    () => [...new Set([...skus.map((s) => s.name), ...suggestions.skuNames])].sort(),
    [skus, suggestions]);
  const partyOptions = useMemo(() => [...suggestions.partyNames].sort(), [suggestions]);
  const parties = useMemo(
    () => [...new Set(rows.map((r) => r.partyName).filter(Boolean))].sort(), [rows]);

  // Offered years come from the data, newest first, plus this one so a fresh
  // year can be selected before anything has been received in it.
  const fyOptions = useMemo(() => {
    const seen = new Set(rows.map((r) => financialYear(r.receivedDate)).filter(Boolean) as string[]);
    seen.add(financialYear(new Date().toISOString().slice(0, 10))!);
    return [...seen].sort().reverse();
  }, [rows]);
  const hasUndated = useMemo(() => rows.some((r) => !r.receivedDate), [rows]);

  const merged = useMemo(
    () => rows.map((r) => (pending[r.id] ? { ...r, ...pending[r.id] } : r)), [rows, pending]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return merged.filter((r) => {
      if (fy === NO_DATE) { if (r.receivedDate) return false; }
      else if (fy !== ALL_YEARS && financialYear(r.receivedDate) !== fy) return false;
      if (party !== "__all__" && r.partyName !== party) return false;
      if (status !== "__all__" && r.finalStatus !== status) return false;
      if (!needle) return true;
      return [r.skuName, r.partyName, r.batchNo, r.invoiceNumber, r.poNumber]
        .some((v) => v?.toLowerCase().includes(needle));
    });
  }, [merged, fy, q, party, status]);

  const totalReceived = useMemo(
    () => visible.reduce((sum, r) => sum + Number(r.receivedQty ?? 0), 0), [visible]);

  // ── 4. only a page of rows is in the DOM at a time ──
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const pageRows = useMemo(
    () => visible.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE),
    [visible, current]);

  const resetPage = () => setPage(0);

  const openCreate = () => { setForm({ ...EMPTY }); setEditing(null); setSheetOpen(true); };
  const openEdit = (r: ApiReceiving) => {
    setForm({
      skuName: r.skuName, partyName: r.partyName, batchNo: r.batchNo,
      receivedQty: r.receivedQty ?? "", receivedDate: r.receivedDate ?? "",
      poNumber: r.poNumber, poDate: r.poDate ?? "", poQty: r.poQty ?? "",
      invoiceNumber: r.invoiceNumber, invoiceDate: r.invoiceDate ?? "", invoiceQty: r.invoiceQty ?? "",
      mfgDate: r.mfgDate, expDate: r.expDate, mrp: r.mrp ?? "",
      coaStatus: r.coaStatus, grnStatus: r.grnStatus, invoiceStatus: r.invoiceStatus,
      qc: r.qc, finalStatus: r.finalStatus, comments: r.comments,
    });
    setEditing(r);
    setSheetOpen(true);
  };

  const save = async () => {
    if (!form.skuName.trim())   { toast.error("SKU name is required."); return; }
    if (!form.partyName.trim()) { toast.error("Party name is required."); return; }
    setSaving(true);
    try {
      if (editing) {
        await receivingsApi.update(editing.id, form);
        setPending((p) => { const next = { ...p }; delete next[editing.id]; return next; });
        toast.success("Receiving updated.");
      } else {
        await receivingsApi.create(form);
        toast.success("Receiving recorded.");
      }
      setSheetOpen(false);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save.");
    } finally { setSaving(false); }
  };

  // The new value is already on screen and already saved; refetching the list,
  // the suggestions and the SKU catalogue to learn one word we just wrote was
  // what made each change feel slow. On failure the row goes back.
  const changeStatus = useCallback(async (r: ApiReceiving, key: StatusKey, value: string) => {
    const previous = r[key];
    setPending((p) => ({ ...p, [r.id]: { ...p[r.id], [key]: value } }));
    try {
      await receivingsApi.update(r.id, { [key]: value });
    } catch (e) {
      setPending((p) => ({ ...p, [r.id]: { ...p[r.id], [key]: previous } }));
      toast.error(e instanceof Error ? e.message : "Could not update the status.");
    }
  }, []);

  const remove = async (r: ApiReceiving) => {
    if (!confirm(`Delete the ${r.skuName} receiving from ${r.partyName}?`)) return;
    try { await receivingsApi.delete(r.id); toast.success("Deleted."); reload(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not delete."); }
  };

  const set = (k: keyof Form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Receivings"
        description={
          `${fy === ALL_YEARS ? "All years" : fy === NO_DATE ? "No received date" : `FY ${fy}`}` +
          ` · ${visible.length} receipt${visible.length !== 1 ? "s" : ""}` +
          ` · ${totalReceived.toLocaleString("en-IN")} units received`
        }
        actions={<Button onClick={openCreate}><Plus className="mr-1.5 h-4 w-4" />Record Receiving</Button>}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Select value={fy} onValueChange={(v) => { setFy(v); resetPage(); }}>
          <SelectTrigger className="h-8 w-44 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {fyOptions.map((y) => <SelectItem key={y} value={y}>FY {y}</SelectItem>)}
            {hasUndated && <SelectItem value={NO_DATE}>No received date</SelectItem>}
            <SelectItem value={ALL_YEARS}>All years</SelectItem>
          </SelectContent>
        </Select>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-8 w-60 pl-8 text-xs"
            placeholder="SKU, party, batch, invoice, PO…"
            value={q}
            onChange={(e) => { setQ(e.target.value); resetPage(); }}
          />
        </div>

        <Select value={party} onValueChange={(v) => { setParty(v); resetPage(); }}>
          <SelectTrigger className="h-8 w-52 text-xs"><SelectValue placeholder="All parties" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All parties</SelectItem>
            {parties.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={status} onValueChange={(v) => { setStatus(v); resetPage(); }}>
          <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All statuses</SelectItem>
            {DONE_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>

        {(q || party !== "__all__" || status !== "__all__") && (
          <Button size="sm" variant="ghost" className="h-8 text-xs"
            onClick={() => { setQ(""); setParty("__all__"); setStatus("__all__"); resetPage(); }}>
            Clear
          </Button>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border bg-card p-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <PackageCheck className="h-7 w-7" />
          </div>
          <div>
            <p className="font-semibold">
              {rows.length
                ? (q || party !== "__all__" || status !== "__all__")
                  ? "Nothing matches those filters"
                  : `Nothing received in FY ${fy}`
                : "No receivings yet"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Record each shipment as it lands at the warehouse — what came in, from whom, against which invoice.
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-[1880px] text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2.5 text-left font-medium">SKU Name</th>
                <th className="px-3 py-2.5 text-left font-medium">Party Name</th>
                <th className="px-3 py-2.5 text-left font-medium">Batch No</th>
                <th className="px-3 py-2.5 text-right font-medium">Received Qty</th>
                <th className="px-3 py-2.5 text-left font-medium">Received Date</th>
                <th className="px-3 py-2.5 text-left font-medium">PO Number</th>
                <th className="px-3 py-2.5 text-left font-medium">PO Date</th>
                <th className="px-3 py-2.5 text-right font-medium">PO Qty</th>
                <th className="px-3 py-2.5 text-left font-medium">Invoice No</th>
                <th className="px-3 py-2.5 text-left font-medium">Invoice Date</th>
                <th className="px-3 py-2.5 text-right font-medium">Invoice Qty</th>
                <th className="px-3 py-2.5 text-left font-medium">MFG</th>
                <th className="px-3 py-2.5 text-left font-medium">EXP</th>
                <th className="px-3 py-2.5 text-right font-medium">MRP</th>
                {(Object.keys(STATUS_COLUMNS) as StatusKey[]).map((key) => (
                  <th key={key} className={`px-3 py-2.5 text-left font-medium whitespace-nowrap ${STATUS_WIDTH}`}>
                    {STATUS_LABELS[key]}
                  </th>
                ))}
                <th className="px-3 py-2.5 text-left font-medium">Comments</th>
                <th className="px-3 py-2.5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {pageRows.map((r) => (
                <ReceivingRow
                  key={r.id}
                  r={r}
                  onStatus={changeStatus}
                  onEdit={openEdit}
                  onDelete={remove}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pageCount > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {current * PAGE_SIZE + 1}–{Math.min((current + 1) * PAGE_SIZE, visible.length)} of {visible.length}
          </span>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" className="h-7 text-xs"
              disabled={current === 0} onClick={() => setPage(current - 1)}>
              Previous
            </Button>
            <span className="px-2">Page {current + 1} of {pageCount}</span>
            <Button size="sm" variant="outline" className="h-7 text-xs"
              disabled={current >= pageCount - 1} onClick={() => setPage(current + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}

      <Sheet key={editing?.id ?? "new"} open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>{editing ? "Edit Receiving" : "Record Receiving"}</SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-5">
            {/* Free text with suggestions: most of what arrives is not a catalogue SKU. */}
            <datalist id="receiving-skus">
              {skuOptions.map((n) => <option key={n} value={n} />)}
            </datalist>
            <datalist id="receiving-parties">
              {partyOptions.map((n) => <option key={n} value={n} />)}
            </datalist>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label>SKU Name *</Label>
                <Input list="receiving-skus" placeholder="Start typing — or enter anything"
                  value={form.skuName} onChange={(e) => set("skuName")(e.target.value)} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Party Name *</Label>
                <Input list="receiving-parties" placeholder="Manufacturer or supplier"
                  value={form.partyName} onChange={(e) => set("partyName")(e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label>Batch No</Label>
                <Input value={form.batchNo} onChange={(e) => set("batchNo")(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Received Qty</Label>
                <Input type="number" value={form.receivedQty} onChange={(e) => set("receivedQty")(e.target.value)} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Received Date</Label>
                <Input type="date" value={form.receivedDate} onChange={(e) => set("receivedDate")(e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label>PO Number</Label>
                <Input value={form.poNumber} onChange={(e) => set("poNumber")(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>PO Quantity</Label>
                <Input type="number" value={form.poQty} onChange={(e) => set("poQty")(e.target.value)} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>PO Date</Label>
                <Input type="date" value={form.poDate} onChange={(e) => set("poDate")(e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label>Invoice Number</Label>
                <Input value={form.invoiceNumber} onChange={(e) => set("invoiceNumber")(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Invoice Quantity</Label>
                <Input type="number" value={form.invoiceQty} onChange={(e) => set("invoiceQty")(e.target.value)} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Invoice Date</Label>
                <Input type="date" value={form.invoiceDate} onChange={(e) => set("invoiceDate")(e.target.value)} />
              </div>

              {/* Printed on the carton by month, so kept exactly as written. */}
              <div className="space-y-1.5">
                <Label>MFG Date</Label>
                <Input placeholder="e.g. Mar-26" value={form.mfgDate} onChange={(e) => set("mfgDate")(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>EXP Date</Label>
                <Input placeholder="e.g. Mar-28" value={form.expDate} onChange={(e) => set("expDate")(e.target.value)} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>MRP</Label>
                <Input type="number" value={form.mrp} onChange={(e) => set("mrp")(e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label>COA Status</Label>
                <Select value={form.coaStatus} onValueChange={set("coaStatus")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ARRIVAL_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>GRN Status</Label>
                <Select value={form.grnStatus} onValueChange={set("grnStatus")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ARRIVAL_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Invoice Status</Label>
                <Select value={form.invoiceStatus} onValueChange={set("invoiceStatus")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ARRIVAL_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>QC</Label>
                <Select value={form.qc} onValueChange={set("qc")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DONE_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Final Status</Label>
                <Select value={form.finalStatus} onValueChange={set("finalStatus")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DONE_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2 space-y-1.5">
                <Label>Comments</Label>
                <Textarea rows={3} value={form.comments} onChange={(e) => set("comments")(e.target.value)} />
              </div>
            </div>
          </div>

          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setSheetOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : editing ? "Save changes" : "Record Receiving"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
