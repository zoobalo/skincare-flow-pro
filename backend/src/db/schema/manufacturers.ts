import { pgTable, text, integer, numeric, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { skus } from "./skus.ts";
import { productionBatches } from "./production.ts";

export const manufacturers = pgTable("manufacturers", {
  id:               text("id").primaryKey(),
  name:             text("name").notNull(),
  location:         text("location").notNull(),
  contactPerson:    text("contact_person").notNull(),
  mobile:           text("mobile").notNull(),
  capacityPerMonth: integer("capacity_per_month").notNull(),
  activeBatches:    integer("active_batches").notNull().default(0),
  qcPassRate:       numeric("qc_pass_rate", { precision: 5, scale: 2 }).notNull(),
  createdAt:        timestamp("created_at").defaultNow().notNull(),
});

export const manufacturersRelations = relations(manufacturers, ({ many }) => ({
  skus:              many(skus),
  productionBatches: many(productionBatches),
}));

export type Manufacturer    = typeof manufacturers.$inferSelect;
export type NewManufacturer = typeof manufacturers.$inferInsert;
