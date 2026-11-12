import { readFileSync } from "node:fs";
import { Client } from "pg";
import { env } from "../config/env.js";

/**
 * Loads the receiving spreadsheet, exported as CSV, into `receivings`:
 *
 *   npm run db:import-receivings <file.csv> [--commit]
 *
 * Without --commit it reports what it would do and changes nothing.
 *
 * A blank cell stays blank — including the five statuses, which are
 * unmarked throughout the sheet. Re-running skips rows already present, so
 * a partial or repeated import does not duplicate anything.
 */

/** Minimal CSV reader: the export quotes any field holding a comma. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\r") { /* ignore */ }
    else if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

/** "01-04-2026" -> "2026-04-01". Every date in the sheet is DD-MM-YYYY. */
function isoDate(v: string): string | null {
  const m = v.trim().match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  if (+mo < 1 || +mo > 12 || +d < 1 || +d > 31) return null;
  return `${y}-${mo}-${d}`;
}

const numeric = (v: string) => {
  const t = v.replace(/[, ]/g, "").trim();
  return t && !Number.isNaN(Number(t)) ? t : null;
};

/** Header text varies by a trailing space, so match on the squeezed name. */
const key = (h: string) => h.toLowerCase().replace(/\s+/g, " ").trim();

const COLUMNS: Record<string, string> = {
  "sku name": "skuName",
  "party name": "partyName",
  "batch no": "batchNo",
  "received qty": "receivedQty",
  "received date": "receivedDate",
  "po number": "poNumber",
  "po date": "poDate",
  "po quantity": "poQty",
  "invoice number": "invoiceNumber",
  "invoice date": "invoiceDate",
  "invoice quantity": "invoiceQty",
  "mfg date": "mfgDate",
  "exp date": "expDate",
  "mrp": "mrp",
  "coa status": "coaStatus",
  "grn status": "grnStatus",
  "invoice status": "invoiceStatus",
  "qc": "qc",
  "final status": "finalStatus",
  "comments": "comments",
};

const DATES   = new Set(["receivedDate", "poDate", "invoiceDate"]);
const NUMBERS = new Set(["receivedQty", "poQty", "invoiceQty", "mrp"]);

async function main() {
  const file = process.argv[2];
  const commit = process.argv.includes("--commit");
  if (!file) { console.error("usage: npm run db:import-receivings <file.csv> [--commit]"); process.exit(1); }

  const rows = parseCsv(readFileSync(file, "utf8")).filter((r) => r.some((c) => c.trim()));
  const header = rows[0].map(key);
  const unknown = header.filter((h) => h && !COLUMNS[h]);
  if (unknown.length) console.warn(`ignoring unrecognised columns: ${unknown.join(", ")}`);

  const client = new Client({ connectionString: env.DATABASE_URL });
  await client.connect();

  const [{ team_id: teamId }] = (await client.query(
    `select team_id, count(*) as n from users group by team_id order by n desc limit 1`)).rows;

  const existing = new Set(
    (await client.query(
      `select sku_name, party_name, batch_no, received_qty, received_date, invoice_number from receivings`))
      .rows.map((r) => [r.sku_name, r.party_name, r.batch_no, r.received_qty,
                        r.received_date instanceof Date ? r.received_date.toISOString().slice(0, 10) : r.received_date,
                        r.invoice_number].join("\u0000")));

  let inserted = 0, skipped = 0, badDates = 0;
  const values: unknown[][] = [];

  for (const raw of rows.slice(1)) {
    const rec: Record<string, string> = {};
    header.forEach((h, i) => { const f = COLUMNS[h]; if (f) rec[f] = (raw[i] ?? "").trim(); });
    if (!rec.skuName && !rec.partyName) continue;

    const field = (k: string) => {
      const v = rec[k] ?? "";
      if (DATES.has(k))   { if (!v) return null; const d = isoDate(v); if (!d) badDates++; return d; }
      if (NUMBERS.has(k)) return numeric(v);
      return v;                       // blank stays blank, statuses included
    };

    const receivedDate = field("receivedDate") as string | null;
    const fingerprint = [rec.skuName, rec.partyName, rec.batchNo, field("receivedQty"),
                         receivedDate, rec.invoiceNumber].join("\u0000");
    if (existing.has(fingerprint)) { skipped++; continue; }
    existing.add(fingerprint);

    values.push([
      crypto.randomUUID(), teamId,
      rec.skuName, rec.partyName, rec.batchNo ?? "",
      field("receivedQty"), receivedDate,
      rec.poNumber ?? "", field("poDate"), field("poQty"),
      rec.invoiceNumber ?? "", field("invoiceDate"), field("invoiceQty"),
      rec.mfgDate ?? "", rec.expDate ?? "", field("mrp"),
      rec.coaStatus ?? "", rec.grnStatus ?? "", rec.invoiceStatus ?? "",
      rec.qc ?? "", rec.finalStatus ?? "", rec.comments ?? "",
      "", "Sheet import",
    ]);
    inserted++;
  }

  console.log(`sheet rows: ${rows.length - 1}`);
  console.log(`  to insert: ${inserted}`);
  console.log(`  already present, skipped: ${skipped}`);
  if (badDates) console.log(`  ⚠️  unparseable dates left blank: ${badDates}`);

  if (!commit) {
    console.log("\ndry run — nothing written. Re-run with --commit to apply.");
    await client.end();
    return;
  }

  if (values.length) {
    const cols = `id, team_id, sku_name, party_name, batch_no, received_qty, received_date,
                  po_number, po_date, po_qty, invoice_number, invoice_date, invoice_qty,
                  mfg_date, exp_date, mrp, coa_status, grn_status, invoice_status,
                  qc, final_status, comments, created_by_id, created_by_name`;
    const width = values[0].length;
    const tuples = values.map((_, r) =>
      `(${Array.from({ length: width }, (_, c) => `$${r * width + c + 1}`).join(",")})`).join(",");
    await client.query("begin");
    try {
      await client.query(`insert into receivings (${cols}) values ${tuples}`, values.flat());
      await client.query("commit");
      console.log(`\n✅  inserted ${values.length} rows`);
    } catch (err) {
      await client.query("rollback");
      console.error("❌  rolled back:", err instanceof Error ? err.message : err);
      process.exitCode = 1;
    }
  }
  await client.end();
}
main();
