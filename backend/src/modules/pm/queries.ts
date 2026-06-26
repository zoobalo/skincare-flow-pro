import { db } from "../../db/client.ts";
import { packagingMaterials } from "../../db/schema/packaging-materials.ts";
import { ilike, or, eq, and } from "drizzle-orm";

export const getAllPms = (teamId: string, search?: string, category?: string) => {
  const conditions: any[] = [eq(packagingMaterials.teamId, teamId)];
  if (search) conditions.push(or(ilike(packagingMaterials.name, `%${search}%`), ilike(packagingMaterials.code, `%${search}%`)));
  if (category) conditions.push(eq(packagingMaterials.category, category));
  return db.query.packagingMaterials.findMany({
    where: and(...conditions),
    orderBy: (pm, { asc }) => [asc(pm.name)],
  });
};

export const getPmById = (id: string) =>
  db.query.packagingMaterials.findFirst({
    where: (pm, { eq }) => eq(pm.id, id),
    with: {
      vendors:   { orderBy: (v, { asc }) => [asc(v.id)] },
      dispatches: { orderBy: (d, { desc }) => [desc(d.dispatchDate)] },
      comments:  { orderBy: (c, { asc }) => [asc(c.createdAt)] },
      links:     { orderBy: (l, { asc }) => [asc(l.createdAt)] },
    },
  });

export const createPm = (data: typeof packagingMaterials.$inferInsert) =>
  db.insert(packagingMaterials).values(data).returning();

export const updatePm = (id: string, data: Partial<typeof packagingMaterials.$inferInsert>) =>
  db.update(packagingMaterials).set({ ...data, updatedAt: new Date() }).where(eq(packagingMaterials.id, id)).returning();

export const deletePm = (id: string) =>
  db.delete(packagingMaterials).where(eq(packagingMaterials.id, id)).returning();
