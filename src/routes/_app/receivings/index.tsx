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
import { useState } from "react";
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

const COA_STATUSES     = ["Pending", "Received", "Not Required"] as const;
const GRN_STATUSES     = ["Pending", "Created", "Not Required"] as const;
const INVOICE_STATUSES = ["Pending", "Received", "Booked", "Paid"] as const;
const QC_STATUSES    = ["Pending", "Pass", "Fail", "On Hold"] as const;
const FINAL_STATUSES   = ["Pending", "Accepted", "Short Received", "Rejected"] as const;

/** The five status columns, editable straight from the row. */
const STATUS_COLUMNS = {
  coaStatus:     COA_STATUSES,
  grnStatus:     GRN_STATUSES,
  invoiceStatus: INVOICE_STATUSES,
  qc:            QC_STATUSES,
  finalStatus:   FINAL_STATUSES,
} as const;
type StatusKey = keyof typeof STATUS_COLUMNS;

const EMPTY = {
  skuName: "", partyName: "", batchNo: "",
  receivedQty: "", receivedDate: "",
  poNumber: "", poDate: "", poQty: "",
  invoiceNumber: "", invoiceDate: "", invoiceQty: "",
  mfgDate: "", expDate: "", mrp: "",
  coaStatus: "Pending", grnStatus: "Pending", invoiceStatus: "Pending",
  qc: "Pending", finalStatus: "Pending", comments: "",
};
type Form = typeof EMPTY;

/** "2026-04-01" as stored, "01-04-2026" as the warehouse writes it. */
const fmtDate = (d: string | null) => {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return y && m && day ? `${day}-${m}-${y}` : d;
};
const fmtQty = (v: string | null) =>
  v === null || v === "" ? "—" : Number(v).toLocaleString("en-IN");

/**
 * A status, changed where it is read. Chrome is stripped from the trigger so
 * a row of five of these still reads as a table rather than a row of controls.
 */
function StatusCell({ field, value, onChange }: {
  field: StatusKey; value: string; onChange: (v: string) => void;
}) {
  const muted = value === "Pending";
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-7 w-full border-0 bg-transparent p-0 text-xs shadow-none focus:ring-0 [&>svg]:opacity-40">
        <span className={muted ? "text-muted-foreground" : "font-medium"}>{value}</span>
      </SelectTrigger>
      <SelectContent>
        {STATUS_COLUMNS[field].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

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
  const [q, setQ] = useState("");
  const [party, setParty] = useState("__all__");
  const [status, setStatus] = useState("__all__");

  // The catalogue seeds the suggestions; what has been received before fills
  // in everything the catalogue does not carry — packaging, refills, couriers.
  const skuOptions = [...new Set([...skus.map((s) => s.name), ...suggestions.skuNames])].sort();
  const partyOptions = [...new Set(suggestions.partyNames)].sort();
  const parties = [...new Set(rows.map((r) => r.partyName).filter(Boolean))].sort();

  const needle = q.trim().toLowerCase();
  const visible = rows.map((r) => ({ ...r, ...pending[r.id] })).filter((r) => {
    if (party !== "__all__" && r.partyName !== party) return false;
    if (status !== "__all__" && r.finalStatus !== status) return false;
    if (!needle) return true;
    return [r.skuName, r.partyName, r.batchNo, r.invoiceNumber, r.poNumber]
      .some((v) => v?.toLowerCase().includes(needle));
  });

  const totalReceived = visible.reduce((sum, r) => sum + Number(r.receivedQty ?? 0), 0);

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
      if (editing) { await receivingsApi.update(editing.id, form); toast.success("Receiving updated."); }
      else         { await receivingsApi.create(form);             toast.success("Receiving recorded."); }
      setSheetOpen(false);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save.");
    } finally { setSaving(false); }
  };

  const changeStatus = async (r: ApiReceiving, key: StatusKey, value: string) => {
    setPending((p) => ({ ...p, [r.id]: { ...p[r.id], [key]: value } }));
    try {
      await receivingsApi.update(r.id, { [key]: value });
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update the status.");
    } finally {
      setPending((p) => { const next = { ...p }; delete next[r.id]; return next; });
    }
  };

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
        description={`${visible.length} receipt${visible.length !== 1 ? "s" : ""} · ${totalReceived.toLocaleString("en-IN")} units received`}
        actions={<Button onClick={openCreate}><Plus className="mr-1.5 h-4 w-4" />Record Receiving</Button>}
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-8 w-60 pl-8 text-xs"
            placeholder="SKU, party, batch, invoice, PO…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <Select value={party} onValueChange={setParty}>
          <SelectTrigger className="h-8 w-52 text-xs"><SelectValue placeholder="All parties" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All parties</SelectItem>
            {parties.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All statuses</SelectItem>
            {FINAL_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>

        {(q || party !== "__all__" || status !== "__all__") && (
          <Button size="sm" variant="ghost" className="h-8 text-xs"
            onClick={() => { setQ(""); setParty("__all__"); setStatus("__all__"); }}>
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
            <p className="font-semibold">{rows.length ? "Nothing matches those filters" : "No receivings yet"}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Record each shipment as it lands at the warehouse — what came in, from whom, against which invoice.
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-[1700px] text-sm">
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
                <th className="px-3 py-2.5 text-left font-medium">COA</th>
                <th className="px-3 py-2.5 text-left font-medium">GRN</th>
                <th className="px-3 py-2.5 text-left font-medium">Invoice Status</th>
                <th className="px-3 py-2.5 text-left font-medium">QC</th>
                <th className="px-3 py-2.5 text-left font-medium">Final Status</th>
                <th className="px-3 py-2.5 text-left font-medium">Comments</th>
                <th className="px-3 py-2.5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {visible.map((r) => {
                // Both numbers are kept so a short delivery is visible; say so.
                const short = r.invoiceQty && r.receivedQty
                  && Number(r.receivedQty) < Number(r.invoiceQty);
                return (
                  <tr key={r.id} className="align-top">
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
                      <td key={key} className="px-3 py-2">
                        <StatusCell field={key} value={r[key]} onChange={(v) => changeStatus(r, key, v)} />
                      </td>
                    ))}
                    <td className="px-3 py-2.5 max-w-[14rem] whitespace-pre-wrap text-xs text-muted-foreground">
                      {r.comments || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-0.5">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(r)}>
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          onClick={() => remove(r)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
                    {COA_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>GRN Status</Label>
                <Select value={form.grnStatus} onValueChange={set("grnStatus")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GRN_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Invoice Status</Label>
                <Select value={form.invoiceStatus} onValueChange={set("invoiceStatus")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {INVOICE_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>QC</Label>
                <Select value={form.qc} onValueChange={set("qc")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {QC_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Final Status</Label>
                <Select value={form.finalStatus} onValueChange={set("finalStatus")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FINAL_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
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
