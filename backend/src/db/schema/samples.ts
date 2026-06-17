import { pgTable, text, integer, boolean, timestamp, index } from "drizzle-orm/pg-core";

export const samples = pgTable("samples", {
  id:         text("id").primaryKey(),
  personName: text("person_name").notNull(),
  purpose:    text("purpose"),
  comment:    text("comment"),
  teamId:     text("team_id").notNull(),
  createdAt:  timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("samples_team_idx").on(t.teamId),
]);

export const sampleProducts = pgTable("sample_products", {
  id:          text("id").primaryKey(),
  sampleId:    text("sample_id").notNull(),
  productName: text("product_name").notNull(),
  quantity:    integer("quantity").notNull().default(1),
  returned:    boolean("returned").notNull().default(false),
  returnedAt:  timestamp("returned_at"),
  teamId:      text("team_id").notNull(),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("sample_products_sample_idx").on(t.sampleId),
]);

export type Sample = typeof samples.$inferSelect;
export type SampleProduct = typeof sampleProducts.$inferSelect;
