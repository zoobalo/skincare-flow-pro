import { pgTable, text, integer, numeric, timestamp, jsonb } from "drizzle-orm/pg-core";
import type { Contact } from "./vendors.ts";
import { relations } from "drizzle-orm";
import { skus } from "./skus.ts";
import { productionBatches } from "./production.ts";

export const manufacturers = pgTable("manufacturers", {
  id:               text("id").primaryKey(),
  name:             text("name").notNull(),
  location:         text("location").notNull(),
  city:             text("city").notNull().default(""),
  email:            text("email").notNull().default(""),
  gst:              text("gst").notNull().default(""),
  pan:              text("pan"),
  contactPerson:    text("contact_person").notNull(),
  mobile:           text("mobile").notNull(),
  capacityPerMonth: integer("capacity_per_month").notNull(),
  activeBatches:    integer("active_batches").notNull().default(0),
  qcPassRate:       numeric("qc_pass_rate", { precision: 5, scale: 2 }).notNull(),
  leadTimeDays:     integer("lead_time_days").notNull().default(30),
  paymentTerms:     text("payment_terms").notNull().default("Net 30"),
  rating:           numeric("rating", { precision: 3, scale: 1 }).notNull().default("4.0"),
  reliability:      integer("reliability").notNull().default(90),
  delayPercent:     integer("delay_percent").notNull().default(5),
  contacts:         jsonb("contacts").$type<Contact[]>().notNull().default([]),
  teamId:           text("team_id").notNull(),
  createdAt:        timestamp("created_at").defaultNow().notNull(),
});

export const manufacturersRelations = relations(manufacturers, ({ many }) => ({
  skus:              many(skus),
  productionBatches: many(productionBatches),
}));

export type Manufacturer    = typeof manufacturers.$inferSelect;
export type NewManufacturer = typeof manufacturers.$inferInsert;
