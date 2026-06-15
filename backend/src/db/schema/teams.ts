import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const teams = pgTable("teams", {
  id:         text("id").primaryKey(),
  name:       text("name").notNull(),
  department: text("department").notNull().unique(),
  createdAt:  timestamp("created_at").defaultNow().notNull(),
});

export type Team = typeof teams.$inferSelect;

export const DEPARTMENTS = [
  "skincare",
  "creative",
  "hr",
  "sales",
  "marketing",
  "logistics",
] as const;
export type Department = typeof DEPARTMENTS[number];

export const DEPARTMENT_LABELS: Record<string, string> = {
  skincare:  "Skincare",
  creative:  "Creative",
  hr:        "HR",
  sales:     "Sales",
  marketing: "Marketing",
  logistics: "Logistics",
};
