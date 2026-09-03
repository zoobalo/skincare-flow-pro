import { db } from "../../db/client.ts";
import { skus, skuInventoryLocations } from "../../db/schema/skus.ts";
import { skuSalesWeekly } from "../../db/schema/sales.ts";
import { eq, inArray, and, sql } from "drizzle-orm";
import { SALES_PLATFORMS } from "./constants.ts";

type Sheet = "sales" | "stock";

function scriptUrl(sheet: Sheet) {
  const key = sheet === "sales" ? "SALES_SHEET_SCRIPT_URL" : "STOCK_SHEET_SCRIPT_URL";
  const url = process.env[key];
  if (!url) {
    throw new Error(
      `${key} is not set on the server. Deploy the Apps Script from the ${sheet} spreadsheet and set its /exec URL.`,
    );
  }
  return url;
}

type ScriptResponse = { error?: string; values?: string[][] };

/**
 * Apps Script intermittently answers with an HTML interstitial instead of the
 * script's JSON — on a cold start, or when Google briefly serves a redirect
 * page. Parsing that blindly surfaces "Unexpected token '<'" and loses the
 * import, so read as text, and retry once before giving a usable message.
 */
async function callOnce(url: string, body: unknown): Promise<ScriptResponse> {
  const res = await fetch(url, {
    method: "POST",
    redirect: "follow",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });

  const text = await res.text();
  const looksHtml = text.trimStart().startsWith("<");
  if (looksHtml) {
    throw new Error(
      "Google returned a web page instead of data. This is usually temporary — try again in a few seconds. " +
      "If it persists, redeploy the Apps Script with access set to \"Anyone\".",
    );
  }

  let json: ScriptResponse;
  try {
    json = JSON.parse(text) as ScriptResponse;
  } catch {
    throw new Error(`Unreadable response from the sheet (${res.status}): ${text.slice(0, 120)}`);
  }
  if (json.error) throw new Error(json.error);
  return json;
}

async function call(sheet: Sheet, body: unknown): Promise<ScriptResponse> {
  const url = scriptUrl(sheet);
  try {
    return await callOnce(url, body);
  } catch (err) {
    // One retry covers the transient interstitial; a second failure is real.
    await new Promise((r) => setTimeout(r, 1500));
    return await callOnce(url, body);
  }
}

/** SKUs in the fixed order the sheets present them: alphabetical by name. */
async function orderedSkus(teamId: string) {
  const rows = await db.select().from(skus).where(eq(skus.teamId, teamId));
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

/** Sunday ending the week containing `d` — the canonical week key. */
export function weekEndingOf(d = new Date()) {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  x.setUTCDate(x.getUTCDate() + (7 - x.getUTCDay()) % 7);
  return x.toISOString().slice(0, 10);
}

// ── Template push ────────────────────────────────────────────────────────────

/** Writes SKU rows and headers so the person only ever types numbers. */
export async function pushSalesTemplate(teamId: string, weekEnding: string) {
  const list = await orderedSkus(teamId);
  const headers = ["SKU Code", "SKU Name", ...SALES_PLATFORMS];
  const rows = list.map((s) => [s.code, s.name, ...SALES_PLATFORMS.map(() => "")]);
  await call("sales", { action: "template", title: `Week ending: ${weekEnding}`, headers, rows });
  return { skus: rows.length, platforms: SALES_PLATFORMS.length, weekEnding };
}

export async function pushStockTemplate(teamId: string) {
  const list = await orderedSkus(teamId);
  const locations = await db.select().from(skuInventoryLocations)
    .where(inArray(skuInventoryLocations.skuId, list.map((s) => s.id)));
  const locNames = [...new Set(locations.map((l) => l.name))].sort();
  const headers = ["SKU Code", "SKU Name", ...locNames];
  const rows = list.map((s) => [s.code, s.name, ...locNames.map(() => "")]);
  await call("stock", {
    action: "template",
    title: `As of: ${new Date().toISOString().slice(0, 10)}`,
    headers, rows,
  });
  return { skus: rows.length, locations: locNames.length };
}

// ── IN (pull) ────────────────────────────────────────────────────────────────

export type ImportResult = {
  updated: number;
  skipped: string[];
  /** Codes shared by more than one SKU — skipped, because guessing which
   *  product the numbers belong to would silently corrupt both. */
  ambiguous: string[];
  weekEnding?: string;
};

/**
 * Maps SKU code -> SKU, and separately reports codes used by more than one
 * product. Matching is case- and whitespace-insensitive because sheet codes
 * are typed by hand elsewhere in the system.
 */
function indexByCode(list: { id: string; code: string }[]) {
  const byCode = new Map<string, { id: string; code: string }>();
  const dupes = new Set<string>();
  for (const s of list) {
    const key = s.code.trim().toLowerCase();
    if (byCode.has(key)) dupes.add(s.code.trim());
    else byCode.set(key, s);
  }
  for (const d of dupes) byCode.delete(d.toLowerCase());
  return { byCode, ambiguous: [...dupes] };
}

const num = (v: unknown) => {
  const n = parseInt(String(v ?? "0").replace(/[^0-9-]/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Reads the sales grid and stores one row per SKU/platform for the week.
 * Re-importing the same week overwrites it rather than adding to it.
 */
export async function pullSales(teamId: string, weekEnding: string, byName: string | null): Promise<ImportResult> {
  const json = await call("sales", { action: "pull" });
  const values = json.values ?? [];
  if (values.length < 2) return { updated: 0, skipped: [], ambiguous: [], weekEnding };

  const [header, ...dataRows] = values;
  // Map each platform to its column, by header name, so column order in the
  // sheet can drift without silently mis-assigning numbers.
  const colFor = new Map<string, number>();
  header.forEach((h, i) => {
    const name = String(h ?? "").trim();
    if (SALES_PLATFORMS.includes(name as (typeof SALES_PLATFORMS)[number])) colFor.set(name, i);
  });

  const list = await db.select().from(skus).where(eq(skus.teamId, teamId));
  const { byCode, ambiguous } = indexByCode(list);

  const skipped: string[] = [];
  const pending = new Map<string, typeof skuSalesWeekly.$inferInsert>();
  let updated = 0;

  for (const row of dataRows) {
    const code = String(row[0] ?? "").trim();
    if (!code) continue;
    const sku = byCode.get(code.toLowerCase());
    if (!sku) { skipped.push(code); continue; }

    for (const [platform, idx] of colFor) {
      // Keyed, so a repeated row in the sheet updates rather than colliding
      // inside a single ON CONFLICT statement.
      pending.set(`${sku.id}|${platform}`, {
        id: crypto.randomUUID(),
        skuId: sku.id, weekEnding, platform, units: num(row[idx]), teamId,
        importedByName: byName,
      });
    }
    updated++;
  }

  // One statement instead of ~430 round trips, which is what made this slow
  // enough to look like a hang.
  if (pending.size) {
    await db.insert(skuSalesWeekly).values([...pending.values()]).onConflictDoUpdate({
      target: [skuSalesWeekly.skuId, skuSalesWeekly.weekEnding, skuSalesWeekly.platform],
      set: {
        units: sql`excluded.units`,
        importedAt: new Date(),
        importedByName: byName,
      },
    });
  }
  return { updated, skipped, ambiguous, weekEnding };
}

/** Reads the stock grid into per-location quantities and recalculates totals. */
export async function pullStock(teamId: string): Promise<ImportResult> {
  const json = await call("stock", { action: "pull" });
  const values = json.values ?? [];
  if (values.length < 2) return { updated: 0, skipped: [], ambiguous: [] };

  const [header, ...dataRows] = values;
  const locCols: { name: string; idx: number }[] = [];
  for (let i = 2; i < header.length; i++) {
    const h = String(header[i] ?? "").trim();
    if (h && h.toLowerCase() !== "total") locCols.push({ name: h, idx: i });
  }

  const list = await db.select().from(skus).where(eq(skus.teamId, teamId));
  const { byCode, ambiguous } = indexByCode(list);

  const skipped: string[] = [];
  let updated = 0;

  for (const row of dataRows) {
    const code = String(row[0] ?? "").trim();
    if (!code) continue;
    const sku = byCode.get(code.toLowerCase());
    if (!sku) { skipped.push(code); continue; }

    for (const { name, idx } of locCols) {
      const qty = num(row[idx]);
      const [existing] = await db.select().from(skuInventoryLocations)
        .where(and(eq(skuInventoryLocations.skuId, sku.id), eq(skuInventoryLocations.name, name)))
        .limit(1);

      if (existing) {
        if (existing.quantity !== qty) {
          await db.update(skuInventoryLocations)
            .set({ quantity: qty, updatedAt: new Date() })
            .where(eq(skuInventoryLocations.id, existing.id));
        }
      } else if (qty > 0) {
        await db.insert(skuInventoryLocations).values({
          id: crypto.randomUUID(), skuId: sku.id, name, quantity: qty, teamId,
        });
      }
    }

    const locs = await db.select({ quantity: skuInventoryLocations.quantity })
      .from(skuInventoryLocations).where(eq(skuInventoryLocations.skuId, sku.id));
    await db.update(skus)
      .set({ currentInventory: locs.reduce((t, l) => t + l.quantity, 0), updatedAt: new Date() })
      .where(eq(skus.id, sku.id));
    updated++;
  }
  return { updated, skipped, ambiguous };
}
