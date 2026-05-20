import { db } from "../../db/client.ts";
import { npd } from "../../db/schema/npd.ts";
import { eq } from "drizzle-orm";

export const getAllNpd  = () => db.select().from(npd).orderBy(npd.createdAt);
export const createNpd = (data: typeof npd.$inferInsert) => db.insert(npd).values(data).returning();
export const updateNpd = (id: string, data: Partial<typeof npd.$inferInsert>) =>
  db.update(npd).set({ ...data, updatedAt: new Date() }).where(eq(npd.id, id)).returning();
export const deleteNpd = (id: string) => db.delete(npd).where(eq(npd.id, id)).returning();
