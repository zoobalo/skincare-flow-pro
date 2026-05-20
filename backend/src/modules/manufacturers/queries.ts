import { db } from "../../db/client.ts";
import { manufacturers } from "../../db/schema/manufacturers.ts";
import { eq } from "drizzle-orm";

export const getAllManufacturers = () =>
  db.query.manufacturers.findMany({
    orderBy: (m, { asc }) => [asc(m.name)],
    with: {
      productionBatches: {
        columns: { id: true, batchNumber: true, currentStage: true, delayed: true, quantity: true, expectedCompletion: true, startedAt: true },
        with: { sku: { columns: { id: true, code: true, name: true } } },
      },
    },
  });

export const getManufacturerById = (id: string) =>
  db.query.manufacturers.findFirst({
    where: (m, { eq }) => eq(m.id, id),
    with: {
      skus: { columns: { id: true, code: true, name: true, currentInventory: true } },
      productionBatches: {
        orderBy: (b, { desc }) => [desc(b.startedAt)],
        with: { stageHistory: true },
      },
    },
  });

export const createManufacturer = (data: typeof manufacturers.$inferInsert) =>
  db.insert(manufacturers).values(data).returning();

export const updateManufacturer = (id: string, data: Partial<typeof manufacturers.$inferInsert>) =>
  db.update(manufacturers).set(data).where(eq(manufacturers.id, id)).returning();

export const deleteManufacturer = (id: string) =>
  db.delete(manufacturers).where(eq(manufacturers.id, id)).returning();
