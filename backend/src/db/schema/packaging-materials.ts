import { pgTable, text, integer, numeric, timestamp, date, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const packagingMaterials = pgTable("packaging_materials", {
  id:           text("id").primaryKey(),
  code:         text("code").notNull().unique(),
  name:         text("name").notNull(),
  category:     text("category").notNull(),
  description:    text("description").notNull().default(""),
  specifications: text("specifications").notNull().default(""),
  image:          text("image").notNull().default(""),
  currentStock: integer("current_stock").notNull().default(0),
  mfrStock:     integer("mfr_stock").notNull().default(0),
  minThreshold: integer("min_threshold").notNull().default(0),
  moq:          integer("moq").notNull().default(0),
  leadTimeDays: integer("lead_time_days").notNull().default(30),
  costPerUnit:  numeric("cost_per_unit", { precision: 10, scale: 2 }),
  docsLink:     text("docs_link"),
  teamId:       text("team_id").notNull(),
  createdAt:    timestamp("created_at").defaultNow().notNull(),
  updatedAt:    timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("pm_category_idx").on(t.category),
  index("pm_team_idx").on(t.teamId),
]);

export const pmVendors = pgTable("pm_vendors", {
  id:           text("id").primaryKey(),
  pmId:         text("pm_id").notNull().references(() => packagingMaterials.id, { onDelete: "cascade" }),
  vendorId:     text("vendor_id").notNull(),
  vendorStatus: text("vendor_status").notNull().default("Currently Working"),
  moq:          integer("moq"),
  leadTimeDays: integer("lead_time_days"),
  costPerUnit:  numeric("cost_per_unit", { precision: 10, scale: 2 }),
  notes:        text("notes").notNull().default(""),
  teamId:       text("team_id").notNull(),
}, (t) => [
  index("pm_vendor_pm_idx").on(t.pmId),
]);

export const pmDispatches = pgTable("pm_dispatches", {
  id:              text("id").primaryKey(),
  pmId:            text("pm_id").notNull().references(() => packagingMaterials.id, { onDelete: "cascade" }),
  quantity:        integer("quantity").notNull(),
  dispatchDate:    date("dispatch_date", { mode: "string" }).notNull(),
  from:            text("from").notNull().default(""),
  to:              text("to").notNull().default(""),
  transporterName: text("transporter_name").notNull().default(""),
  vehicleNumber:   text("vehicle_number").notNull().default(""),
  lrNumber:        text("lr_number").notNull().default(""),
  freight:         numeric("freight", { precision: 10, scale: 2 }).notNull().default("0"),
  status:          text("status").notNull().default("Dispatched"),
  notes:           text("notes").notNull().default(""),
  createdAt:       timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("pm_dispatch_pm_idx").on(t.pmId),
]);

export const pmComments = pgTable("pm_comments", {
  id:         text("id").primaryKey(),
  pmId:       text("pm_id").notNull().references(() => packagingMaterials.id, { onDelete: "cascade" }),
  authorId:   text("author_id").notNull(),
  authorName: text("author_name").notNull(),
  text:       text("text").notNull(),
  createdAt:  timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("pm_comment_pm_idx").on(t.pmId),
]);

export const pmLinks = pgTable("pm_links", {
  id:        text("id").primaryKey(),
  pmId:      text("pm_id").notNull().references(() => packagingMaterials.id, { onDelete: "cascade" }),
  title:     text("title").notNull(),
  link:      text("link").notNull(),
  comment:   text("comment").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("pm_link_pm_idx").on(t.pmId),
]);

export const packagingMaterialsRelations = relations(packagingMaterials, ({ many }) => ({
  vendors:   many(pmVendors),
  dispatches: many(pmDispatches),
  comments:  many(pmComments),
  links:     many(pmLinks),
}));

export const pmVendorsRelations = relations(pmVendors, ({ one }) => ({
  pm: one(packagingMaterials, { fields: [pmVendors.pmId], references: [packagingMaterials.id] }),
}));

export const pmDispatchesRelations = relations(pmDispatches, ({ one }) => ({
  pm: one(packagingMaterials, { fields: [pmDispatches.pmId], references: [packagingMaterials.id] }),
}));

export const pmCommentsRelations = relations(pmComments, ({ one }) => ({
  pm: one(packagingMaterials, { fields: [pmComments.pmId], references: [packagingMaterials.id] }),
}));

export const pmLinksRelations = relations(pmLinks, ({ one }) => ({
  pm: one(packagingMaterials, { fields: [pmLinks.pmId], references: [packagingMaterials.id] }),
}));

export type PackagingMaterial    = typeof packagingMaterials.$inferSelect;
export type NewPackagingMaterial = typeof packagingMaterials.$inferInsert;
export type PmVendor             = typeof pmVendors.$inferSelect;
export type PmDispatch           = typeof pmDispatches.$inferSelect;
export type PmComment            = typeof pmComments.$inferSelect;
export type PmLink               = typeof pmLinks.$inferSelect;
