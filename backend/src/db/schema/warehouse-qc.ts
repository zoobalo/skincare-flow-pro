import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";

export const warehouseQc = pgTable("warehouse_qc", {
  id:             text("id").primaryKey(),
  teamId:         text("team_id").notNull(),
  qcDate:         text("qc_date").notNull(),
  qcDoneBy:       text("qc_done_by").notNull(),
  qcTypes:        text("qc_types").array().notNull().default([]),
  skuIds:         text("sku_ids").array().notNull().default([]),
  reportText:     text("report_text").notNull().default(""),
  reportImageUrl: text("report_image_url"),
  reportLink:     text("report_link"),
  comment:        text("comment").notNull().default(""),
  createdAt:      timestamp("created_at").defaultNow().notNull(),
  updatedAt:      timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("warehouse_qc_team_idx").on(t.teamId),
  index("warehouse_qc_date_idx").on(t.qcDate),
]);

export type WarehouseQc = typeof warehouseQc.$inferSelect;
