import { createFileRoute } from "@tanstack/react-router";
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

function ReimbursePage() {
  const [header,    setHeader]    = useState(EMPTY_HEADER);
  const [rows,      setRows]      = useState<Row[]>([newRow()]);
  const [sigs,      setSigs]      = useState(EMPTY_SIGS);
  const [ready,     setReady]     = useState(false);
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

  const exportWord = async () => {
    setExporting(true);
    try {
      const {
        Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        WidthType, AlignmentType, ShadingType, HeightRule,
        convertMillimetersToTwip, VerticalAlign, BorderStyle, PageOrientation,
      } = await import("docx");

      const mm = convertMillimetersToTwip;

      // ── Colors ────────────────────────────────────────────────────────
      const TEAL  = "2D7FA5";   // steel teal — title bar & table headers
      const BLUE  = "1C3E72";   // dark navy — company name
      const LG    = "EBEBEB";   // light gray — date/FY label cells
      const WHITE = "FFFFFF";
      const BLACK = "000000";

      // ── Border helpers ────────────────────────────────────────────────
      const none = () => ({ style: BorderStyle.NONE,   size: 0, color: "auto" });
      const thin = (c = "BBBBBB") => ({ style: BorderStyle.SINGLE, size: 4, color: c });
      const noBorders  = () => ({ top: none(), bottom: none(), left: none(), right: none() });
      const allThin    = (c = "BBBBBB") => ({ top: thin(c), bottom: thin(c), left: thin(c), right: thin(c) });
      const whiteBrd   = () => ({ top: thin(WHITE), bottom: thin(WHITE), left: thin(WHITE), right: thin(WHITE) });

      const shade = (fill: string) => ({ type: ShadingType.CLEAR, fill, color: "auto" });

      const run = (text: string, opts: { bold?: boolean; size?: number; color?: string; break?: number } = {}) =>
        new TextRun({ text, bold: opts.bold, size: opts.size ?? 22, color: opts.color ?? BLACK, font: "Calibri", break: opts.break });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cellPara = (children: any[], align: any = AlignmentType.LEFT) =>
        new Paragraph({ alignment: align, spacing: { before: 50, after: 50 }, children });

      // ── Column widths (content = 210 - 20 - 20 = 170mm) ──────────────
      // Sr.No(12) + Date(27) + Head(71) + Claim(30) + Approved(30) = 170mm
      const CW = [mm(12), mm(27), mm(71), mm(30), mm(30)];

      // ── Company name ──────────────────────────────────────────────────
      const companyPara = new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 100 },
        children: [run(header.company || "Company Name", { bold: true, size: 48, color: BLUE })],
      });

      // ── "Claims Reimbursement Form" teal bar ──────────────────────────
      const titleBar = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [new TableRow({
          height: { value: mm(9), rule: HeightRule.EXACT },
          children: [new TableCell({
            shading: shade(TEAL),
            borders: whiteBrd(),
            verticalAlign: VerticalAlign.CENTER,
            children: [cellPara([run("Claims Reimbursement Form", { bold: true, size: 28, color: WHITE })], AlignmentType.CENTER)],
          })],
        })],
      });

      // ── Employee info + date table (side by side) ─────────────────────
      const W_LBL = mm(33); const W_VAL = mm(75);
      const W_GAP = mm(10); const W_RLBL = mm(34); const W_RVAL = mm(18);

      const infoCell = (text: string, w: number, opts: { bold?: boolean; bg?: string; bordered?: boolean; align?: typeof AlignmentType[keyof typeof AlignmentType] } = {}) =>
        new TableCell({
          width: { size: w, type: WidthType.DXA },
          shading: opts.bg ? shade(opts.bg) : undefined,
          borders: opts.bordered ? allThin() : noBorders(),
          verticalAlign: VerticalAlign.CENTER,
          children: [cellPara([run(text, { bold: opts.bold, size: 20 })], opts.align ?? AlignmentType.LEFT)],
        });

      const infoData = [
        ["Name",        header.name,        "Date",           header.date         ],
        ["Designation", header.designation, "Financial Year", header.financialYear ],
        ["Department",  header.department,  "Approval Date",  ""                  ],
        ["Period",      header.period,      "",               ""                  ],
      ];

      const infoTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: infoData.map(([lbl, val, rlbl, rval]) =>
          new TableRow({
            height: { value: mm(6.5), rule: HeightRule.ATLEAST },
            children: [
              infoCell(`${lbl}:`, W_LBL, { bold: true }),
              infoCell(val, W_VAL, { bold: lbl === "Name" }),
              infoCell("", W_GAP),
              rlbl ? infoCell(rlbl, W_RLBL, { bold: true, bg: LG, bordered: true }) : infoCell("", W_RLBL),
              rlbl ? infoCell(rval, W_RVAL, { bordered: true, align: AlignmentType.CENTER }) : infoCell("", W_RVAL),
            ],
          })
        ),
      });

      // ── Expense table ─────────────────────────────────────────────────
      const hdrCell = (lines: string[], w: number) =>
        new TableCell({
          width: { size: w, type: WidthType.DXA },
          shading: shade(TEAL),
          borders: whiteBrd(),
          verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 60, after: 60 },
            children: lines.map((t, i) => run(t, { bold: true, size: 20, color: WHITE, break: i > 0 ? 1 : undefined })),
          })],
        });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dataCell = (text: string, w: number, align: any = AlignmentType.LEFT, bold = false) =>
        new TableCell({
          width: { size: w, type: WidthType.DXA },
          borders: allThin(),
          verticalAlign: VerticalAlign.CENTER,
          children: [cellPara([run(text, { bold, size: 20 })], align)],
        });

      const fmtAmt = (val: string) =>
        val && parseFloat(val) ? `₹${parseFloat(val).toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "";

      const expenseTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          // Header row
          new TableRow({
            height: { value: mm(11), rule: HeightRule.ATLEAST },
            tableHeader: true,
            children: [
              hdrCell(["Sr. No"],               CW[0]),
              hdrCell(["Bill Date"],             CW[1]),
              hdrCell(["Expenses Head"],          CW[2]),
              hdrCell(["Claim Amount"],           CW[3]),
              hdrCell(["Approved Amount", "(to be filled by HR)"], CW[4]),
            ],
          }),
          // Data rows
          ...rows.map((r, i) => new TableRow({
            height: { value: mm(7), rule: HeightRule.ATLEAST },
            children: [
              dataCell(String(i + 1), CW[0], AlignmentType.CENTER),
              dataCell(r.billDate,    CW[1], AlignmentType.CENTER),
              dataCell(r.expenseHead, CW[2]),
              dataCell(fmtAmt(r.claimAmount), CW[3], AlignmentType.RIGHT),
              dataCell("", CW[4]),
            ],
          })),
          // Total row
          new TableRow({
            height: { value: mm(8), rule: HeightRule.ATLEAST },
            children: [
              dataCell("", CW[0]),
              dataCell("", CW[1]),
              dataCell("Total", CW[2], AlignmentType.RIGHT, true),
              dataCell(`₹${fmt(total)}`, CW[3], AlignmentType.RIGHT, true),
              dataCell("", CW[4]),
            ],
          }),
        ],
      });

      // ── Signatures ────────────────────────────────────────────────────
      const sigTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [new TableRow({
          height: { value: mm(20), rule: HeightRule.ATLEAST },
          children: [
            infoCell("Prepared By:", mm(33), { bold: true }),
            infoCell(sigs.preparedBy, mm(50)),
            infoCell("", mm(20)),
            infoCell("Approved By:", mm(33), { bold: true }),
            infoCell(sigs.approvedBy, mm(34)),
          ],
        })],
      });

      const spacer = () => new Paragraph({ spacing: { before: 0, after: 100 }, children: [] });

      // ── Assemble document ─────────────────────────────────────────────
      const doc = new Document({
        sections: [{
          properties: {
            page: {
              size: {
                width:  mm(210),
                height: mm(297),
                orientation: PageOrientation.PORTRAIT,
              },
              margin: { top: mm(20), right: mm(20), bottom: mm(20), left: mm(20) },
            },
          },
          children: [
            companyPara,
            titleBar,
            spacer(),
            infoTable,
            spacer(),
            expenseTable,
            spacer(),
            sigTable,
          ],
        }],
      });

      const blob = await Packer.toBlob(doc);
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `reimbursement-${header.name || "claim"}-${new Date().toISOString().slice(0, 10)}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Word document exported successfully.");
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
        description="Fill expense entries day by day and export as a Word document when ready to submit"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={clearRows}>Clear Rows</Button>
            <Button onClick={exportWord} disabled={exporting || rows.every(r => !r.expenseHead && !r.claimAmount)}>
              <Download className="mr-1.5 h-4 w-4" />
              {exporting ? "Exporting…" : "Export Word"}
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
          <div className="space-y-1.5 col-span-2 sm:col-span-3">
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
                <th className="px-4 py-3 text-right w-48">Approved Amount (₹) <span className="normal-case text-[10px]">(HR)</span></th>
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
                    <div className="h-8 flex items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground/60">
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
              <tr className="bg-muted/40 border-t-2">
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
