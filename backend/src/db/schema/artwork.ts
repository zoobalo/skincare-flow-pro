import { pgTable, text, integer, timestamp, index, unique } from "drizzle-orm/pg-core";
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

/**
 * Artwork files, one row per stage. Kept apart from the entry so each link
 * carries its own author and timestamp, and is saved on its own.
 *
 * `updatedByName` is null only for links migrated from the earlier columns,
 * where the author was never recorded.
 */
export const artworkLinks = pgTable("artwork_links", {
  id:            text("id").primaryKey(),
  artworkId:     text("artwork_id").notNull().references(() => artworkEntries.id, { onDelete: "cascade" }),
  kind:          text("kind").notNull(),
  url:           text("url").notNull(),
  updatedById:   text("updated_by_id"),
  updatedByName: text("updated_by_name"),
  updatedAt:     timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("artwork_link_artwork_idx").on(t.artworkId),
  unique("artwork_link_kind_unique").on(t.artworkId, t.kind),
]);

/**
 * Running notes of what to change in the next production run — a thread per
 * artwork. Author is stamped from the request token, never the client.
 */
export const artworkProductionNotes = pgTable("artwork_production_notes", {
  id:         text("id").primaryKey(),
  artworkId:  text("artwork_id").notNull().references(() => artworkEntries.id, { onDelete: "cascade" }),
  text:       text("text").notNull(),
  authorId:   text("author_id"),
  authorName: text("author_name"),
  createdAt:  timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("artwork_note_artwork_idx").on(t.artworkId),
]);

export const artworkEntriesRelations = relations(artworkEntries, ({ one, many }) => ({
  sku: one(skus, { fields: [artworkEntries.skuId], references: [skus.id] }),
  sections: many(artworkSections),
  links: many(artworkLinks),
  productionNotes: many(artworkProductionNotes),
}));

export const artworkLinksRelations = relations(artworkLinks, ({ one }) => ({
  artwork: one(artworkEntries, { fields: [artworkLinks.artworkId], references: [artworkEntries.id] }),
}));

export const artworkProductionNotesRelations = relations(artworkProductionNotes, ({ one }) => ({
  artwork: one(artworkEntries, { fields: [artworkProductionNotes.artworkId], references: [artworkEntries.id] }),
}));

export const artworkSectionsRelations = relations(artworkSections, ({ one }) => ({
  artwork: one(artworkEntries, { fields: [artworkSections.artworkId], references: [artworkEntries.id] }),
}));

export type ArtworkEntry   = typeof artworkEntries.$inferSelect;
export type ArtworkSection = typeof artworkSections.$inferSelect;
export type ArtworkLink    = typeof artworkLinks.$inferSelect;
export type ArtworkProductionNote = typeof artworkProductionNotes.$inferSelect;
