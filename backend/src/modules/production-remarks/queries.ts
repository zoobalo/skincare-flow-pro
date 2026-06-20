import { db } from "../../db/client.ts";
import { productionRemarks } from "../../db/schema/production-remarks.ts";
import { skus } from "../../db/schema/skus.ts";
import { eq } from "drizzle-orm";

export const getAllRemarks = (teamId: string) =>
  db
    .select({
      id:           productionRemarks.id,
      skuId:        productionRemarks.skuId,
      materialType: productionRemarks.materialType,
      remark:       productionRemarks.remark,
      status:       productionRemarks.status,
      createdAt:    productionRemarks.createdAt,
      updatedAt:    productionRemarks.updatedAt,
      skuCode:      skus.code,
      skuName:      skus.name,
    })
    .from(productionRemarks)
    .leftJoin(skus, eq(productionRemarks.skuId, skus.id))
    .where(eq(productionRemarks.teamId, teamId))
    .orderBy(productionRemarks.createdAt);

export const createRemark = (data: typeof productionRemarks.$inferInsert) =>
  db.insert(productionRemarks).values(data).returning();

export const updateRemark = (id: string, data: Partial<typeof productionRemarks.$inferInsert>) =>
  db.update(productionRemarks).set({ ...data, updatedAt: new Date() }).where(eq(productionRemarks.id, id)).returning();

export const deleteRemark = (id: string) =>
  db.delete(productionRemarks).where(eq(productionRemarks.id, id)).returning();
