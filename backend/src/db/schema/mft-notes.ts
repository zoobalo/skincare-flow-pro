import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";

export const mftNotes = pgTable("mft_notes", {
  id:        text("id").primaryKey(),
  skuId:     text("sku_id"),
  date:      text("date").notNull(),       // stored as YYYY-MM-DD string
  notes:     text("notes").notNull(),
  teamId:    text("team_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("mft_notes_sku_idx").on(t.skuId),
]);

export type MftNote = typeof mftNotes.$inferSelect;
