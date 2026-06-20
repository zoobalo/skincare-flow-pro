import { pgTable, text, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const followUpContacts = pgTable("follow_up_contacts", {
  id:        text("id").primaryKey(),
  name:      text("name").notNull(),
  phone:     text("phone"),
  email:     text("email"),
  notes:     text("notes"),
  teamId:      text("team_id").notNull(),
  ownerUserId: text("owner_user_id").notNull().default(""),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
});

export const followUpTasks = pgTable("follow_up_tasks", {
  id:          text("id").primaryKey(),
  contactId:   text("contact_id").notNull().references(() => followUpContacts.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  done:        boolean("done").notNull().default(false),
  doneAt:      timestamp("done_at"),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("follow_up_task_contact_idx").on(t.contactId),
]);

export const followUpContactsRelations = relations(followUpContacts, ({ many }) => ({
  tasks: many(followUpTasks),
}));

export const followUpTasksRelations = relations(followUpTasks, ({ one }) => ({
  contact: one(followUpContacts, { fields: [followUpTasks.contactId], references: [followUpContacts.id] }),
}));

export type FollowUpContact = typeof followUpContacts.$inferSelect;
export type FollowUpTask    = typeof followUpTasks.$inferSelect;
