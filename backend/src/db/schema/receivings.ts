import { pgTable, text, numeric, date, timestamp, index } from "drizzle-orm/pg-core";

/**
 * A shipment received at a warehouse from a manufacturer or supplier.
 *
 * skuName and partyName are free text, not references. Of the 85 product
 * names and 15 parties in the sheet this replaces, only 5 and 8 respectively
 * match the catalogue — packaging, refills, Nepal variants and couriers are
 * all received here but are not SKUs. The form suggests known names without
 * insisting on them.
 *
 * mfgDate and expDate are text because the sheet records them by month
 * ("Mar-28"), which is how the cartons are printed.
 */
export const receivings = pgTable("receivings", {
  id:            text("id").primaryKey(),
  teamId:        text("team_id").notNull(),

  skuName:       text("sku_name").notNull(),
  partyName:     text("party_name").notNull(),
  batchNo:       text("batch_no").notNull().default(""),
  receivedQty:   numeric("received_qty"),
  receivedDate:  date("received_date", { mode: "string" }),

  poNumber:      text("po_number").notNull().default(""),
  poDate:        date("po_date", { mode: "string" }),
  poQty:         numeric("po_qty"),

  invoiceNumber: text("invoice_number").notNull().default(""),
  invoiceDate:   date("invoice_date", { mode: "string" }),
  invoiceQty:    numeric("invoice_qty"),

  mfgDate:       text("mfg_date").notNull().default(""),
  expDate:       text("exp_date").notNull().default(""),
  mrp:           numeric("mrp"),

  // Nothing has arrived yet when a line is first written down.
  coaStatus:     text("coa_status").notNull().default("Not Received"),
  grnStatus:     text("grn_status").notNull().default("Not Received"),
  invoiceStatus: text("invoice_status").notNull().default("Not Received"),
  qc:            text("qc").notNull().default("Pending"),
  finalStatus:   text("final_status").notNull().default("Pending"),
  comments:      text("comments").notNull().default(""),

  createdById:   text("created_by_id").notNull().default(""),
  createdByName: text("created_by_name").notNull().default(""),
  createdAt:     timestamp("created_at").defaultNow().notNull(),
  updatedAt:     timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("receivings_team_idx").on(t.teamId),
  index("receivings_date_idx").on(t.receivedDate),
  index("receivings_party_idx").on(t.partyName),
]);

export type Receiving = typeof receivings.$inferSelect;
