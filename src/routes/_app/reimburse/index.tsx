import { createFileRoute } from "@tanstack/react-router";
import type ExcelJS from "exceljs";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Download } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/reimburse/")({
  component: ReimbursePage,
  head: () => ({ meta: [{ title: "Reimburse — Zoobalo" }] }),
});

const HEADER_KEY = "reimburse_header";
const ROWS_KEY   = "reimburse_rows";
const SIGS_KEY   = "reimburse_sigs";

const EMPTY_HEADER = {
  company: "", name: "", designation: "", department: "",
  period: "", date: "", financialYear: "",
};
const EMPTY_SIGS = { preparedBy: "", approvedBy: "" };

type Row = { id: string; billDate: string; expenseHead: string; claimAmount: string };
const newRow = (): Row => ({ id: crypto.randomUUID(), billDate: "", expenseHead: "", claimAmount: "" });

// ── Colors (ARGB without #) ──────────────────────────────────────────────────
const C_TEAL       = "FF2E7D82";
const C_BLUE       = "FF1F5B97";
const C_WHITE      = "FFFFFFFF";
const C_LIGHT_GRAY = "FFF5F5F5";
const C_BLACK      = "FF000000";

function ReimbursePage() {
  const [header, setHeader] = useState(EMPTY_HEADER);
  const [rows,   setRows]   = useState<Row[]>([newRow()]);
  const [sigs,   setSigs]   = useState(EMPTY_SIGS);
  const [ready,  setReady]  = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    try {
      const h = localStorage.getItem(HEADER_KEY);
      const r = localStorage.getItem(ROWS_KEY);
      const s = localStorage.getItem(SIGS_KEY);
      if (h) setHeader(prev => ({ ...EMPTY_HEADER, ...JSON.parse(h) }));
      if (r) { const p = JSON.parse(r); if (Array.isArray(p) && p.length) setRows(p); }
      if (s) setSigs(JSON.parse(s));
    } catch {}
    setReady(true);
  }, []);

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
  const fmt   = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const exportExcel = async () => {
    setExporting(true);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const wb    = new ExcelJS.Workbook();
      const sheet = wb.addWorksheet("Reimbursement");

      // ── Column widths ────────────────────────────────────────────────
      sheet.columns = [
        { width: 8  },  // A: Sr. No
        { width: 14 },  // B: Bill Date
        { width: 42 },  // C: Expenses Head
        { width: 18 },  // D: Claim Amount
        { width: 22 },  // E: Approved Amount
      ];

      const thinBorder = (color = "FFD0D0D0"): Partial<ExcelJS.Border> => ({ style: "thin", color: { argb: color } });
      const allBorders = (color?: string) => ({
        top: thinBorder(color), left: thinBorder(color),
        bottom: thinBorder(color), right: thinBorder(color),
      });

      // ── Row 1: Company name ──────────────────────────────────────────
      sheet.mergeCells("A1:E1");
      const companyCell = sheet.getCell("A1");
      companyCell.value     = header.company || "Company Name";
      companyCell.font      = { name: "Calibri", size: 18, bold: true, color: { argb: C_BLUE } };
      companyCell.alignment = { horizontal: "center", vertical: "middle" };
      sheet.getRow(1).height = 36;

      // ── Row 2: Form title bar ────────────────────────────────────────
      sheet.mergeCells("A2:E2");
      const titleCell    = sheet.getCell("A2");
      titleCell.value     = "Claims Reimbursement Form";
      titleCell.font      = { name: "Calibri", size: 12, bold: true, color: { argb: C_WHITE } };
      titleCell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: C_TEAL } };
      titleCell.alignment = { horizontal: "center", vertical: "middle" };
      sheet.getRow(2).height = 26;

      // ── Row 3: spacer ────────────────────────────────────────────────
      sheet.getRow(3).height = 10;

      // ── Rows 4–7: Employee info left + date table right ──────────────
      const infoData = [
        { label: "Name",        value: header.name,          rLabel: "Date",           rValue: header.date },
        { label: "Designation", value: header.designation,   rLabel: "Financial Year", rValue: header.financialYear },
        { label: "Department",  value: header.department,    rLabel: "Approval Date",  rValue: "" },
        { label: "Period",      value: header.period,        rLabel: "",               rValue: "" },
      ];

      infoData.forEach(({ label, value, rLabel, rValue }, i) => {
        const rn  = 4 + i;
        const row = sheet.getRow(rn);
        row.height = 18;

        // Left label
        const lc = sheet.getCell(`A${rn}`);
        lc.value = `${label}:`;
        lc.font  = { name: "Calibri", size: 10, bold: true };

        // Left value (B:C merged)
        sheet.mergeCells(`B${rn}:C${rn}`);
        const vc = sheet.getCell(`B${rn}`);
        vc.value = value;
        vc.font  = { name: "Calibri", size: 10, bold: label === "Name" };

        // Right label + value (bordered table cells)
        if (rLabel) {
          const dc = sheet.getCell(`D${rn}`);
          dc.value     = rLabel;
          dc.font      = { name: "Calibri", size: 10, bold: true };
          dc.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: C_LIGHT_GRAY } };
          dc.border    = allBorders();
          dc.alignment = { horizontal: "left", indent: 1 };

          const ec = sheet.getCell(`E${rn}`);
          ec.value     = rValue;
          ec.font      = { name: "Calibri", size: 10 };
          ec.border    = allBorders();
          ec.alignment = { horizontal: "center", vertical: "middle" };
        }
      });

      // ── Row 8: spacer ────────────────────────────────────────────────
      sheet.getRow(8).height = 10;

      // ── Row 9: Table headers ─────────────────────────────────────────
      const HEADERS = ["Sr. No", "Bill Date", "Expenses Head", "Claim Amount", "Approved Amount\n(to be filled by HR)"];
      const hRow = sheet.getRow(9);
      hRow.height = 32;
      HEADERS.forEach((h, i) => {
        const cell     = hRow.getCell(i + 1);
        cell.value     = h;
        cell.font      = { name: "Calibri", size: 10, bold: true, color: { argb: C_WHITE } };
        cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: C_TEAL } };
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        cell.border    = allBorders(C_WHITE);
      });

      // ── Rows 10+: Data rows ──────────────────────────────────────────
      rows.forEach((r, i) => {
        const rn      = 10 + i;
        const dataRow = sheet.getRow(rn);
        dataRow.height = 18;

        const vals = [i + 1, r.billDate, r.expenseHead, parseFloat(r.claimAmount) || "", ""] as const;
        const aligns: ExcelJS.Alignment["horizontal"][] = ["center", "center", "left", "right", "center"];

        vals.forEach((val, j) => {
          const cell     = dataRow.getCell(j + 1);
          cell.value     = val as ExcelJS.CellValue;
          cell.font      = { name: "Calibri", size: 10, color: { argb: C_BLACK } };
          cell.alignment = { horizontal: aligns[j], vertical: "middle" };
          cell.border    = allBorders();
          if (i % 2 === 1) {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF9FAFB" } };
          }
        });
      });

      // ── Total row ────────────────────────────────────────────────────
      const totalRn = 10 + rows.length + 1;
      sheet.getRow(totalRn).height = 20;

      const totalLabel = sheet.getCell(`C${totalRn}`);
      totalLabel.value     = "Total";
      totalLabel.font      = { name: "Calibri", size: 10, bold: true };
      totalLabel.alignment = { horizontal: "right" };

      const totalVal = sheet.getCell(`D${totalRn}`);
      totalVal.value     = total;
      totalVal.font      = { name: "Calibri", size: 11, bold: true, color: { argb: C_BLUE } };
      totalVal.alignment = { horizontal: "right" };
      totalVal.border    = {
        top:    { style: "double", color: { argb: C_TEAL } },
        bottom: { style: "double", color: { argb: C_TEAL } },
        left:   thinBorder(), right: thinBorder(),
      };

      // ── Signatures ───────────────────────────────────────────────────
      const sigRn = totalRn + 3;
      sheet.getRow(sigRn).height = 18;
      [
        { col: "A", label: "Prepared By" }, { col: "B", val: sigs.preparedBy },
        { col: "D", label: "Approved By" }, { col: "E", val: sigs.approvedBy },
      ].forEach(({ col, label, val }) => {
        const cell  = sheet.getCell(`${col}${sigRn}`);
        cell.value  = label ?? val ?? "";
        cell.font   = { name: "Calibri", size: 10, bold: !!label };
      });

      // ── Download ─────────────────────────────────────────────────────
      const buffer = await wb.xlsx.writeBuffer();
      const blob   = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a   = document.createElement("a");
      a.href     = url;
      a.download = `reimbursement-${header.name || "claim"}-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Excel exported successfully.");
    } catch (err) {
      console.error(err);
      toast.error("Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reimbursement"
        description="Fill expense entries day by day and export when ready to submit"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={clearRows}>Clear Rows</Button>
            <Button onClick={exportExcel} disabled={exporting || rows.every(r => !r.expenseHead && !r.claimAmount)}>
              <Download className="mr-1.5 h-4 w-4" />
              {exporting ? "Exporting…" : "Export Excel"}
            </Button>
          </div>
        }
      />

      {/* ── Employee Details ─────────────────────────────────────────── */}
      <div className="rounded-xl border bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <h2 className="text-sm font-semibold">Employee Details</h2>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary font-medium">auto-saved</span>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5 sm:col-span-3">
            <Label>Company Name</Label>
            <Input placeholder="e.g. Derma Goodness Private Limited" value={header.company} onChange={setH("company")} />
          </div>
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input placeholder="Employee name" value={header.name} onChange={setH("name")} />
          </div>
          <div className="space-y-1.5">
            <Label>Designation</Label>
            <Input placeholder="e.g. Asst. Manager" value={header.designation} onChange={setH("designation")} />
          </div>
          <div className="space-y-1.5">
            <Label>Department</Label>
            <Input placeholder="e.g. Procurement & Operations" value={header.department} onChange={setH("department")} />
          </div>
          <div className="space-y-1.5">
            <Label>Period</Label>
            <Input placeholder="e.g. May – April 2026" value={header.period} onChange={setH("period")} />
          </div>
          <div className="space-y-1.5">
            <Label>Date</Label>
            <Input type="date" value={header.date} onChange={setH("date")} />
          </div>
          <div className="space-y-1.5">
            <Label>Financial Year</Label>
            <Input placeholder="e.g. 2025-26" value={header.financialYear} onChange={setH("financialYear")} />
          </div>
        </div>
      </div>

      {/* ── Expense Table ─────────────────────────────────────────────── */}
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
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row, i) => (
                <tr key={row.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-2.5 text-muted-foreground tabular-nums text-xs">{i + 1}</td>
                  <td className="px-4 py-2.5">
                    <Input type="date" className="h-8 text-xs" value={row.billDate} onChange={setR(row.id, "billDate")} />
                  </td>
                  <td className="px-4 py-2.5">
                    <Input className="h-8 text-xs" placeholder="e.g. Travel, Meals, Hotel…" value={row.expenseHead} onChange={setR(row.id, "expenseHead")} />
                  </td>
                  <td className="px-4 py-2.5">
                    <Input type="number" step="0.01" min="0" className="h-8 text-xs text-right" placeholder="0.00" value={row.claimAmount} onChange={setR(row.id, "claimAmount")} />
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="h-8 flex items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground/60 tracking-wide">
                      To be filled by HR
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <button type="button" onClick={() => removeRow(row.id)} disabled={rows.length === 1}
                      className="text-muted-foreground hover:text-destructive disabled:opacity-20 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-muted/40 border-t-2 border-border">
                <td colSpan={3} className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total</td>
                <td className="px-4 py-3 text-right font-bold tabular-nums">₹{fmt(total)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ── Signatures ────────────────────────────────────────────────── */}
      <div className="rounded-xl border bg-card p-5">
        <h2 className="text-sm font-semibold mb-4">Signatures</h2>
        <div className="grid grid-cols-2 gap-8 max-w-sm">
          <div className="space-y-1.5">
            <Label>Prepared By</Label>
            <Input placeholder="Name" value={sigs.preparedBy} onChange={(e) => setSigs(p => ({ ...p, preparedBy: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Approved By</Label>
            <Input placeholder="Name" value={sigs.approvedBy} onChange={(e) => setSigs(p => ({ ...p, approvedBy: e.target.value }))} />
          </div>
        </div>
      </div>
    </div>
  );
}
