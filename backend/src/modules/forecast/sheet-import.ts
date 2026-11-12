import { db } from "../../db/client.ts";
import { forecastRows, forecastMeta } from "../../db/schema/forecast-sheet.ts";
import { eq } from "drizzle-orm";

/**
 * Pulls the Inventory Forecast spreadsheet and replaces the stored snapshot.
 *
 * The sheet is read through its CSV export, which needs no Apps Script and no
 * credentials as long as the document is link-shared. FORECAST_SHEET_URL holds
 * the link; it is not committed, because for a link-shared document the URL is
 * the access.
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

/** "31,938" -> "31938"; "" and "-" -> null. */
const num = (v: string | undefined): string | null => {
  const t = (v ?? "").replace(/[,\s]/g, "").trim();
  if (!t || t === "-") return null;
  return Number.isFinite(Number(t)) ? String(Number(t)) : null;
};
const txt = (v: string | undefined) => (v ?? "").trim();
const whole = (v: string | null) => (v === null ? null : Math.trunc(Number(v)));

/**
 * Turns the export URL into its CSV form, whatever shape was pasted in —
 * an /edit link with a #gid, a /view link, or the export URL itself.
 */
export function csvUrl(raw: string): string {
  const id = raw.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)?.[1];
  if (!id) throw new Error("FORECAST_SHEET_URL is not a Google Sheets link.");
  const gid = raw.match(/[?#&]gid=(\d+)/)?.[1] ?? "0";
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
}

/** The banner line carries the settings the whole sheet was built with. */
function readBanner(rows: string[][]) {
  const line = rows.slice(0, 6).map((r) => r.join(" ")).join(" ");
  const after = (label: string) =>
    line.match(new RegExp(`${label}:\\s*([^|]+)`, "i"))?.[1]?.trim() ?? "";
  const days = (label: string) => {
    const m = after(label).match(/(\d+)/);
    return m ? Number(m[1]) : null;
  };
  return {
    reportDate:    after("Report date"),
    monthStart:    after("Month start"),
    currentWeek:   after("Current week shown"),
    leadTimeDays:  days("Lead time"),
    triggerAtDays: days("Production trigger at"),
  };
}

/** "Total units to produce:" sits in the summary block above the table. */
function readTotal(rows: string[][]): string | null {
  for (const r of rows.slice(0, 6)) {
    const at = r.findIndex((c) => /total units to produce/i.test(c));
    if (at >= 0) {
      for (let i = at + 1; i < r.length; i++) {
        const n = num(r[i]);
        if (n !== null) return n;
      }
    }
  }
  return null;
}

export async function importForecastSheet(teamId: string, importedByName: string) {
  const configured = process.env.FORECAST_SHEET_URL;
  if (!configured) {
    throw new Error(
      "FORECAST_SHEET_URL is not set on the server. Add the Inventory Forecast spreadsheet link to use Update Data.",
    );
  }

  const res = await fetch(csvUrl(configured), {
    redirect: "follow",
    signal: AbortSignal.timeout(60_000),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`The spreadsheet could not be read (${res.status}).`);
  if (body.trimStart().startsWith("<")) {
    throw new Error(
      "Google returned a sign-in page instead of the sheet. Set the spreadsheet's sharing to \"Anyone with the link can view\".",
    );
  }

  const grid = parseCsv(body);

  // The table starts at the first row numbered in column A with a name beside
  // it — steadier than counting header rows, which the sheet may regrow.
  const data = grid.filter((r) => /^\d+$/.test(txt(r[0])) && txt(r[1]));
  if (!data.length) {
    throw new Error("No forecast rows found in the sheet. Check that the right tab is linked.");
  }

  const banner = readBanner(grid);
  const values = data.map((r, i) => ({
    id:       crypto.randomUUID(),
    teamId,
    position: Number(txt(r[0])) || i + 1,
    skuName:  txt(r[1]),

    saleD2c:     num(r[2]),
    saleAmazon:  num(r[3]),
    saleNykaa:   num(r[4]),
    saleBlinkit: num(r[5]),
    saleZepto:   num(r[6]),

    currentInventory: num(r[7]),
    openProduction:   num(r[8]),

    week1: num(r[9]),
    week2: num(r[10]),
    week3: num(r[11]),
    week4: num(r[12]),

    avgWeeklySale:        num(r[13]),
    monthlySaleRate:      num(r[14]),
    dailySaleRate:        num(r[15]),
    stockSufficiencyDays: num(r[16]),
    stockNeededLeadTime:  num(r[17]),

    stockOutDate:           txt(r[18]),
    productionTriggerDate:  txt(r[19]),
    status:                 txt(r[20]),
    suggestedProductionQty: num(r[21]),
  }));

  // A snapshot replaces the one before it: the sheet is the whole truth, and a
  // SKU dropped from it should disappear here too.
  await db.transaction(async (tx) => {
    await tx.delete(forecastRows).where(eq(forecastRows.teamId, teamId));
    for (let i = 0; i < values.length; i += 200) {
      await tx.insert(forecastRows).values(values.slice(i, i + 200));
    }
    const meta = {
      teamId,
      reportDate:     banner.reportDate,
      monthStart:     banner.monthStart,
      currentWeek:    banner.currentWeek,
      leadTimeDays:   banner.leadTimeDays,
      triggerAtDays:  banner.triggerAtDays,
      totalToProduce: readTotal(grid),
      rowCount:       values.length,
      importedAt:     new Date(),
      importedByName,
    };
    await tx.delete(forecastMeta).where(eq(forecastMeta.teamId, teamId));
    await tx.insert(forecastMeta).values(meta);
  });

  return { rows: values.length, ...banner };
}
