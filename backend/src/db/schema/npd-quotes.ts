import { pgTable, text, timestamp, numeric, index, unique } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { npd } from "./npd.ts";

/**
 * A request for quotations against one NPD, for either raw material or
 * packaging material.
 *
 * `token` is the secret in the public URL. One request per kind per NPD, so a
 * single link can be sent to every vendor being asked to quote; each identifies
 * itself by party name on the form.
 */
export const npdQuoteRequests = pgTable("npd_quote_requests", {
  id:        text("id").primaryKey(),
  npdId:     text("npd_id").notNull().references(() => npd.id, { onDelete: "cascade" }),
  kind:      text("kind").notNull(),                 // 'RM' | 'PM'
  token:     text("token").notNull().unique(),
  brief:     text("brief").notNull().default(""),    // our requirements, shown to vendors
  status:    text("status").notNull().default("open"), // 'open' | 'closed'
  teamId:    text("team_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("npd_quote_request_npd_idx").on(t.npdId),
  unique("npd_quote_request_kind_unique").on(t.npdId, t.kind),
]);

/** One vendor's submission against a request. */
export const npdQuotes = pgTable("npd_quotes", {
  id:          text("id").primaryKey(),
  requestId:   text("request_id").notNull().references(() => npdQuoteRequests.id, { onDelete: "cascade" }),
  partyName:   text("party_name").notNull(),
  leadTime:    text("lead_time").notNull().default(""),
  cost:        numeric("cost", { precision: 12, scale: 2 }),
  description: text("description").notNull().default(""),
  // Packaging quotes may attach reference images; empty for raw material.
  images:      text("images").array().notNull().default(sql`ARRAY[]::text[]`),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
}, (t) => [
  index("npd_quote_request_idx").on(t.requestId),
]);

export const npdQuoteRequestsRelations = relations(npdQuoteRequests, ({ one, many }) => ({
  npd: one(npd, { fields: [npdQuoteRequests.npdId], references: [npd.id] }),
  quotes: many(npdQuotes),
}));

export const npdQuotesRelations = relations(npdQuotes, ({ one }) => ({
  request: one(npdQuoteRequests, { fields: [npdQuotes.requestId], references: [npdQuoteRequests.id] }),
}));

export type NpdQuoteRequest = typeof npdQuoteRequests.$inferSelect;
export type NpdQuote        = typeof npdQuotes.$inferSelect;
