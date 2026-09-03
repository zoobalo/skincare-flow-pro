import { pgTable, text, integer, timestamp, index } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

/**
 * Central store of printable packaging copy.
 *
 * One row per SKU, holding an ordered list of named sections ("Manufactured by"
 * -> "Derma Goodness Private Limited"). Each section declares which packaging
 * types it belongs on, so a designer working a label sees only label copy.
 *
 * SKU names are free text — deliberately decoupled from the `skus` catalogue,
 * because artwork exists for products before they are catalogued.
 */
export const artworkSkus = pgTable("artwork_skus", {
  id:        text("id").primaryKey(),
  skuName:   text("sku_name").notNull(),
  notes:     text("notes"),
  teamId:    text("team_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("artwork_sku_team_idx").on(t.teamId),
]);

export const artworkSections = pgTable("artwork_sections", {
  id:             text("id").primaryKey(),
  skuId:          text("sku_id").notNull().references(() => artworkSkus.id, { onDelete: "cascade" }),
  name:           text("name").notNull(),
  details:        text("details").notNull().default(""),
  // Packaging types this copy belongs on. Empty = applies to all of them.
  packagingTypes: text("packaging_types").array().notNull().default(sql`ARRAY[]::text[]`),
  sortOrder:      integer("sort_order").notNull().default(0),
  createdAt:      timestamp("created_at").defaultNow().notNull(),
  updatedAt:      timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("artwork_section_sku_idx").on(t.skuId),
]);

/**
 * Reusable sections — the single source of truth for copy that repeats across
 * every product (company name, FSSAI licence, customer care address). Inserted
 * into a SKU as a normal section, then editable there without touching the
 * library entry.
 */
export const artworkLibraryEntries = pgTable("artwork_library_entries", {
  id:             text("id").primaryKey(),
  name:           text("name").notNull(),
  details:        text("details").notNull().default(""),
  packagingTypes: text("packaging_types").array().notNull().default(sql`ARRAY[]::text[]`),
  teamId:         text("team_id").notNull(),
  createdAt:      timestamp("created_at").defaultNow().notNull(),
  updatedAt:      timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("artwork_library_team_idx").on(t.teamId),
]);

export const artworkSkusRelations = relations(artworkSkus, ({ many }) => ({
  sections: many(artworkSections),
}));

export const artworkSectionsRelations = relations(artworkSections, ({ one }) => ({
  sku: one(artworkSkus, { fields: [artworkSections.skuId], references: [artworkSkus.id] }),
}));

export type ArtworkSku          = typeof artworkSkus.$inferSelect;
export type ArtworkSection      = typeof artworkSections.$inferSelect;
export type ArtworkLibraryEntry = typeof artworkLibraryEntries.$inferSelect;
