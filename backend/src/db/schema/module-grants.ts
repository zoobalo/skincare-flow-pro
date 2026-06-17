import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const moduleGrants = pgTable("module_grants", {
  id:            text("id").primaryKey(),
  module:        text("module").notNull(),
  ownerTeamId:   text("owner_team_id").notNull(),
  granteeUserId: text("grantee_user_id").notNull(),
  createdBy:     text("created_by").notNull(),
  createdAt:     timestamp("created_at").defaultNow().notNull(),
});
