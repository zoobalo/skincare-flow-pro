import { db } from "../../db/client.ts";
import { purchaseOrders } from "../../db/schema/purchase-orders.ts";
import { eq, and } from "drizzle-orm";
import type { POStatus } from "../../db/schema/purchase-orders.ts";

export const getAllPurchaseOrders = (status?: string, vendorId?: string, skuId?: string) => {
  const conditions = [];
  if (status)   conditions.push(eq(purchaseOrders.status, status as POStatus));
  if (vendorId) conditions.push(eq(purchaseOrders.vendorId, vendorId));
  if (skuId)    conditions.push(eq(purchaseOrders.skuId, skuId));

  return db.query.purchaseOrders.findMany({
    where: conditions.length ? (_, { and }) => and(...conditions as any) : undefined,
    orderBy: (po, { desc }) => [desc(po.createdAt)],
    with: {
      vendor:       { columns: { id: true, name: true, city: true } },
      manufacturer: { columns: { id: true, name: true, city: true, location: true } },
      sku:          { columns: { id: true, code: true, name: true } },
    },
  });
};

export const getPurchaseOrderById = (id: string) =>
  db.query.purchaseOrders.findFirst({
    where: (po, { eq }) => eq(po.id, id),
    with: { vendor: true, manufacturer: true, sku: true },
  });

export const createPurchaseOrder = (data: typeof purchaseOrders.$inferInsert) =>
  db.insert(purchaseOrders).values(data).returning();

export const updatePurchaseOrderStatus = (id: string, status: POStatus) =>
  db
    .update(purchaseOrders)
    .set({ status, updatedAt: new Date() })
    .where(eq(purchaseOrders.id, id))
    .returning();

export const updatePurchaseOrder = (id: string, data: Partial<typeof purchaseOrders.$inferInsert>) =>
  db.update(purchaseOrders).set({ ...data, updatedAt: new Date() }).where(eq(purchaseOrders.id, id)).returning();

export const deletePurchaseOrder = (id: string) =>
  db.delete(purchaseOrders).where(eq(purchaseOrders.id, id)).returning();
