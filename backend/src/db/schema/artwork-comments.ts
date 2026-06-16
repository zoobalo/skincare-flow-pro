import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";

export const artworkComments = pgTable("artwork_comments", {
  id:         text("id").primaryKey(),
  artworkId:  text("artwork_id").notNull(),
  text:       text("text").notNull(),
  authorName: text("author_name").notNull(),
  teamId:     text("team_id").notNull(),
  createdAt:  timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("artwork_comments_artwork_idx").on(t.artworkId),
]);

export type ArtworkComment = typeof artworkComments.$inferSelect;
