import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Download } from "lucide-react";
import { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/reimburse/")({
  component: ReimbursePage,
  head: () => ({ meta: [{ title: "Reimburse — Zoobalo" }] }),
});

const HEADER_KEY = "reimburse_header";
const ROWS_KEY   = "reimburse_rows";
const SIGS_KEY   = "reimburse_sigs";

const EMPTY_HEADER = {
  name: "", designation: "", department: "", period: "", date: "", financialYear: "",
};
const EMPTY_SIGS = { preparedBy: "", approvedBy: "" };

type Row = { id: string; billDate: string; expenseHead: string; claimAmount: string };
const newRow = (): Row => ({ id: crypto.randomUUID(), billDate: "", expenseHead: "", claimAmount: "" });

function ReimbursePage() {
  const [header, setHeader] = useState(EMPTY_HEADER);
  const [rows,   setRows]   = useState<Row[]>([newRow()]);
  const [sigs,   setSigs]   = useState(EMPTY_SIGS);
  const [ready,  setReady]  = useState(false);

  // Load from localStorage once on mount
  useEffect(() => {
    try {
      const h = localStorage.getItem(HEADER_KEY);
      const r = localStorage.getItem(ROWS_KEY);
      const s = localStorage.getItem(SIGS_KEY);
      if (h) setHeader(JSON.parse(h));
      if (r) { const p = JSON.parse(r); if (Array.isArray(p) && p.length) setRows(p); }
      if (s) setSigs(JSON.parse(s));
    } catch {}
    setReady(true);
  }, []);

  // Persist on every change (after load)
  useEffect(() => { if (ready) localStorage.setItem(HEADER_KEY, JSON.stringify(header)); }, [header, ready]);
  useEffect(() => { if (ready) localStorage.setItem(ROWS_KEY,   JSON.stringify(rows));   }, [rows,   ready]);
  useEffect(() => { if (ready) localStorage.setItem(SIGS_KEY,   JSON.stringify(sigs));   }, [sigs,   ready]);

  const setH = (f: keyof typeof EMPTY_HEADER) =>
    (e: React.ChangeEvent<HTMLInputElement>) => setHeader(p => ({ ...p, [f]: e.target.value }));

  const setR = (id: string, f: keyof Omit<Row, "id">) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setRows(rs => rs.map(r => r.id === id ? { ...r, [f]: e.target.value } : r));

  const addRow    = () => setRows(rs => [...rs, newRow()]);
  const removeRow = (id: string) => setRows(rs => rs.filter(r => r.id !== id));

  const clearRows = () => {
    if (!confirm("Clear all expense rows? Header and signature fields will be kept.")) return;
    setRows([newRow()]);
  };

  const total = rows.reduce((s, r) => s + (parseFloat(r.claimAmount) || 0), 0);
  const fmt   = (n: number) =>
    n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const exportExcel = () => {
    const aoa: (string | number)[][] = [];

    aoa.push(["REIMBURSEMENT CLAIM FORM"]);
    aoa.push([]);
    aoa.push(["Name",       header.name,       "Designation",    header.designation]);
    aoa.push(["Department", header.department,  "Period",         header.period]);
    aoa.push(["Date",       header.date,        "Financial Year", header.financialYear]);
    aoa.push([]);
    aoa.push(["Sr. No", "Bill Date", "Expense Head", "Claim Amount (Rs.)", "Approved Amount (Rs.)"]);

    rows.forEach((r, i) => {
      aoa.push([i + 1, r.billDate, r.expenseHead, parseFloat(r.claimAmount) || 0, ""]);
    });

    aoa.push([]);
    aoa.push(["", "", "Total", total, ""]);
    aoa.push([]);
    aoa.push(["Prepared By", sigs.preparedBy, "", "Approved By", sigs.approvedBy]);

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [{ wch: 10 }, { wch: 14 }, { wch: 36 }, { wch: 22 }, { wch: 22 }];
    ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reimbursement");
    XLSX.writeFile(wb, `reimbursement-${header.name || "claim"}-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Excel exported successfully.");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reimbursement"
        description="Fill expense entries day by day and export when ready to submit"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={clearRows}>Clear Rows</Button>
            <Button onClick={exportExcel} disabled={rows.every(r => !r.expenseHead && !r.claimAmount)}>
              <Download className="mr-1.5 h-4 w-4" />Export Excel
            </Button>
          </div>
        }
      />

      {/* ── Employee Details ────────────────────────────────────────────── */}
      <div className="rounded-xl border bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <h2 className="text-sm font-semibold">Employee Details</h2>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary font-medium">auto-saved</span>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input placeholder="Employee name" value={header.name} onChange={setH("name")} />
          </div>
          <div className="space-y-1.5">
            <Label>Designation</Label>
            <Input placeholder="e.g. Manager" value={header.designation} onChange={setH("designation")} />
          </div>
          <div className="space-y-1.5">
            <Label>Department</Label>
            <Input placeholder="e.g. Operations" value={header.department} onChange={setH("department")} />
          </div>
          <div className="space-y-1.5">
            <Label>Period</Label>
            <Input placeholder="e.g. Apr – Jun 2026" value={header.period} onChange={setH("period")} />
          </div>
          <div className="space-y-1.5">
            <Label>Date</Label>
            <Input type="date" value={header.date} onChange={setH("date")} />
          </div>
          <div className="space-y-1.5">
            <Label>Financial Year</Label>
            <Input placeholder="e.g. 2026-27" value={header.financialYear} onChange={setH("financialYear")} />
          </div>
        </div>
      </div>

      {/* ── Expense Table ───────────────────────────────────────────────── */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b">
          <h2 className="text-sm font-semibold">Expense Entries</h2>
          <Button size="sm" onClick={addRow}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />Add Row
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-xs text-muted-foreground uppercase tracking-wide">
                <th className="px-4 py-3 text-left w-14">Sr. No</th>
                <th className="px-4 py-3 text-left w-36">Bill Date</th>
                <th className="px-4 py-3 text-left">Expense Head</th>
                <th className="px-4 py-3 text-right w-44">Claim Amount (₹)</th>
                <th className="px-4 py-3 text-right w-48">
                  Approved Amount (₹)
                  <span className="ml-1 normal-case text-[10px]">(HR)</span>
                </th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row, i) => (
                <tr key={row.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-2.5 text-muted-foreground tabular-nums text-xs">{i + 1}</td>
                  <td className="px-4 py-2.5">
                    <Input
                      type="date"
                      className="h-8 text-xs"
                      value={row.billDate}
                      onChange={setR(row.id, "billDate")}
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <Input
                      className="h-8 text-xs"
                      placeholder="e.g. Travel, Meals, Stationery…"
                      value={row.expenseHead}
                      onChange={setR(row.id, "expenseHead")}
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      className="h-8 text-xs text-right"
                      placeholder="0.00"
                      value={row.claimAmount}
                      onChange={setR(row.id, "claimAmount")}
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="h-8 flex items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground/60 tracking-wide">
                      To be filled by HR
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => removeRow(row.id)}
                      disabled={rows.length === 1}
                      className="text-muted-foreground hover:text-destructive disabled:opacity-20 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-muted/40 border-t-2 border-border">
                <td colSpan={3} className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Total
                </td>
                <td className="px-4 py-3 text-right font-bold tabular-nums">
                  ₹{fmt(total)}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ── Signatures ──────────────────────────────────────────────────── */}
      <div className="rounded-xl border bg-card p-5">
        <h2 className="text-sm font-semibold mb-4">Signatures</h2>
        <div className="grid grid-cols-2 gap-8 max-w-sm">
          <div className="space-y-1.5">
            <Label>Prepared By</Label>
            <Input
              placeholder="Name"
              value={sigs.preparedBy}
              onChange={(e) => setSigs(p => ({ ...p, preparedBy: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Approved By</Label>
            <Input
              placeholder="Name"
              value={sigs.approvedBy}
              onChange={(e) => setSigs(p => ({ ...p, approvedBy: e.target.value }))}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
