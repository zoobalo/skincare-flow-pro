import { pgTable, text, integer, numeric, timestamp, date } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { manufacturers } from "./manufacturers.ts";
import { purchaseOrders } from "./purchase-orders.ts";
import { productionBatches } from "./production.ts";

export const skus = pgTable("skus", {
  id:                    text("id").primaryKey(),
  code:                  text("code").notNull().unique(),
  name:                  text("name").notNull(),
  category:              text("category").notNull(),
  type:                  text("type").notNull(),
  description:           text("description").notNull().default(""),
  image:                 text("image").notNull().default(""),
  manufacturerId:        text("manufacturer_id").notNull().references(() => manufacturers.id),
  currentInventory:      integer("current_inventory").notNull().default(0),
  minThreshold:          integer("min_threshold").notNull().default(0),
  productionTimelineDays: integer("production_timeline_days").notNull().default(30),
  createdAt:             timestamp("created_at").defaultNow().notNull(),
  updatedAt:             timestamp("updated_at").defaultNow().notNull(),
});

export const packagingItems = pgTable("packaging_items", {
  id:               text("id").primaryKey(),
  skuId:            text("sku_id").notNull().references(() => skus.id, { onDelete: "cascade" }),
  name:             text("name").notNull(),
  vendorId:         text("vendor_id").notNull(),
  moq:              integer("moq").notNull(),
  leadTimeDays:     integer("lead_time_days").notNull(),
  currentStock:     integer("current_stock").notNull().default(0),
  transitStock:         integer("transit_stock").notNull().default(0),
  transitDeliveryDate:  date("transit_delivery_date", { mode: "string" }),
  costPerUnit:          numeric("cost_per_unit", { precision: 10, scale: 2 }).notNull(),
  lastPurchaseDate:     date("last_purchase_date", { mode: "string" }),
});

export const skuRawMaterials = pgTable("sku_raw_materials", {
  id:          text("id").primaryKey(),
  skuId:       text("sku_id").notNull().references(() => skus.id, { onDelete: "cascade" }),
  name:        text("name").notNull(),
  vendorId:    text("vendor_id").notNull(),
  qtyPerUnit:  numeric("qty_per_unit", { precision: 10, scale: 4 }).notNull(),
  unit:        text("unit").notNull(),
  currentStock: numeric("current_stock", { precision: 12, scale: 4 }).notNull().default("0"),
  costPerUnit: numeric("cost_per_unit", { precision: 10, scale: 2 }).notNull(),
});

export const skusRelations = relations(skus, ({ one, many }) => ({
  manufacturer:    one(manufacturers, { fields: [skus.manufacturerId], references: [manufacturers.id] }),
  packaging:       many(packagingItems),
  rawMaterials:    many(skuRawMaterials),
  purchaseOrders:  many(purchaseOrders),
  productionBatches: many(productionBatches),
}));

export const packagingItemsRelations = relations(packagingItems, ({ one }) => ({
  sku: one(skus, { fields: [packagingItems.skuId], references: [skus.id] }),
}));

export const skuRawMaterialsRelations = relations(skuRawMaterials, ({ one }) => ({
  sku: one(skus, { fields: [skuRawMaterials.skuId], references: [skus.id] }),
}));

export type SKU            = typeof skus.$inferSelect;
export type NewSKU         = typeof skus.$inferInsert;
export type PackagingItem  = typeof packagingItems.$inferSelect;
export type NewPackagingItem = typeof packagingItems.$inferInsert;
export type RawMaterial    = typeof skuRawMaterials.$inferSelect;
export type NewRawMaterial = typeof skuRawMaterials.$inferInsert;
