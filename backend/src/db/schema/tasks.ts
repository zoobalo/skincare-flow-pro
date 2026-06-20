import { pgTable, text, timestamp, date, index } from "drizzle-orm/pg-core";

export const TASK_STATUSES  = ["None", "Initiated", "Done"] as const;
export const TASK_URGENCIES = ["Low", "Medium", "High", "Very High"] as const;
export const TASK_PRODUCT_TYPES = ["None", "Packaging Material", "Raw Material"] as const;

export type TaskStatus      = typeof TASK_STATUSES[number];
export type TaskUrgency     = typeof TASK_URGENCIES[number];
export type TaskProductType = typeof TASK_PRODUCT_TYPES[number];

export const tasks = pgTable("tasks", {
  id:          text("id").primaryKey(),
  title:       text("title").notNull(),
  comments:    text("comments").notNull().default(""),
  status:      text("status").notNull().$type<TaskStatus>().default("None"),
  urgency:     text("urgency").notNull().$type<TaskUrgency>().default("Medium"),
  skuId:       text("sku_id"),
  productType: text("product_type").$type<TaskProductType>().default("None"),
  deadlineDate: date("deadline_date", { mode: "string" }),
  teamId:      text("team_id").notNull(),
  ownerUserId: text("owner_user_id").notNull().default(""),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
  updatedAt:   timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("task_status_idx").on(t.status),
  index("task_urgency_idx").on(t.urgency),
]);

export type Task    = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
