import { pgTable, text, integer, numeric, timestamp, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { skus } from "./skus.ts";
import { purchaseOrders } from "./purchase-orders.ts";

export const vendors = pgTable("vendors", {
  id:            text("id").primaryKey(),
  name:          text("name").notNull(),
  contactPerson: text("contact_person").notNull(),
  mobile:        text("mobile").notNull(),
  email:         text("email").notNull(),
  gst:           text("gst").notNull(),
  pan:           text("pan"),
  address:       text("address").notNull(),
  city:          text("city").notNull(),
  materials:     text("materials").array().notNull().default([]),
  leadTimeDays:  integer("lead_time_days").notNull(),
  paymentTerms:  text("payment_terms").notNull(),
  rating:        numeric("rating", { precision: 3, scale: 2 }).notNull(),
  reliability:   integer("reliability").notNull(),
  delayPercent:  integer("delay_percent").notNull(),
  totalOrders:   integer("total_orders").notNull().default(0),
  runningOrders: integer("running_orders").notNull().default(0),
  totalSpend:    numeric("total_spend", { precision: 14, scale: 2 }).notNull().default("0"),
  contacts:      jsonb("contacts").$type<Contact[]>().notNull().default([]),
  teamId:        text("team_id").notNull(),
  createdAt:     timestamp("created_at").defaultNow().notNull(),
  updatedAt:     timestamp("updated_at").defaultNow().notNull(),
});

export const vendorsRelations = relations(vendors, ({ many }) => ({
  purchaseOrders: many(purchaseOrders),
}));

export type Contact = { department: string; name: string; mobile: string; email: string };
export type Vendor    = typeof vendors.$inferSelect;
export type NewVendor = typeof vendors.$inferInsert;
