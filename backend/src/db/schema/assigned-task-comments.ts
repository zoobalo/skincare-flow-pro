import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";

export const assignedTaskComments = pgTable("assigned_task_comments", {
  id:         text("id").primaryKey(),
  taskId:     text("task_id").notNull(),
  authorId:   text("author_id").notNull(),
  authorName: text("author_name").notNull(),
  text:       text("text").notNull(),
  createdAt:  timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("atc_task_idx").on(t.taskId),
]);

export type AssignedTaskComment = typeof assignedTaskComments.$inferSelect;
