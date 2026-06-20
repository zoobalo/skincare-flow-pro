import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";

export const skuComments = pgTable("sku_comments", {
  id:         text("id").primaryKey(),
  skuId:      text("sku_id").notNull(),
  comment:    text("comment").notNull(),
  authorName: text("author_name").notNull().default(""),
  createdAt:  timestamp("created_at").defaultNow().notNull(),
  updatedAt:  timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("sku_comments_sku_idx").on(t.skuId),
]);

export type SkuComment = typeof skuComments.$inferSelect;
