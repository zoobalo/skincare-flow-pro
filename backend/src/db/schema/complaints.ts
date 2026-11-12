import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";

export const complaints = pgTable("complaints", {
  id:          text("id").primaryKey(),
  teamId:      text("team_id").notNull(),
  // "SKU" complaints name the SKU they are about; "General" ones do not.
  kind:        text("kind").notNull().default("General"),
  skuId:       text("sku_id"),
  title:       text("title").notNull(),
  details:     text("details").notNull().default(""),
  against:     text("against").notNull().default(""),
  // "Open" until someone resolves it; there is no third state on purpose.
  status:      text("status").notNull().default("Open"),
  raisedById:  text("raised_by_id").notNull(),
  raisedByName: text("raised_by_name").notNull(),
  resolvedById: text("resolved_by_id"),
  resolvedByName: text("resolved_by_name"),
  resolvedAt:  timestamp("resolved_at"),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
  updatedAt:   timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("complaints_team_idx").on(t.teamId),
  index("complaints_status_idx").on(t.status),
  index("complaints_sku_idx").on(t.skuId),
]);

export const complaintComments = pgTable("complaint_comments", {
  id:          text("id").primaryKey(),
  complaintId: text("complaint_id").notNull(),
  authorId:    text("author_id").notNull(),
  authorName:  text("author_name").notNull(),
  text:        text("text").notNull(),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("complaint_comments_complaint_idx").on(t.complaintId),
]);

export type Complaint = typeof complaints.$inferSelect;
export type ComplaintComment = typeof complaintComments.$inferSelect;
