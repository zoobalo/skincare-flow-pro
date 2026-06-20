import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";

export const vendorComments = pgTable("vendor_comments", {
  id:         text("id").primaryKey(),
  vendorId:   text("vendor_id").notNull(),
  authorId:   text("author_id").notNull(),
  authorName: text("author_name").notNull(),
  text:       text("text").notNull(),
  createdAt:  timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("vendor_comments_vendor_idx").on(t.vendorId),
]);

export type VendorComment = typeof vendorComments.$inferSelect;
