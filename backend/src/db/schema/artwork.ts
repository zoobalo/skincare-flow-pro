import { pgTable, text, integer, timestamp, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { skus } from "./skus.ts";

/**
 * One artwork per (SKU, packaging type) — "Night Knight / Outer Carton".
 *
 * `artworkType` stores the final label: picking "Others" and typing a name
 * stores that name, so display never needs to special-case it.
 */
export const artworkEntries = pgTable("artwork_entries", {
  id:          text("id").primaryKey(),
  skuId:       text("sku_id").notNull().references(() => skus.id, { onDelete: "cascade" }),
  artworkType: text("artwork_type").notNull(),
  teamId:      text("team_id").notNull(),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
  updatedAt:   timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("artwork_entry_team_idx").on(t.teamId),
  index("artwork_entry_sku_idx").on(t.skuId),
]);

/** The printable copy itself: a named section and its data. */
export const artworkSections = pgTable("artwork_sections", {
  id:        text("id").primaryKey(),
  artworkId: text("artwork_id").notNull().references(() => artworkEntries.id, { onDelete: "cascade" }),
  name:      text("name").notNull(),
  data:      text("data").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("artwork_section_artwork_idx").on(t.artworkId),
]);

export const artworkEntriesRelations = relations(artworkEntries, ({ one, many }) => ({
  sku: one(skus, { fields: [artworkEntries.skuId], references: [skus.id] }),
  sections: many(artworkSections),
}));

export const artworkSectionsRelations = relations(artworkSections, ({ one }) => ({
  artwork: one(artworkEntries, { fields: [artworkSections.artworkId], references: [artworkEntries.id] }),
}));

export type ArtworkEntry   = typeof artworkEntries.$inferSelect;
export type ArtworkSection = typeof artworkSections.$inferSelect;
