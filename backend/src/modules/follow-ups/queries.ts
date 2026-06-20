import { db } from "../../db/client.ts";
import { followUpContacts, followUpTasks } from "../../db/schema/follow-ups.ts";
import { eq } from "drizzle-orm";

export const getAllContacts = (ownerUserId: string) =>
  db.query.followUpContacts.findMany({
    where: (c, { eq }) => eq(c.ownerUserId, ownerUserId),
    orderBy: (c, { asc }) => [asc(c.name)],
    with: {
      tasks: { orderBy: (t, { asc }) => [asc(t.createdAt)] },
    },
  });

export const createContact = (data: typeof followUpContacts.$inferInsert) =>
  db.insert(followUpContacts).values(data).returning();

export const updateContact = (id: string, data: Partial<typeof followUpContacts.$inferInsert>) =>
  db.update(followUpContacts).set(data).where(eq(followUpContacts.id, id)).returning();

export const deleteContact = (id: string) =>
  db.delete(followUpContacts).where(eq(followUpContacts.id, id)).returning();

export const createTask = (data: typeof followUpTasks.$inferInsert) =>
  db.insert(followUpTasks).values(data).returning();

export const updateTask = (id: string, data: Partial<typeof followUpTasks.$inferInsert>) =>
  db.update(followUpTasks).set(data).where(eq(followUpTasks.id, id)).returning();

export const deleteTask = (id: string) =>
  db.delete(followUpTasks).where(eq(followUpTasks.id, id)).returning();
