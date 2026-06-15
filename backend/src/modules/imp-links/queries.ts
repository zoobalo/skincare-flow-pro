import { db } from "../../db/client.ts";
import { impLinks } from "../../db/schema/imp-links.ts";
import { eq, desc } from "drizzle-orm";

export const getAllImpLinks = (teamId: string) =>
  db.select().from(impLinks).where(eq(impLinks.teamId, teamId)).orderBy(desc(impLinks.createdAt));

export const createImpLink = (data: typeof impLinks.$inferInsert) =>
  db.insert(impLinks).values(data).returning();

export const updateImpLink = (id: string, data: Partial<typeof impLinks.$inferInsert>) =>
  db.update(impLinks).set(data).where(eq(impLinks.id, id)).returning();

export const deleteImpLink = (id: string) =>
  db.delete(impLinks).where(eq(impLinks.id, id)).returning();
