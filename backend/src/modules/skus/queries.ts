import { db } from "../../db/client.ts";
import { skus } from "../../db/schema/skus.ts";
import { ilike, or, eq } from "drizzle-orm";

export const getAllSkus = (search?: string, category?: string) => {
  if (!search && !category) {
    return db.query.skus.findMany({
      orderBy: (s, { asc }) => [asc(s.name)],
      with: { manufacturer: { columns: { id: true, name: true } } },
    });
  }

  const conditions = [];
  if (search) {
    conditions.push(
      or(
        ilike(skus.name, `%${search}%`),
        ilike(skus.code, `%${search}%`)
      )
    );
  }
  if (category) conditions.push(eq(skus.category, category));

  return db.query.skus.findMany({
    where: conditions.length === 1 ? conditions[0] : (_, { and }) => and(...conditions as any),
    orderBy: (s, { asc }) => [asc(s.name)],
    with: { manufacturer: { columns: { id: true, name: true } } },
  });
};

export const getSkuById = (id: string) =>
  db.query.skus.findFirst({
    where: (s, { eq }) => eq(s.id, id),
    with: {
      manufacturer: true,
      packaging: { orderBy: (p, { asc }) => [asc(p.name)] },
      rawMaterials: { orderBy: (r, { asc }) => [asc(r.name)] },
      purchaseOrders: {
        orderBy: (po, { desc }) => [desc(po.createdAt)],
        limit: 15,
        with: { vendor: { columns: { id: true, name: true } } },
      },
      productionBatches: {
        orderBy: (b, { desc }) => [desc(b.startedAt)],
        with: {
          stageHistory: { orderBy: (h, { asc }) => [asc(h.date)] },
          vendor: { columns: { id: true, name: true, city: true } },
        },
      },
      tests:      { orderBy: (t, { asc }) => [asc(t.createdAt)] },
      dispatches: { orderBy: (d, { desc }) => [desc(d.dispatchDate)] },
    },
  });

export const createSku = (data: typeof skus.$inferInsert) =>
  db.insert(skus).values(data).returning();

export const updateSku = (id: string, data: Partial<typeof skus.$inferInsert>) =>
  db.update(skus).set({ ...data, updatedAt: new Date() }).where(eq(skus.id, id)).returning();

export const deleteSku = (id: string) =>
  db.delete(skus).where(eq(skus.id, id)).returning();
