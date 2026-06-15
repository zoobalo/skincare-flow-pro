import { db } from "../../db/client.ts";
import { vendors } from "../../db/schema/vendors.ts";
import { eq } from "drizzle-orm";

export const getAllVendors = (teamId: string) =>
  db.select().from(vendors).where(eq(vendors.teamId, teamId)).orderBy(vendors.name);

export const getVendorById = (id: string) =>
  db.query.vendors.findFirst({
    where: (v, { eq }) => eq(v.id, id),
    with: {
      purchaseOrders: {
        orderBy: (po, { desc }) => [desc(po.createdAt)],
        limit: 20,
        with: { sku: { columns: { id: true, code: true, name: true } } },
      },
    },
  });

export const createVendor = (data: typeof vendors.$inferInsert) =>
  db.insert(vendors).values(data).returning();

export const updateVendor = (id: string, data: Partial<typeof vendors.$inferInsert>) =>
  db.update(vendors).set({ ...data, updatedAt: new Date() }).where(eq(vendors.id, id)).returning();

export const deleteVendor = (id: string) =>
  db.delete(vendors).where(eq(vendors.id, id)).returning();
