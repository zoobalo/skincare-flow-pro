import { db } from "../../db/client.ts";
import { skus } from "../../db/schema/skus.ts";
import { skuSalesWeekly } from "../../db/schema/sales.ts";
import { eq, desc } from "drizzle-orm";
import { VELOCITY_WEEKS, DEFAULT_COVER_THRESHOLD_DAYS, CRITICAL_BUFFER_DAYS } from "./constants.ts";

export type ForecastRow = {
  skuId: string;
  code: string;
  name: string;
  currentInventory: number;
  leadTimeDays: number;
  thresholdDays: number;
  weeklyUnits: number | null;      // average across the imports we have
  /** Units per week, aligned to Forecast.recentWeeks. null = no import that week. */
  weeks: (number | null)[];
  monthlyUnits: number | null;     // sum of the weeks shown
  weeksOfData: number;             // imports actually used
  dailyVelocity: number | null;
  daysOfCover: number | null;      // null when there is no usable sales data
  stockoutDate: string | null;
  startProductionBy: string | null;
  status: "critical" | "warning" | "ok" | "no-sales-data" | "no-stock";
  platformBreakdown: Record<string, number>;
  lastImportedAt: string | null;
};

const addDays = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + Math.floor(days));
  return d.toISOString().slice(0, 10);
};

/**
 * Days of cover per SKU: how long stock lasts at recent sales velocity, and
 * therefore the date production must start to avoid a stockout.
 *
 * Each import carries one week of sales, whatever day it is pressed — that is
 * what the sheet holds — so velocity is the average of recent imports, not a
 * rate derived from the gap between them. Dividing by elapsed days made two
 * imports a day apart read as a week of sales in a single day.
 */
export type Forecast = {
  rows: ForecastRow[];
  /** Import dates behind the week columns, most recent first. */
  recentWeeks: string[];
};

export async function getForecast(teamId: string): Promise<Forecast> {
  const list = await db.select().from(skus).where(eq(skus.teamId, teamId));

  const sales = await db.select().from(skuSalesWeekly)
    .where(eq(skuSalesWeekly.teamId, teamId))
    .orderBy(desc(skuSalesWeekly.weekEnding));

  // Week columns come from the imports that exist overall, not per SKU, so a
  // SKU with no sales in week 3 still lines up under the right heading.
  const recentWeeks = [...new Set(sales.map((r) => r.weekEnding))]
    .sort()
    .reverse()
    .slice(0, VELOCITY_WEEKS);

  const bySku = new Map<string, Map<string, Record<string, number>>>();
  let lastImport: Date | null = null;
  for (const r of sales) {
    if (!bySku.has(r.skuId)) bySku.set(r.skuId, new Map());
    const weeks = bySku.get(r.skuId)!;
    if (!weeks.has(r.weekEnding)) weeks.set(r.weekEnding, {});
    weeks.get(r.weekEnding)![r.platform] = r.units;
    if (!lastImport || r.importedAt > lastImport) lastImport = r.importedAt;
  }

  const rows = list.map((sku) => {
    const weeksForSku = bySku.get(sku.id);

    const platformBreakdown: Record<string, number> = {};
    let total = 0;
    let weeksOfData = 0;

    const weekUnits = recentWeeks.map((weekEnding) => {
      const platforms = weeksForSku?.get(weekEnding);
      if (!platforms) return null;
      let weekTotal = 0;
      for (const [p, u] of Object.entries(platforms)) {
        platformBreakdown[p] = (platformBreakdown[p] ?? 0) + u;
        weekTotal += u;
      }
      total += weekTotal;
      weeksOfData++;
      return weekTotal;
    });
    const weeklyUnits = weeksOfData ? total / weeksOfData : null;
    const dailyVelocity = weeklyUnits && weeklyUnits > 0 ? weeklyUnits / 7 : null;
    const inventory = sku.currentInventory ?? 0;
    const leadTimeDays = sku.productionTimelineDays ?? 30;
    const thresholdDays = DEFAULT_COVER_THRESHOLD_DAYS;

    const daysOfCover = dailyVelocity ? inventory / dailyVelocity : null;

    let status: ForecastRow["status"];
    if (weeksOfData === 0 || !dailyVelocity) status = "no-sales-data";
    else if (inventory <= 0) status = "no-stock";
    else if (daysOfCover! < leadTimeDays + CRITICAL_BUFFER_DAYS) status = "critical";
    else if (daysOfCover! < thresholdDays) status = "warning";
    else status = "ok";

    return {
      skuId: sku.id,
      code: sku.code,
      name: sku.name,
      currentInventory: inventory,
      leadTimeDays,
      thresholdDays,
      weeklyUnits,
      weeks: weekUnits,
      monthlyUnits: weeksOfData ? total : null,
      weeksOfData,
      dailyVelocity,
      daysOfCover,
      stockoutDate: daysOfCover !== null ? addDays(daysOfCover) : null,
      startProductionBy: daysOfCover !== null ? addDays(daysOfCover - leadTimeDays) : null,
      status,
      platformBreakdown,
      lastImportedAt: lastImport ? lastImport.toISOString() : null,
    };
  }).sort((a, b) => {
    const rank = { critical: 0, "no-stock": 1, warning: 2, ok: 3, "no-sales-data": 4 };
    if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
    return (a.daysOfCover ?? 1e9) - (b.daysOfCover ?? 1e9);
  });

  return { rows, recentWeeks };
}
