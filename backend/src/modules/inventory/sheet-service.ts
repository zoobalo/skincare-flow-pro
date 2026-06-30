import { google } from 'googleapis';
import { db } from '../../db/client.ts';
import { skus, skuInventoryLocations } from '../../db/schema/skus.ts';
import { eq, inArray, and } from 'drizzle-orm';

const SHEET_ID = '1cuFynl6RDWmIWBw8E2jQ5aWI_G4BiSYaRjupmVg03jU';

function getSheetsClient() {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!json) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON env var not set. Create a Google service account, download its JSON key, paste it as this env var, and share the sheet with the service account email.');
  const credentials = JSON.parse(json);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

export async function pushToSheet(teamId: string) {
  const client = getSheetsClient();

  const teamSkus = await db.select().from(skus).where(eq(skus.teamId, teamId));
  if (!teamSkus.length) return { rows: 0, locations: 0 };

  const skuIds = teamSkus.map((s) => s.id);
  const locations = await db.select().from(skuInventoryLocations)
    .where(inArray(skuInventoryLocations.skuId, skuIds));

  const allLocNames = [...new Set(locations.map((l) => l.name))].sort();

  const headers = ['SKU Code', 'SKU Name', ...allLocNames, 'Total'];
  const dataRows = teamSkus.map((sku) => {
    const locMap = Object.fromEntries(
      locations.filter((l) => l.skuId === sku.id).map((l) => [l.name, l.quantity])
    );
    const qtys = allLocNames.map((name) => locMap[name] ?? 0);
    const total = qtys.reduce((s, q) => s + q, 0);
    return [sku.code, sku.name, ...qtys, total];
  });

  await client.spreadsheets.values.clear({ spreadsheetId: SHEET_ID, range: 'A:ZZ' });
  await client.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: 'A1',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [headers, ...dataRows] as string[][] },
  });

  return { rows: dataRows.length, locations: allLocNames.length };
}

export async function pullFromSheet(teamId: string) {
  const client = getSheetsClient();

  const res = await client.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'A:ZZ',
  });

  const rows = res.data.values as string[][] | undefined;
  if (!rows || rows.length < 2) return { updated: 0 };

  const [headerRow, ...dataRows] = rows;

  // Identify location columns: everything after SKU Code + SKU Name, excluding "Total"
  const locHeaders: { name: string; idx: number }[] = [];
  for (let i = 2; i < headerRow.length; i++) {
    const h = headerRow[i]?.trim();
    if (h && h !== 'Total') locHeaders.push({ name: h, idx: i });
  }

  const teamSkus = await db.select().from(skus).where(eq(skus.teamId, teamId));
  const skuByCode = Object.fromEntries(teamSkus.map((s) => [s.code, s]));

  let updated = 0;
  for (const row of dataRows) {
    const skuCode = row[0]?.trim();
    if (!skuCode) continue;
    const sku = skuByCode[skuCode];
    if (!sku) continue;

    for (const { name: locName, idx } of locHeaders) {
      const qty = parseInt(row[idx] ?? '0') || 0;

      const [existing] = await db.select()
        .from(skuInventoryLocations)
        .where(and(
          eq(skuInventoryLocations.skuId, sku.id),
          eq(skuInventoryLocations.name, locName),
        ))
        .limit(1);

      if (existing) {
        if (existing.quantity !== qty) {
          await db.update(skuInventoryLocations)
            .set({ quantity: qty, updatedAt: new Date() })
            .where(eq(skuInventoryLocations.id, existing.id));
        }
      } else if (qty > 0) {
        await db.insert(skuInventoryLocations).values({
          id: crypto.randomUUID(),
          skuId: sku.id,
          name: locName,
          quantity: qty,
          teamId,
        });
      }
    }

    await recalcInventory(sku.id);
    updated++;
  }

  return { updated };
}

async function recalcInventory(skuId: string) {
  const locs = await db.select({ quantity: skuInventoryLocations.quantity })
    .from(skuInventoryLocations)
    .where(eq(skuInventoryLocations.skuId, skuId));
  const total = locs.reduce((s, l) => s + l.quantity, 0);
  await db.update(skus)
    .set({ currentInventory: total, updatedAt: new Date() })
    .where(eq(skus.id, skuId));
}
