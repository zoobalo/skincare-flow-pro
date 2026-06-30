import { db } from '../../db/client.ts';
import { skus, skuInventoryLocations } from '../../db/schema/skus.ts';
import { eq, inArray, and } from 'drizzle-orm';

function getScriptUrl() {
  const url = process.env.GOOGLE_SCRIPT_URL;
  if (!url) throw new Error('GOOGLE_SCRIPT_URL env var not set. Deploy the Apps Script from the Google Sheet and paste its URL here.');
  return url;
}

export async function pushToSheet(teamId: string) {
  const scriptUrl = getScriptUrl();

  const teamSkus = await db.select().from(skus).where(eq(skus.teamId, teamId));
  if (!teamSkus.length) return { rows: 0, locations: 0 };

  const skuIds = teamSkus.map((s) => s.id);
  const locations = await db.select().from(skuInventoryLocations)
    .where(inArray(skuInventoryLocations.skuId, skuIds));

  const allLocNames = [...new Set(locations.map((l) => l.name))].sort();

  const headers = ['SKU Code', 'SKU Name', ...allLocNames, 'Total'];
  const rows = teamSkus.map((sku) => {
    const locMap = Object.fromEntries(
      locations.filter((l) => l.skuId === sku.id).map((l) => [l.name, l.quantity])
    );
    const qtys = allLocNames.map((name) => locMap[name] ?? 0);
    const total = qtys.reduce((s, q) => s + q, 0);
    return [sku.code, sku.name, ...qtys, total];
  });

  const res = await fetch(scriptUrl, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'push', headers, rows }),
  });
  const json: any = await res.json();
  if (json.error) throw new Error(json.error);

  return { rows: rows.length, locations: allLocNames.length };
}

export async function pullFromSheet(teamId: string) {
  const scriptUrl = getScriptUrl();

  const res = await fetch(`${scriptUrl}?action=pull`, { redirect: 'follow' });
  const json: any = await res.json();
  if (json.error) throw new Error(json.error);

  const values: string[][] = json.values ?? [];
  if (values.length < 2) return { updated: 0 };

  const [headerRow, ...dataRows] = values;

  const locHeaders: { name: string; idx: number }[] = [];
  for (let i = 2; i < headerRow.length; i++) {
    const h = String(headerRow[i] ?? '').trim();
    if (h && h !== 'Total') locHeaders.push({ name: h, idx: i });
  }

  const teamSkus = await db.select().from(skus).where(eq(skus.teamId, teamId));
  const skuByCode = Object.fromEntries(teamSkus.map((s) => [s.code, s]));

  let updated = 0;
  for (const row of dataRows) {
    const skuCode = String(row[0] ?? '').trim();
    if (!skuCode) continue;
    const sku = skuByCode[skuCode];
    if (!sku) continue;

    for (const { name: locName, idx } of locHeaders) {
      const qty = parseInt(String(row[idx] ?? '0')) || 0;

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
