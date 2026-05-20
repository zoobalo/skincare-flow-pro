import { pgTable, text, integer, numeric, timestamp, date } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { vendors } from "./vendors.ts";
import { skus } from "./skus.ts";

export const PO_STATUSES = [
  "Pending",
  "Approved",
  "In Production",
  "Dispatched",
  "Delivered",
  "Delayed",
] as const;

export type POStatus = typeof PO_STATUSES[number];

export const purchaseOrders = pgTable("purchase_orders", {
  id:               text("id").primaryKey(),
  poNumber:         text("po_number").notNull().unique(),
  vendorId:         text("vendor_id").notNull().references(() => vendors.id),
  skuId:            text("sku_id").notNull().references(() => skus.id),
  materialType:     text("material_type").notNull(),
  quantity:         integer("quantity").notNull(),
  rate:             numeric("rate", { precision: 10, scale: 2 }).notNull(),
  gstRate:          integer("gst_rate").notNull().default(18),
  gstAmount:        numeric("gst_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  total:            numeric("total", { precision: 14, scale: 2 }).notNull(),
  dispatchDate:     date("dispatch_date", { mode: "string" }).notNull(),
  expectedDelivery: date("expected_delivery", { mode: "string" }).notNull(),
  status:           text("status").notNull().$type<POStatus>(),
  paymentDue:       numeric("payment_due", { precision: 14, scale: 2 }),
  notes:            text("notes"),
  createdAt:        timestamp("created_at").defaultNow().notNull(),
  updatedAt:        timestamp("updated_at").defaultNow().notNull(),
});

export const purchaseOrdersRelations = relations(purchaseOrders, ({ one }) => ({
  vendor: one(vendors, { fields: [purchaseOrders.vendorId], references: [vendors.id] }),
  sku:    one(skus,    { fields: [purchaseOrders.skuId],    references: [skus.id] }),
}));

export type PurchaseOrder    = typeof purchaseOrders.$inferSelect;
export type NewPurchaseOrder = typeof purchaseOrders.$inferInsert;
