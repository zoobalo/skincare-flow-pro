import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const userGrants = pgTable("user_grants", {
  id:            text("id").primaryKey(),
  module:        text("module").notNull(),
  ownerUserId:   text("owner_user_id").notNull(),
  granteeUserId: text("grantee_user_id").notNull(),
  createdBy:     text("created_by").notNull(),
  createdAt:     timestamp("created_at").defaultNow().notNull(),
});
