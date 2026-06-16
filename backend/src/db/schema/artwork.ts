import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";

export const artworkItems = pgTable("artwork_items", {
  id:              text("id").primaryKey(),
  skuName:         text("sku_name").notNull(),
  artworkType:     text("artwork_type").notNull(),
  imageUrl:        text("image_url"),
  statusRemark:    text("status_remark"),
  statusUpdatedAt: timestamp("status_updated_at"),
  comment:         text("comment"),
  fileLink:        text("file_link"),
  teamId:          text("team_id").notNull(),
  createdAt:       timestamp("created_at").defaultNow().notNull(),
  updatedAt:       timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("artwork_sku_idx").on(t.skuName),
]);

export type ArtworkItem = typeof artworkItems.$inferSelect;
