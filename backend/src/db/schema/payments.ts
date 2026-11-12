import { pgTable, text, integer, date, timestamp, index, unique } from "drizzle-orm/pg-core";

/**
 * Credit days agreed with one supplier. Kept apart from `vendors` and
 * `manufacturers` because a payment term belongs to the paying relationship,
 * and the same table has to serve both kinds of party.
 */
export const paymentTerms = pgTable("payment_terms", {
  id:         text("id").primaryKey(),
  teamId:     text("team_id").notNull(),
  partyType:  text("party_type").notNull(),        // "Vendor" | "Manufacturer"
  partyId:    text("party_id").notNull(),
  creditDays: integer("credit_days").notNull().default(0),
  updatedAt:  timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  unique("payment_terms_party_uq").on(t.teamId, t.partyType, t.partyId),
  index("payment_terms_team_idx").on(t.teamId),
]);

/**
 * An invoice booked for payment.
 *
 * dueDays is copied from the party's credit days when the invoice is booked,
 * not read through at display time: a term renegotiated in March must not
 * silently move the due date of an invoice booked in January.
 */
export const paymentInvoices = pgTable("payment_invoices", {
  id:            text("id").primaryKey(),
  teamId:        text("team_id").notNull(),
  partyType:     text("party_type").notNull(),
  partyId:       text("party_id").notNull(),
  invoiceNumber: text("invoice_number").notNull(),
  invoiceDate:   date("invoice_date", { mode: "string" }),
  dueDays:       integer("due_days").notNull().default(0),
  coaStatus:     text("coa_status").notNull().default("Not Received"), // Received | Not Received
  internalQc:    text("internal_qc").notNull().default("Pending"),   // Done | Pending
  externalQc:    text("external_qc").notNull().default("Pending"),   // Done | Pending
  finalStatus:   text("final_status").notNull().default("Stop"),     // Go | Stop
  paymentStatus: text("payment_status").notNull().default("Pending"),
  comments:      text("comments").notNull().default(""),
  createdById:   text("created_by_id").notNull().default(""),
  createdByName: text("created_by_name").notNull().default(""),
  createdAt:     timestamp("created_at").defaultNow().notNull(),
  updatedAt:     timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("payment_invoices_team_idx").on(t.teamId),
  index("payment_invoices_status_idx").on(t.paymentStatus),
  index("payment_invoices_party_idx").on(t.partyId),
]);

export type PaymentTerm = typeof paymentTerms.$inferSelect;
export type PaymentInvoice = typeof paymentInvoices.$inferSelect;
