import { pgTable, text, timestamp, date, index } from "drizzle-orm/pg-core";

export const assignedTasks = pgTable("assigned_tasks", {
  id:             text("id").primaryKey(),
  teamId:         text("team_id").notNull(),
  title:          text("title").notNull(),
  comments:       text("comments").notNull().default(""),
  urgency:        text("urgency").notNull().default("Medium"),
  deadlineDate:   date("deadline_date", { mode: "string" }),
  assignedTo:     text("assigned_to").notNull(),
  assignedToName: text("assigned_to_name").notNull(),
  assignedBy:     text("assigned_by").notNull(),
  assignedByName: text("assigned_by_name").notNull(),
  status:         text("status").notNull().default("Pending"),
  createdAt:      timestamp("created_at").defaultNow().notNull(),
  updatedAt:      timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("assigned_tasks_to_idx").on(t.assignedTo),
  index("assigned_tasks_by_idx").on(t.assignedBy),
]);

export type AssignedTask = typeof assignedTasks.$inferSelect;
