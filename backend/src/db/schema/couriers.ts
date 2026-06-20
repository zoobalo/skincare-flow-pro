import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const couriers = pgTable("couriers", {
  id:             text("id").primaryKey(),
  name:           text("name").notNull(),
  courierPartner: text("courier_partner").notNull(),
  dispatchDate:   text("dispatch_date").notNull(),
  docketNumber:   text("docket_number").notNull(),
  comment:        text("comment"),
  teamId:         text("team_id").notNull(),
  ownerUserId:    text("owner_user_id").notNull().default(""),
  createdAt:      timestamp("created_at").defaultNow().notNull(),
  updatedAt:      timestamp("updated_at").defaultNow().notNull(),
});

export type Courier = typeof couriers.$inferSelect;
