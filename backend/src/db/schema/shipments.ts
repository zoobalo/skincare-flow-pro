import { pgTable, text, numeric, timestamp, date, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { purchaseOrders } from "./purchase-orders.ts";

export const SHIPMENT_STATUSES = ["In Transit", "Delivered", "Delayed", "Loading"] as const;
export type ShipmentStatus = typeof SHIPMENT_STATUSES[number];

export const shipments = pgTable("shipments", {
  id:               text("id").primaryKey(),
  lrNumber:         text("lr_number").notNull(),
  transporter:      text("transporter").notNull(),
  driverName:       text("driver_name").notNull(),
  vehicleNumber:    text("vehicle_number").notNull(),
  origin:           text("origin").notNull(),
  destination:      text("destination").notNull(),
  pickupDate:       date("pickup_date", { mode: "string" }).notNull(),
  expectedDelivery: date("expected_delivery", { mode: "string" }).notNull(),
  currentLocation:  text("current_location").notNull().default(""),
  freightCost:      numeric("freight_cost", { precision: 10, scale: 2 }).notNull(),
  status:           text("status").notNull().$type<ShipmentStatus>(),
  linkedPoNumber:   text("linked_po_number").references(() => purchaseOrders.poNumber),
  teamId:        text("team_id").notNull(),
  createdAt:        timestamp("created_at").defaultNow().notNull(),
  updatedAt:        timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("shipment_status_idx").on(t.status),
  index("shipment_po_idx").on(t.linkedPoNumber),
]);

export const shipmentsRelations = relations(shipments, ({ one }) => ({
  purchaseOrder: one(purchaseOrders, {
    fields:     [shipments.linkedPoNumber],
    references: [purchaseOrders.poNumber],
  }),
}));

export type Shipment    = typeof shipments.$inferSelect;
export type NewShipment = typeof shipments.$inferInsert;
