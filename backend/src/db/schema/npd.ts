import { pgTable, text, timestamp, jsonb } from "drizzle-orm/pg-core";

export type NpdImageGroup = { name: string; images: string[]; comment: string };

export const npd = pgTable("npd", {
  id:          text("id").primaryKey(),
  name:        text("name").notNull(),
  launchMonth: text("launch_month"),
  rmStatus:    text("rm_status").notNull().default(""),
  pmStatus:    text("pm_status").notNull().default(""),
  images:      jsonb("images").$type<NpdImageGroup[]>().default([]),
  comments:    text("comments").notNull().default(""),
  teamId:      text("team_id").notNull(),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
  updatedAt:   timestamp("updated_at").defaultNow().notNull(),
});

export type Npd    = typeof npd.$inferSelect;
export type NewNpd = typeof npd.$inferInsert;
