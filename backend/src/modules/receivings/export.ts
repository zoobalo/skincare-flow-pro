import { db } from "../../db/client.ts";
import { receivings } from "../../db/schema/receivings.ts";
import { eq, asc } from "drizzle-orm";
import { callAppsScript, scriptUrlFromEnv } from "../../lib/apps-script.ts";

/**
 * Pushes receipts to the backup spreadsheet.
 *
 * The sheet is a copy kept outside the platform, so it must be able to take
 * the same export twice without doubling. Every row carries its record id in
 * the last column and the script appends only ids it has not seen — identity
 * the sheet can check for itself, rather than a count or a high-water mark
 * that a hand edit would quietly invalidate.
 */

const HEADER = [
  "SKU Name", "Party Name", "Batch No", "Received QTY", "Received date",
  "PO Number", "PO Date", "PO Quantity",
  "Invoice Number", "Invoice Date", "Invoice Quantity",
  "MFG date", "EXP Date", "MRP",
  "COA Status", "GRN Status", "Invoice Status", "QC", "Final Status",
  "Comments", "Record ID",
] as const;

/** The warehouse writes dates the Indian way; the sheet should match. */
const ddmmyyyy = (d: string | null) => {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return y && m && day ? `${day}-${m}-${y}` : d;
};

export async function exportReceivings(teamId: string) {
  const url = scriptUrlFromEnv("RECEIVINGS_SHEET_SCRIPT_URL", "receivings backup");

  const rows = await db.select().from(receivings)
    .where(eq(receivings.teamId, teamId))
    .orderBy(asc(receivings.receivedDate), asc(receivings.createdAt));

  const values = rows.map((r) => [
    r.skuName, r.partyName, r.batchNo,
    r.receivedQty ?? "", ddmmyyyy(r.receivedDate),
    r.poNumber, ddmmyyyy(r.poDate), r.poQty ?? "",
    r.invoiceNumber, ddmmyyyy(r.invoiceDate), r.invoiceQty ?? "",
    r.mfgDate, r.expDate, r.mrp ?? "",
    r.coaStatus, r.grnStatus, r.invoiceStatus, r.qc, r.finalStatus,
    r.comments, r.id,
  ]);

  const res = await callAppsScript(url, {
    action: "append",
    header: [...HEADER],
    rows: values,
  });

  return {
    sent: values.length,
    appended: res.appended ?? 0,
    skipped: res.skipped ?? 0,
    total: res.total ?? 0,
  };
}
