import { pgTable, text, integer, numeric, timestamp, date, boolean, index } from "drizzle-orm/pg-core";
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
  mrp:                   numeric("mrp", { precision: 10, scale: 2 }),
  usp:                   text("usp").notNull().default(""),
  importantLinks:        text("important_links").notNull().default("[]"),
  teamId:                text("team_id").notNull(),
  createdAt:             timestamp("created_at").defaultNow().notNull(),
  updatedAt:             timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("sku_manufacturer_idx").on(t.manufacturerId),
  index("sku_category_idx").on(t.category),
]);

export const packagingItems = pgTable("packaging_items", {
  id:               text("id").primaryKey(),
  skuId:            text("sku_id").notNull().references(() => skus.id, { onDelete: "cascade" }),
  name:             text("name").notNull(),
  vendorId:         text("vendor_id").notNull(),
  vendorStatus:     text("vendor_status").notNull().default("Currently Working"),
  moq:              integer("moq").notNull(),
  leadTimeDays:     integer("lead_time_days").notNull(),
  currentStock:     integer("current_stock").notNull().default(0),
  mfrStock:         integer("mfr_stock").notNull().default(0),
  otherStock:       integer("other_stock").notNull().default(0),
  transitStock:         integer("transit_stock").notNull().default(0),
  transitDeliveryDate:  date("transit_delivery_date", { mode: "string" }),
  costPerUnit:          numeric("cost_per_unit", { precision: 10, scale: 2 }).notNull(),
  lastPurchaseDate:     date("last_purchase_date", { mode: "string" }),
  teamId:               text("team_id").notNull(),
}, (t) => [
  index("packaging_sku_idx").on(t.skuId),
]);

export const skuRawMaterials = pgTable("sku_raw_materials", {
  id:          text("id").primaryKey(),
  skuId:       text("sku_id").notNull().references(() => skus.id, { onDelete: "cascade" }),
  name:        text("name").notNull(),
  vendorId:    text("vendor_id").notNull(),
  vendorStatus: text("vendor_status").notNull().default("Currently Working"),
  qtyPerUnit:  numeric("qty_per_unit", { precision: 10, scale: 4 }).notNull(),
  unit:        text("unit").notNull(),
  currentStock: numeric("current_stock", { precision: 12, scale: 4 }).notNull().default("0"),
  costPerUnit: numeric("cost_per_unit", { precision: 10, scale: 2 }).notNull(),
}, (t) => [
  index("raw_material_sku_idx").on(t.skuId),
]);

export const skuDispatches = pgTable("sku_dispatches", {
  id:               text("id").primaryKey(),
  skuId:            text("sku_id").notNull().references(() => skus.id, { onDelete: "cascade" }),
  goodsType:        text("goods_type").notNull().default("Final Goods"),
  goodsName:        text("goods_name").notNull().default(""),
  quantity:         integer("quantity").notNull(),
  dispatchDate:     date("dispatch_date", { mode: "string" }).notNull(),
  from:             text("from").notNull().default(""),
  to:               text("to").notNull().default(""),
  transporterName:  text("transporter_name").notNull().default(""),
  vehicleNumber:    text("vehicle_number").notNull().default(""),
  lrNumber:         text("lr_number").notNull().default(""),
  freight:          numeric("freight", { precision: 10, scale: 2 }).notNull().default("0"),
  status:           text("status").notNull().default("Dispatched"),
  notes:            text("notes").notNull().default(""),
  batchNumber:          text("batch_number"),
  coaLink:              text("coa_link"),
  invoiceNumber:        text("invoice_number"),
  invoiceLink:          text("invoice_link"),
  qcStatus:             text("qc_status"),
  batchNumbers:         text("batch_numbers").notNull().default("[]"),
  coaReceived:          boolean("coa_received").notNull().default(false),
  coaUploaded:          boolean("coa_uploaded").notNull().default(false),
  invoiceReceived:      boolean("invoice_received").notNull().default(false),
  invoiceUploaded:      boolean("invoice_uploaded").notNull().default(false),
  grnReceived:          boolean("grn_received").notNull().default(false),
  grnUploaded:          boolean("grn_uploaded").notNull().default(false),
  warehouseQcReceived:  boolean("warehouse_qc_received").notNull().default(false),
  warehouseQcUploaded:  boolean("warehouse_qc_uploaded").notNull().default(false),
  officeExtQcReceived:  boolean("office_ext_qc_received").notNull().default(false),
  officeExtQcUploaded:  boolean("office_ext_qc_uploaded").notNull().default(false),
  officeIntQcReceived:  boolean("office_int_qc_received").notNull().default(false),
  officeIntQcUploaded:  boolean("office_int_qc_uploaded").notNull().default(false),
  otherQcReceived:      boolean("other_qc_received").notNull().default(false),
  otherQcUploaded:      boolean("other_qc_uploaded").notNull().default(false),
  createdAt:            timestamp("created_at").defaultNow().notNull(),
  updatedAt:            timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("dispatch_sku_idx").on(t.skuId),
]);

export const skuInventoryLocations = pgTable("sku_inventory_locations", {
  id:        text("id").primaryKey(),
  skuId:     text("sku_id").notNull().references(() => skus.id, { onDelete: "cascade" }),
  name:      text("name").notNull(),
  quantity:  integer("quantity").notNull().default(0),
  teamId:    text("team_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("inventory_loc_sku_idx").on(t.skuId),
]);

export const skuTests = pgTable("sku_tests", {
  id:         text("id").primaryKey(),
  skuId:      text("sku_id").notNull().references(() => skus.id, { onDelete: "cascade" }),
  testName:   text("test_name").notNull(),
  result:     text("result").notNull().default(""),
  createdAt:  timestamp("created_at").defaultNow().notNull(),
  updatedAt:  timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("test_sku_idx").on(t.skuId),
]);

export const skusRelations = relations(skus, ({ one, many }) => ({
  manufacturer:       one(manufacturers, { fields: [skus.manufacturerId], references: [manufacturers.id] }),
  packaging:          many(packagingItems),
  rawMaterials:       many(skuRawMaterials),
  tests:              many(skuTests),
  dispatches:         many(skuDispatches),
  purchaseOrders:     many(purchaseOrders),
  productionBatches:  many(productionBatches),
  inventoryLocations: many(skuInventoryLocations),
}));

export const skuInventoryLocationsRelations = relations(skuInventoryLocations, ({ one }) => ({
  sku: one(skus, { fields: [skuInventoryLocations.skuId], references: [skus.id] }),
}));

export const packagingItemsRelations = relations(packagingItems, ({ one }) => ({
  sku: one(skus, { fields: [packagingItems.skuId], references: [skus.id] }),
}));

export const skuRawMaterialsRelations = relations(skuRawMaterials, ({ one }) => ({
  sku: one(skus, { fields: [skuRawMaterials.skuId], references: [skus.id] }),
}));

export const skuTestsRelations = relations(skuTests, ({ one }) => ({
  sku: one(skus, { fields: [skuTests.skuId], references: [skus.id] }),
}));

export const skuDispatchesRelations = relations(skuDispatches, ({ one }) => ({
  sku: one(skus, { fields: [skuDispatches.skuId], references: [skus.id] }),
}));

export type SKU            = typeof skus.$inferSelect;
export type NewSKU         = typeof skus.$inferInsert;
export type PackagingItem  = typeof packagingItems.$inferSelect;
export type NewPackagingItem = typeof packagingItems.$inferInsert;
export type RawMaterial    = typeof skuRawMaterials.$inferSelect;
export type NewRawMaterial = typeof skuRawMaterials.$inferInsert;
