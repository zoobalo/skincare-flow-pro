import { db } from "../../db/client.ts";
import { purchaseOrders } from "../../db/schema/purchase-orders.ts";
import { productionBatches } from "../../db/schema/production.ts";
import { shipments } from "../../db/schema/shipments.ts";
import { skus } from "../../db/schema/skus.ts";
import { vendors } from "../../db/schema/vendors.ts";

export const getDashboardKpis = async () => {
  const [allPOs, allBatches, allShipments, allSkus, allVendors] = await Promise.all([
    db.select().from(purchaseOrders),
    db.select().from(productionBatches),
    db.select().from(shipments),
    db.select().from(skus),
    db.select().from(vendors),
  ]);

  const pendingApprovals = allPOs.filter((po) => po.status === "Pending").length;
  const activeProduction = allBatches.filter((b) => b.currentStage !== "Warehouse Received").length;
  const inTransit = allShipments.filter((s) => s.status === "In Transit").length;
  const delayedBatches = allBatches.filter((b) => b.delayed).length;
  const lowStockSkus = allSkus.filter((s) => s.currentInventory < s.minThreshold).length;
  const totalSpend = allPOs
    .filter((po) => po.status === "Delivered")
    .reduce((sum, po) => sum + parseFloat(po.total), 0);
  const totalDuePayments = allPOs
    .filter((po) => po.paymentDue)
    .reduce((sum, po) => sum + parseFloat(po.paymentDue!), 0);

  // Monthly procurement spend (last 6 months by dispatchDate)
  const spendByMonth: Record<string, number> = {};
  for (const po of allPOs) {
    const month = po.dispatchDate.slice(0, 7); // "2026-04"
    spendByMonth[month] = (spendByMonth[month] ?? 0) + parseFloat(po.total);
  }
  const procurementSpend = Object.entries(spendByMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([month, total]) => ({ month, total: Math.round(total) }));

  // Production by month
  const productionByMonth: Record<string, number> = {};
  for (const b of allBatches) {
    const month = b.startedAt.slice(0, 7);
    productionByMonth[month] = (productionByMonth[month] ?? 0) + b.quantity;
  }
  const monthlyProduction = Object.entries(productionByMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, quantity]) => ({ month, quantity }));

  // PO status breakdown
  const poStatusBreakdown: Record<string, number> = {};
  for (const po of allPOs) {
    poStatusBreakdown[po.status] = (poStatusBreakdown[po.status] ?? 0) + 1;
  }

  // Vendor reliability (top 6)
  const vendorReliability = allVendors
    .sort((a, b) => b.reliability - a.reliability)
    .slice(0, 6)
    .map((v) => ({ name: v.name.length > 15 ? v.name.slice(0, 14) + "…" : v.name, reliability: v.reliability, delayPercent: v.delayPercent }));

  // Shipment status breakdown
  const shipmentStatusBreakdown: Record<string, number> = {};
  for (const s of allShipments) {
    shipmentStatusBreakdown[s.status] = (shipmentStatusBreakdown[s.status] ?? 0) + 1;
  }

  return {
    kpis: {
      totalPOs: allPOs.length,
      pendingApprovals,
      activeProduction,
      inTransit,
      delayedBatches,
      lowStockSkus,
      totalSpend,
      totalDuePayments,
      totalVendors: allVendors.length,
      totalSkus: allSkus.length,
    },
    charts: {
      procurementSpend,
      monthlyProduction,
      poStatusBreakdown,
      vendorReliability,
      shipmentStatusBreakdown,
    },
  };
};
