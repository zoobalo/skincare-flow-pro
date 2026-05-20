import { db } from "../../db/client.ts";
import { productionBatches } from "../../db/schema/production.ts";
import { eq } from "drizzle-orm";

export const getAllBatches = () =>
  db.query.productionBatches.findMany({
    orderBy: (b, { desc }) => [desc(b.startedAt)],
    with: {
      sku:          { columns: { id: true, code: true, name: true, image: true } },
      manufacturer: { columns: { id: true, name: true, location: true } },
      stageHistory: { orderBy: (h, { asc }) => [asc(h.date)] },
    },
  });

export const getBatchById = (id: string) =>
  db.query.productionBatches.findFirst({
    where: (b, { eq }) => eq(b.id, id),
    with: {
      sku: true,
      manufacturer: true,
      stageHistory: { orderBy: (h, { asc }) => [asc(h.date)] },
    },
  });

export const createBatch = (data: typeof productionBatches.$inferInsert) =>
  db.insert(productionBatches).values(data).returning();

export const updateBatchStage = (id: string, stage: string) =>
  db.update(productionBatches).set({ currentStage: stage as any, updatedAt: new Date() }).where(eq(productionBatches.id, id)).returning();

export const updateBatch = (id: string, data: Partial<typeof productionBatches.$inferInsert>) =>
  db.update(productionBatches).set({ ...data, updatedAt: new Date() }).where(eq(productionBatches.id, id)).returning();

export const deleteBatch = (id: string) =>
  db.delete(productionBatches).where(eq(productionBatches.id, id)).returning();
