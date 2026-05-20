import { db } from "../../db/client.ts";
import { purchaseOrders } from "../../db/schema/purchase-orders.ts";
import { skus } from "../../db/schema/skus.ts";
import { eq, lt, isNotNull } from "drizzle-orm";
import { sql } from "drizzle-orm";

export const getMrpAlerts = () =>
  db.query.skus.findMany({
    where: (s, { lt, sql }) => lt(s.currentInventory, s.minThreshold),
    orderBy: (s, { asc }) => [asc(s.currentInventory)],
    with: {
      manufacturer: { columns: { id: true, name: true } },
      rawMaterials: { columns: { id: true, name: true, currentStock: true, unit: true } },
      packaging:    { columns: { id: true, name: true, currentStock: true, transitStock: true } },
    },
  });

export const getPendingApprovals = () =>
  db.query.purchaseOrders.findMany({
    where: (po, { eq }) => eq(po.status, "Pending"),
    orderBy: (po, { asc }) => [asc(po.createdAt)],
    with: {
      vendor: { columns: { id: true, name: true } },
      sku:    { columns: { id: true, code: true, name: true } },
    },
  });

export const getDuePayments = () =>
  db.query.purchaseOrders.findMany({
    where: (po, { isNotNull, gt, sql }) => isNotNull(po.paymentDue),
    orderBy: (po, { asc }) => [asc(po.expectedDelivery)],
    with: {
      vendor: { columns: { id: true, name: true } },
      sku:    { columns: { id: true, code: true, name: true } },
    },
  });
