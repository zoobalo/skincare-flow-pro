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
  "sales",
  "marketing",
  "crm",
  "creative",
  "hr",
  "finance",
  "logistics",
  "d2c",
] as const;
export type Department = typeof DEPARTMENTS[number];

export const DEPARTMENT_LABELS: Record<string, string> = {
  skincare:  "Procurement and Operations",
  sales:     "Sales",
  marketing: "Marketing",
  crm:       "CRM",
  creative:  "Creative Department",
  hr:        "HR",
  finance:   "Finance",
  logistics: "Logistics and Inventory",
  d2c:       "D2C",
};
