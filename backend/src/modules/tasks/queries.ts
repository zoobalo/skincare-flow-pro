import { db } from "../../db/client.ts";
import { tasks } from "../../db/schema/tasks.ts";
import { eq } from "drizzle-orm";

export const getAllTasks = (teamId: string) =>
  db.select().from(tasks).where(eq(tasks.teamId, teamId)).orderBy(tasks.createdAt);

export const createTask = (data: typeof tasks.$inferInsert) =>
  db.insert(tasks).values(data).returning();

export const updateTask = (id: string, data: Partial<typeof tasks.$inferInsert>) =>
  db.update(tasks).set({ ...data, updatedAt: new Date() }).where(eq(tasks.id, id)).returning();

export const deleteTask = (id: string) =>
  db.delete(tasks).where(eq(tasks.id, id)).returning();
