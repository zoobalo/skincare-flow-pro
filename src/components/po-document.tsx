import { fmtDate } from "@/lib/utils";
import type { POLineItem } from "@/lib/api";

// ── Company constants ─────────────────────────────────────────────────────────
export const CO = {
  name:          "DERMA GOODNESS PRIVATE LIMITED",
  address:       "15-Ambika Nagar, Sector-5, HiranMagri, Udaipur - 313002, Rajasthan, India",
  phone:         "+91-8905225598",
  email:         "contact@skininspired.in",
  gst:           "08AAJCD1460F1ZU",
  pan:           "AAJCD1460F",
  branch:        "001 Skininspired HQ",
  division:      "SkinInspired",
  contactPerson: "Siddharth Kumawat",
  contactEmail:  "purchase@skininspired.in",
  contactPhone:  "87697 63302",
  deliveryAt:    "Influx Healthtech Ltd.",
};

// ── Indian number → words ─────────────────────────────────────────────────────
const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function numToWords(n: number): string {
  if (n === 0) return "Zero";
  let s = "";
  if (n >= 10_000_000) { s += numToWords(Math.floor(n / 10_000_000)) + " Crore "; n %= 10_000_000; }
  if (n >= 100_000)    { s += numToWords(Math.floor(n / 100_000))    + " Lakh ";  n %= 100_000; }
  if (n >= 1_000)      { s += numToWords(Math.floor(n / 1_000))      + " Thousand "; n %= 1_000; }
  if (n >= 100)        { s += ONES[Math.floor(n / 100)] + " Hundred "; n %= 100; }
  if (n >= 20)         { s += TENS[Math.floor(n / 10)] + " "; n %= 10; }
  if (n > 0)           s += ONES[n] + " ";
  return s.trim();
}

export function amountToWords(amount: number): string {
  const rupees = Math.floor(amount);
  const paise  = Math.round((amount - rupees) * 100);
  let s = "Rupees " + numToWords(rupees);
  if (paise > 0) s += " and " + numToWords(paise) + " Paise";
  return s + " Only";
}

// ── Shared cell styles ────────────────────────────────────────────────────────
const base: React.CSSProperties = {
  padding: "6px 8px",
  borderBottom: "1px solid #e5e7eb",
  borderRight: "1px solid #e5e7eb",
  verticalAlign: "top",
};
const tdL: React.CSSProperties = { ...base, textAlign: "left" };
const tdR: React.CSSProperties = { ...base, textAlign: "right" };
const tdC: React.CSSProperties = { ...base, textAlign: "center" };

// ── Props ─────────────────────────────────────────────────────────────────────
export type PODocumentProps = {
  poNumber: string;
  poDate: string;
  materialType: string;
  // Legacy single-item fields (used when items is absent)
  quantity: number;
  rate: number;
  gstRate: number;
  gstAmount: number;
  total: number;
  category?: string | null;
  // Multi-item support
  items?: POLineItem[] | null;
  deliveryAt?: string | null;
  notes?: string | null;
  terms?: string | null;
  vendor?: {
    name?: string; address?: string; city?: string; gst?: string; pan?: string | null;
    contactPerson?: string; mobile?: string; email?: string;
  } | null;
  sku?: { code?: string; name?: string } | null;
};

// ── React component ───────────────────────────────────────────────────────────
export function PODocument(props: PODocumentProps) {
  const { poNumber, poDate, materialType, quantity, rate, gstRate, gstAmount, total, category, items, deliveryAt, notes, terms, vendor, sku } = props;

  const fmt = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Use items array if present, otherwise fall back to single legacy row
  const rows: POLineItem[] = items && items.length > 0
    ? items
    : [{ description: materialType, quantity, rate, gstRate, subtotal: quantity * rate, gstAmount, total }];

  const totSubtotal  = rows.reduce((s, r) => s + r.subtotal, 0);
  const totGstAmount = rows.reduce((s, r) => s + r.gstAmount, 0);
  const totTotal     = rows.reduce((s, r) => s + r.total, 0);

  // Fill blank rows so the table always shows at least 5 data rows
  const blankCount = Math.max(0, 5 - rows.length);

  const orderRows: [string, string][] = [
    ["Branch Name",       CO.branch],
    ["Division Name",     CO.division],
    ["Category",          category || "PM"],
    ["Purchase Order No", poNumber],
    ["Date",              fmtDate(poDate)],
    ["Contact Person",    CO.contactPerson],
    ["Email",             CO.contactEmail],
    ["Contact No.",       CO.contactPhone],
    ["Delivery At",       deliveryAt || CO.deliveryAt],
  ];

  const partyRows: [string, string | undefined][] = [
    ["Vendor Name",    vendor?.name],
    ["Address",        vendor?.address],
    ["City",           vendor?.city],
    ["GST No.",        vendor?.gst],
    ["PAN",            vendor?.pan ?? undefined],
    ["Contact Person", vendor?.contactPerson],
    ["Phone",          vendor?.mobile],
    ["Email",          vendor?.email],
  ];

  return (
    <div
      id="po-document"
      className="mx-auto w-full max-w-4xl rounded-xl border bg-white text-black shadow-sm overflow-x-auto"
      style={{ fontFamily: "Arial, sans-serif", fontSize: 13 }}
    >
      {/* Repeating print header — hidden on screen, fixed on every printed page */}
      <div id="po-print-header" className="hidden">
        <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: 1 }}>{CO.name}</div>
        <div style={{ fontSize: 11, color: "#555", marginTop: 4 }}>{CO.address}</div>
        <div style={{ fontSize: 11, color: "#555" }}>Phone No: {CO.phone} | email: {CO.email}</div>
        <div style={{ fontSize: 11, color: "#555" }}>GST No: {CO.gst} | PAN NO: {CO.pan}</div>
      </div>

      {/* Company header — hidden in print (fixed version above covers it) */}
      <div id="po-first-header" className="border-b px-8 py-5 text-center" style={{ pageBreakInside: "avoid", breakInside: "avoid" }}>
        <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: 1 }}>{CO.name}</div>
        <div style={{ fontSize: 11, color: "#555", marginTop: 4 }}>{CO.address}</div>
        <div style={{ fontSize: 11, color: "#555" }}>Phone No: {CO.phone} | email: {CO.email}</div>
        <div style={{ fontSize: 11, color: "#555" }}>GST No: {CO.gst} | PAN NO: {CO.pan}</div>
      </div>

      {/* Title */}
      <div className="border-b px-8 py-3 text-center" style={{ fontSize: 15, fontWeight: 600 }}>
        PURCHASE ORDER
      </div>

      {/* Two-column: Party (left) | Order details (right) */}
      <div className="grid grid-cols-2" style={{ borderBottom: "1px solid #e5e7eb", pageBreakInside: "avoid", breakInside: "avoid" }}>
        <div className="px-5 py-4" style={{ borderRight: "1px solid #e5e7eb" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Party Details</div>
          <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
            <tbody>
              {partyRows.filter(([, v]) => v).map(([label, value]) => (
                <tr key={label} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "3px 8px 3px 0", color: "#777", whiteSpace: "nowrap", verticalAlign: "top" }}>{label}</td>
                  <td style={{ padding: "3px 0", fontWeight: 500 }}>: {value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-4">
          <div style={{ fontSize: 10, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Order Details</div>
          <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
            <tbody>
              {orderRows.map(([label, value]) => (
                <tr key={label} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "3px 8px 3px 0", color: "#777", whiteSpace: "nowrap", verticalAlign: "top" }}>{label}</td>
                  <td style={{ padding: "3px 0", fontWeight: 500 }}>: {value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Particulars table */}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
        <thead>
          <tr style={{ background: "#f3f4f6" }}>
            {["Sr.", "Description of Goods", "HSN Code", "Qty", "Rate (₹)", "Basic Amt (₹)", "GST %", "GST Amt (₹)", "Total (₹)"].map((h, i) => (
              <th key={h} style={{ padding: "6px 8px", borderBottom: "1px solid #d1d5db", borderRight: i < 8 ? "1px solid #d1d5db" : undefined, textAlign: i === 0 ? "center" : i >= 3 ? "right" : "left", fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={idx} style={{ pageBreakInside: "avoid", breakInside: "avoid" }}>
              <td style={tdC}>{idx + 1}</td>
              <td style={tdL}>
                <div style={{ fontWeight: 500 }}>{row.description}</div>
              </td>
              <td style={tdC}>—</td>
              <td style={tdR}>{row.quantity.toLocaleString("en-IN")}</td>
              <td style={tdR}>{fmt(row.rate)}</td>
              <td style={tdR}>{fmt(row.subtotal)}</td>
              <td style={tdC}>{row.gstRate}%</td>
              <td style={tdR}>{fmt(row.gstAmount)}</td>
              <td style={{ ...tdR, borderRight: "none", fontWeight: 600 }}>{fmt(row.total)}</td>
            </tr>
          ))}
          {Array.from({ length: blankCount }, (_, i) => (
            <tr key={`blank-${i}`} style={{ pageBreakInside: "avoid", breakInside: "avoid" }}>
              {Array.from({ length: 9 }, (_, ci) => (
                <td key={ci} style={{ ...tdC, borderRight: ci < 8 ? "1px solid #e5e7eb" : "none", height: 28 }}></td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ background: "#f9fafb" }}>
            <td colSpan={5} style={{ ...tdR, fontWeight: 700, borderTop: "1px solid #d1d5db" }}>Total</td>
            <td style={{ ...tdR, fontWeight: 700, borderTop: "1px solid #d1d5db" }}>{fmt(totSubtotal)}</td>
            <td style={{ ...tdC, borderTop: "1px solid #d1d5db" }}></td>
            <td style={{ ...tdR, fontWeight: 700, borderTop: "1px solid #d1d5db" }}>{fmt(totGstAmount)}</td>
            <td style={{ ...tdR, fontWeight: 700, borderTop: "1px solid #d1d5db", borderRight: "none" }}>{fmt(totTotal)}</td>
          </tr>
        </tfoot>
      </table>

      {/* Amount in words */}
      <div style={{ borderTop: "1px solid #e5e7eb", padding: "8px 16px", fontSize: 11, pageBreakInside: "avoid", breakInside: "avoid" }}>
        <span style={{ color: "#777" }}>Amount in Words: </span>
        <span style={{ fontWeight: 600 }}>{amountToWords(totTotal)}</span>
      </div>

      {notes && (
        <div style={{ borderTop: "1px solid #e5e7eb", padding: "8px 16px", fontSize: 11, pageBreakInside: "avoid", breakInside: "avoid" }}>
          <span style={{ color: "#777" }}>Notes: </span><span>{notes}</span>
        </div>
      )}

      {terms && (
        <div style={{ borderTop: "1px solid #e5e7eb", padding: "12px 16px", fontSize: 11, pageBreakInside: "avoid", breakInside: "avoid" }}>
          <div style={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#555", fontSize: 10, marginBottom: 6 }}>
            Terms &amp; Conditions
          </div>
          <div style={{ whiteSpace: "pre-line", lineHeight: 1.6, color: "#444" }}>{terms}</div>
        </div>
      )}
    </div>
  );
}

// ── Standalone HTML generator for download/print ──────────────────────────────
export function buildPoHtml(props: PODocumentProps): string {
  const { poNumber, poDate, materialType, quantity, rate, gstRate, gstAmount, total, category, items, deliveryAt, notes, terms, vendor, sku } = props;
  const fmt = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const rows: POLineItem[] = items && items.length > 0
    ? items
    : [{ description: materialType, quantity, rate, gstRate, subtotal: quantity * rate, gstAmount, total }];

  const totSubtotal  = rows.reduce((s, r) => s + r.subtotal, 0);
  const totGstAmount = rows.reduce((s, r) => s + r.gstAmount, 0);
  const totTotal     = rows.reduce((s, r) => s + r.total, 0);
  const blankCount   = Math.max(0, 5 - rows.length);

  const orderRows: [string, string][] = [
    ["Branch Name",       CO.branch],
    ["Division Name",     CO.division],
    ["Category",          category || "PM"],
    ["Purchase Order No", poNumber],
    ["Date",              fmtDate(poDate)],
    ["Contact Person",    CO.contactPerson],
    ["Email",             CO.contactEmail],
    ["Contact No.",       CO.contactPhone],
    ["Delivery At",       deliveryAt || CO.deliveryAt],
  ];

  const partyRows: [string, string][] = ([
    ["Vendor Name",    vendor?.name],
    ["Address",        vendor?.address],
    ["City",           vendor?.city],
    ["GST No.",        vendor?.gst],
    ["PAN",            vendor?.pan ?? undefined],
    ["Contact Person", vendor?.contactPerson],
    ["Phone",          vendor?.mobile],
    ["Email",          vendor?.email],
  ] as [string, string | undefined][]).filter(([, v]) => v) as [string, string][];

  const rowStyle = `border-bottom:1px solid #f3f4f6`;
  const labelTd  = `padding:3px 8px 3px 0;color:#777;white-space:nowrap;vertical-align:top`;
  const valueTd  = `padding:3px 0;font-weight:500`;
  const cellB    = `padding:6px 8px;border-bottom:1px solid #e5e7eb;border-right:1px solid #e5e7eb;vertical-align:top`;

  const toPartyRows  = partyRows.map(([l, v]) => `<tr style="${rowStyle}"><td style="${labelTd}">${l}</td><td style="${valueTd}">: ${v}</td></tr>`).join("");
  const toOrderRows  = orderRows.map(([l, v]) => `<tr style="${rowStyle}"><td style="${labelTd}">${l}</td><td style="${valueTd}">: ${v}</td></tr>`).join("");

  const theadRow = ["Sr.", "Description of Goods", "HSN Code", "Qty", "Rate (₹)", "Basic Amt (₹)", "GST %", "GST Amt (₹)", "Total (₹)"].map((h, i) => {
    const s = `padding:6px 8px;border-bottom:1px solid #d1d5db;${i < 8 ? "border-right:1px solid #d1d5db;" : ""}font-weight:600;white-space:nowrap;text-align:${i === 0 ? "center" : i >= 3 ? "right" : "left"}`;
    return `<th style="${s}">${h}</th>`;
  }).join("");

  const dataRows = rows.map((row, idx) => {
    const skuDesc = `<div style="font-weight:500">${row.description}</div>`;
    return `<tr style="page-break-inside:avoid;break-inside:avoid">
      <td style="${cellB};text-align:center">${idx + 1}</td>
      <td style="${cellB}">${skuDesc}</td>
      <td style="${cellB};text-align:center">—</td>
      <td style="${cellB};text-align:right">${row.quantity.toLocaleString("en-IN")}</td>
      <td style="${cellB};text-align:right">${fmt(row.rate)}</td>
      <td style="${cellB};text-align:right">${fmt(row.subtotal)}</td>
      <td style="${cellB};text-align:center">${row.gstRate}%</td>
      <td style="${cellB};text-align:right">${fmt(row.gstAmount)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600">${fmt(row.total)}</td>
    </tr>`;
  }).join("");

  const blankRows = Array.from({ length: blankCount }, () =>
    `<tr>${Array.from({ length: 9 }, (_, i) => `<td style="${cellB}${i === 8 ? ";border-right:none" : ""};height:28px"></td>`).join("")}</tr>`
  ).join("");

  const termsHtml = terms ? `<div class="po-no-break" style="border-top:1px solid #e5e7eb;padding:12px 16px;font-size:11px"><div style="font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#555;font-size:10px;margin-bottom:6px">Terms &amp; Conditions</div><div style="white-space:pre-line;line-height:1.6;color:#444">${terms.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</div></div>` : "";
  const notesHtml = notes ? `<div class="po-no-break" style="border-top:1px solid #e5e7eb;padding:8px 16px;font-size:11px"><span style="color:#777">Notes: </span>${notes}</div>` : "";

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${poNumber}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:13px;color:#111;background:#fff;padding:10mm 12mm}@page{size:A4;margin:0}table{border-collapse:collapse}thead{display:table-header-group}tbody tr{page-break-inside:avoid;break-inside:avoid}.po-no-break{page-break-inside:avoid;break-inside:avoid}#po-print-header{display:none}@media print{body{padding-top:32mm}#po-print-header{display:block;position:fixed;top:0;left:0;right:0;background:white;padding:5mm 12mm 3mm;border-bottom:1px solid #e5e7eb;text-align:center;z-index:100}#po-first-header{display:none}}</style>
</head><body>
<div id="po-print-header">
  <div style="font-size:18px;font-weight:700;letter-spacing:1px">${CO.name}</div>
  <div style="font-size:11px;color:#555;margin-top:4px">${CO.address}</div>
  <div style="font-size:11px;color:#555">Phone No: ${CO.phone} | email: ${CO.email}</div>
  <div style="font-size:11px;color:#555">GST No: ${CO.gst} | PAN NO: ${CO.pan}</div>
</div>
<div style="max-width:900px;margin:0 auto;border:1px solid #e5e7eb">
  <div id="po-first-header" class="po-no-break" style="border-bottom:1px solid #e5e7eb;padding:20px 32px;text-align:center">
    <div style="font-size:18px;font-weight:700;letter-spacing:1px">${CO.name}</div>
    <div style="font-size:11px;color:#555;margin-top:4px">${CO.address}</div>
    <div style="font-size:11px;color:#555">Phone No: ${CO.phone} | email: ${CO.email}</div>
    <div style="font-size:11px;color:#555">GST No: ${CO.gst} | PAN NO: ${CO.pan}</div>
  </div>
  <div style="border-bottom:1px solid #e5e7eb;padding:10px 32px;text-align:center;font-size:15px;font-weight:600">PURCHASE ORDER</div>
  <div class="po-no-break" style="display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid #e5e7eb">
    <div style="padding:16px 20px;border-right:1px solid #e5e7eb">
      <div style="font-size:10px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">Party Details</div>
      <table style="width:100%;font-size:11px"><tbody>${toPartyRows}</tbody></table>
    </div>
    <div style="padding:16px 20px">
      <div style="font-size:10px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">Order Details</div>
      <table style="width:100%;font-size:11px"><tbody>${toOrderRows}</tbody></table>
    </div>
  </div>
  <table style="width:100%;font-size:11px">
    <thead><tr style="background:#f3f4f6">${theadRow}</tr></thead>
    <tbody>${dataRows}${blankRows}</tbody>
    <tfoot>
      <tr style="background:#f9fafb">
        <td colspan="5" style="${cellB};border-top:1px solid #d1d5db;text-align:right;font-weight:700">Total</td>
        <td style="${cellB};border-top:1px solid #d1d5db;text-align:right;font-weight:700">${fmt(totSubtotal)}</td>
        <td style="${cellB};border-top:1px solid #d1d5db"></td>
        <td style="${cellB};border-top:1px solid #d1d5db;text-align:right;font-weight:700">${fmt(totGstAmount)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;border-top:1px solid #d1d5db;text-align:right;font-weight:700">${fmt(totTotal)}</td>
      </tr>
    </tfoot>
  </table>
  <div class="po-no-break" style="border-top:1px solid #e5e7eb;padding:8px 16px;font-size:11px">
    <span style="color:#777">Amount in Words: </span>
    <span style="font-weight:600">${amountToWords(totTotal)}</span>
  </div>
  ${notesHtml}${termsHtml}
</div>
</body></html>`;
}
