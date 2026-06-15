import { db } from "../../db/client.ts";
import { directory } from "../../db/schema/directory.ts";
import { eq } from "drizzle-orm";

export const getAllDirectory  = (teamId: string) =>
  db.select().from(directory).where(eq(directory.teamId, teamId)).orderBy(directory.category, directory.name);

export const createEntry      = (data: typeof directory.$inferInsert) => db.insert(directory).values(data).returning();

export const updateEntry      = (id: string, data: Partial<typeof directory.$inferInsert>) =>
  db.update(directory).set({ ...data, updatedAt: new Date() }).where(eq(directory.id, id)).returning();

export const deleteEntry      = (id: string) => db.delete(directory).where(eq(directory.id, id)).returning();
