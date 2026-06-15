import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const USER_ROLES = ["Admin", "Manager"] as const;
export type UserRole = typeof USER_ROLES[number];

export const users = pgTable("users", {
  id:           text("id").primaryKey(),
  name:         text("name").notNull(),
  email:        text("email").notNull().unique(),
  role:         text("role").notNull().$type<UserRole>().default("Manager"),
  status:       text("status").notNull().default("Active"),
  passwordHash: text("password_hash").notNull().default(""),
  teamId:       text("team_id").notNull(),
  department:   text("department").notNull(),
  createdAt:    timestamp("created_at").defaultNow().notNull(),
  updatedAt:    timestamp("updated_at").defaultNow().notNull(),
});

export type User    = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
