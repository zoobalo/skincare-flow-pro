import { db } from "../../db/client.ts";
import { purchaseOrders } from "../../db/schema/purchase-orders.ts";
import { skus } from "../../db/schema/skus.ts";
import { eq, lt, isNotNull, and } from "drizzle-orm";
import { sql } from "drizzle-orm";

export const getMrpAlerts = (teamId: string) =>
  db.query.skus.findMany({
    where: (s, { lt, and, eq }) => and(lt(s.currentInventory, s.minThreshold), eq(s.teamId, teamId)),
    orderBy: (s, { asc }) => [asc(s.currentInventory)],
    with: {
      manufacturer: { columns: { id: true, name: true } },
      rawMaterials: { columns: { id: true, name: true, currentStock: true, unit: true } },
      packaging:    { columns: { id: true, name: true, currentStock: true, transitStock: true } },
    },
  });

export const getPendingApprovals = (teamId: string) =>
  db.query.purchaseOrders.findMany({
    where: (po, { eq, and }) => and(eq(po.status, "Pending"), eq(po.teamId, teamId)),
    orderBy: (po, { asc }) => [asc(po.createdAt)],
    with: {
      vendor: { columns: { id: true, name: true } },
      sku:    { columns: { id: true, code: true, name: true } },
    },
  });

export const getDuePayments = (teamId: string) =>
  db.query.purchaseOrders.findMany({
    where: (po, { isNotNull, and, eq }) => and(isNotNull(po.paymentDue), eq(po.teamId, teamId)),
    orderBy: (po, { asc }) => [asc(po.expectedDelivery)],
    with: {
      vendor: { columns: { id: true, name: true } },
      sku:    { columns: { id: true, code: true, name: true } },
    },
  });
