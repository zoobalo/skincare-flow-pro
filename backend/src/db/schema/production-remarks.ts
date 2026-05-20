import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const REMARK_STATUSES   = ["Active", "Conveyed", "Resolved"] as const;
export const REMARK_MATERIAL_TYPES = ["None", "Packaging Material", "Raw Material"] as const;

export const productionRemarks = pgTable("production_remarks", {
  id:           text("id").primaryKey(),
  skuId:        text("sku_id"),
  materialType: text("material_type").notNull().default("None"),
  remark:       text("remark").notNull(),
  status:       text("status").notNull().default("Active"),
  createdAt:    timestamp("created_at").defaultNow().notNull(),
  updatedAt:    timestamp("updated_at").defaultNow().notNull(),
});
