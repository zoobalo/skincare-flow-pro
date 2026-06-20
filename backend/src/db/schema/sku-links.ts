import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";

export const skuLinks = pgTable("sku_links", {
  id:        text("id").primaryKey(),
  skuId:     text("sku_id").notNull(),
  title:     text("title").notNull(),
  link:      text("link").notNull(),
  comment:   text("comment").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("sku_links_sku_idx").on(t.skuId),
]);

export type SkuLink = typeof skuLinks.$inferSelect;
