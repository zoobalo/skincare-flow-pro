import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const impLinks = pgTable("imp_links", {
  id:        text("id").primaryKey(),
  name:      text("name").notNull(),
  link:      text("link").notNull(),
  comment:   text("comment"),
  teamId:      text("team_id").notNull(),
  ownerUserId: text("owner_user_id").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type ImpLink = typeof impLinks.$inferSelect;
