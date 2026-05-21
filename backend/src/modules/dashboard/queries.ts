import { db } from "../../db/client.ts";
import { sql } from "drizzle-orm";
import { purchaseOrders } from "../../db/schema/purchase-orders.ts";
import { productionBatches } from "../../db/schema/production.ts";
import { shipments } from "../../db/schema/shipments.ts";
import { skus } from "../../db/schema/skus.ts";
import { vendors } from "../../db/schema/vendors.ts";

export const getDashboardKpis = async () => {
  const [
    poKpis,
    batchKpis,
    shipmentKpis,
    skuKpis,
    vendorCount,
    procurementSpend,
    productionByMonth,
    poStatusBreakdown,
    vendorReliability,
    shipmentStatusBreakdown,
  ] = await Promise.all([
    db.select({
      totalPOs:         sql<number>`COUNT(*)::int`,
      pendingApprovals: sql<number>`COUNT(*) FILTER (WHERE status = 'Pending')::int`,
      totalSpend:       sql<string>`COALESCE(SUM(total::numeric) FILTER (WHERE status = 'Delivered'), 0)::text`,
      totalDuePayments: sql<string>`COALESCE(SUM(payment_due::numeric) FILTER (WHERE payment_due IS NOT NULL), 0)::text`,
    }).from(purchaseOrders),

    db.select({
      activeProduction: sql<number>`COUNT(*) FILTER (WHERE current_stage != 'Warehouse Received')::int`,
      delayedBatches:   sql<number>`COUNT(*) FILTER (WHERE delayed = true)::int`,
    }).from(productionBatches),

    db.select({
      inTransit: sql<number>`COUNT(*) FILTER (WHERE status = 'In Transit')::int`,
    }).from(shipments),

    db.select({
      totalSkus:    sql<number>`COUNT(*)::int`,
      lowStockSkus: sql<number>`COUNT(*) FILTER (WHERE current_inventory < min_threshold)::int`,
    }).from(skus),

    db.select({ total: sql<number>`COUNT(*)::int` }).from(vendors),

    db.select({
      month: sql<string>`to_char(dispatch_date::date, 'YYYY-MM')`,
      total: sql<number>`SUM(total::numeric)::float`,
    }).from(purchaseOrders)
      .groupBy(sql`to_char(dispatch_date::date, 'YYYY-MM')`)
      .orderBy(sql`to_char(dispatch_date::date, 'YYYY-MM') DESC`)
      .limit(6),

    db.select({
      month:    sql<string>`to_char(started_at::date, 'YYYY-MM')`,
      quantity: sql<number>`SUM(quantity)::int`,
    }).from(productionBatches)
      .groupBy(sql`to_char(started_at::date, 'YYYY-MM')`)
      .orderBy(sql`to_char(started_at::date, 'YYYY-MM')`),

    db.select({
      status: purchaseOrders.status,
      count:  sql<number>`COUNT(*)::int`,
    }).from(purchaseOrders).groupBy(purchaseOrders.status),

    db.select({
      name:         vendors.name,
      reliability:  vendors.reliability,
      delayPercent: vendors.delayPercent,
    }).from(vendors)
      .orderBy(sql`reliability DESC`)
      .limit(6),

    db.select({
      status: shipments.status,
      count:  sql<number>`COUNT(*)::int`,
    }).from(shipments).groupBy(shipments.status),
  ]);

  const po = poKpis[0];
  const batch = batchKpis[0];
  const ship = shipmentKpis[0];
  const sku = skuKpis[0];

  const poStatusMap: Record<string, number> = {};
  for (const row of poStatusBreakdown) poStatusMap[row.status] = row.count;

  const shipStatusMap: Record<string, number> = {};
  for (const row of shipmentStatusBreakdown) shipStatusMap[row.status] = row.count;

  return {
    kpis: {
      totalPOs:         po?.totalPOs ?? 0,
      pendingApprovals: po?.pendingApprovals ?? 0,
      activeProduction: batch?.activeProduction ?? 0,
      inTransit:        ship?.inTransit ?? 0,
      delayedBatches:   batch?.delayedBatches ?? 0,
      lowStockSkus:     sku?.lowStockSkus ?? 0,
      totalSpend:       parseFloat(po?.totalSpend ?? "0"),
      totalDuePayments: parseFloat(po?.totalDuePayments ?? "0"),
      totalVendors:     vendorCount[0]?.total ?? 0,
      totalSkus:        sku?.totalSkus ?? 0,
    },
    charts: {
      procurementSpend: procurementSpend
        .reverse()
        .map((r) => ({ month: r.month, total: Math.round(r.total) })),
      monthlyProduction: productionByMonth.map((r) => ({ month: r.month, quantity: r.quantity })),
      poStatusBreakdown: poStatusMap,
      vendorReliability: vendorReliability.map((v) => ({
        name:         v.name.length > 15 ? v.name.slice(0, 14) + "…" : v.name,
        reliability:  v.reliability,
        delayPercent: v.delayPercent,
      })),
      shipmentStatusBreakdown: shipStatusMap,
    },
  };
};
