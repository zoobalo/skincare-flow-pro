import { db } from "../../db/client.ts";
import { couriers } from "../../db/schema/couriers.ts";
import { eq, desc } from "drizzle-orm";

export const getAllCouriers = (ownerUserId: string) =>
  db.select().from(couriers).where(eq(couriers.ownerUserId, ownerUserId)).orderBy(desc(couriers.dispatchDate), desc(couriers.createdAt));

export const createCourier = (data: typeof couriers.$inferInsert) =>
  db.insert(couriers).values(data).returning();

export const updateCourier = (id: string, data: Partial<typeof couriers.$inferInsert>) =>
  db.update(couriers).set(data).where(eq(couriers.id, id)).returning();

export const deleteCourier = (id: string) =>
  db.delete(couriers).where(eq(couriers.id, id)).returning();
