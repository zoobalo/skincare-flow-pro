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
  weeklyUnits: number | null;      // averaged over the weeks we have
  weeksOfData: number;      // imports used
  daysCovered: number;      // days those imports actually span
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
 * Days of cover per SKU: how long current stock lasts at recent sales velocity,
 * and therefore the date production must start to avoid a stockout.
 *
 * Velocity averages the most recent weeks that actually have data, so one
 * missed import narrows the window rather than reporting zero demand.
 */
/** Whole days between two ISO dates, at least 1. */
function daysBetween(earlier: string, later: string) {
  const ms = new Date(`${later}T00:00:00Z`).getTime() - new Date(`${earlier}T00:00:00Z`).getTime();
  return Math.max(1, Math.round(ms / 86_400_000));
}

/**
 * Days of cover per SKU: how long stock lasts at recent sales velocity, and
 * therefore the date production must start to avoid a stockout.
 *
 * Imports are ad hoc, so each one is treated as covering the days since the
 * previous import rather than a fixed week. Velocity is total units divided by
 * the days those imports actually span — nine days of sales are not counted as
 * a week, and neither are four.
 */
export async function getForecast(teamId: string): Promise<ForecastRow[]> {
  const list = await db.select().from(skus).where(eq(skus.teamId, teamId));

  const sales = await db.select().from(skuSalesWeekly)
    .where(eq(skuSalesWeekly.teamId, teamId))
    .orderBy(desc(skuSalesWeekly.weekEnding));

  // Import dates, newest first, and how many days each one covers.
  const allDates = [...new Set(sales.map((r) => r.weekEnding))].sort().reverse();
  const spanOf = new Map<string, number>();
  allDates.forEach((d, i) => {
    const older = allDates[i + 1];
    spanOf.set(d, older ? daysBetween(older, d) : 7); // first ever import: assume a week
  });

  const bySku = new Map<string, Map<string, Record<string, number>>>();
  let lastImport: Date | null = null;
  for (const r of sales) {
    if (!bySku.has(r.skuId)) bySku.set(r.skuId, new Map());
    const periods = bySku.get(r.skuId)!;
    if (!periods.has(r.weekEnding)) periods.set(r.weekEnding, {});
    periods.get(r.weekEnding)![r.platform] = r.units;
    if (!lastImport || r.importedAt > lastImport) lastImport = r.importedAt;
  }

  return list.map((sku) => {
    const periods = bySku.get(sku.id);
    const recent = periods
      ? [...periods.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, VELOCITY_WEEKS)
      : [];

    const platformBreakdown: Record<string, number> = {};
    let total = 0;
    let days = 0;
    for (const [date, platforms] of recent) {
      days += spanOf.get(date) ?? 7;
      for (const [p, u] of Object.entries(platforms)) {
        platformBreakdown[p] = (platformBreakdown[p] ?? 0) + u;
        total += u;
      }
    }

    const weeksOfData = recent.length;
    const dailyVelocity = days > 0 && total > 0 ? total / days : null;
    // Reported as a weekly figure because that is how the team thinks about it,
    // even though it is derived from actual elapsed days.
    const weeklyUnits = dailyVelocity !== null ? dailyVelocity * 7 : (weeksOfData ? 0 : null);
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
      weeksOfData,
      daysCovered: days,
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
}
