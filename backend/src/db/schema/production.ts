import { pgTable, text, integer, boolean, timestamp, date, serial, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { skus } from "./skus.ts";
import { manufacturers } from "./manufacturers.ts";

export const PRODUCTION_STAGES = [
  "PO Generated",
  "Raw Material Ordered",
  "Packaging Ordered",
  "Material Received",
  "Material Sent to Manufacturer",
  "Production Started",
  "Filling Process",
  "Packing Process",
  "QC Approved",
  "Final Dispatch",
  "Warehouse Received",
] as const;

export type ProductionStage = typeof PRODUCTION_STAGES[number];

export const productionBatches = pgTable("production_batches", {
  id:                 text("id").primaryKey(),
  batchNumber:        text("batch_number").notNull().unique(),
  skuId:              text("sku_id").notNull().references(() => skus.id),
  manufacturerId:     text("manufacturer_id").notNull().references(() => manufacturers.id),
  quantity:           integer("quantity").notNull(),
  currentStage:       text("current_stage").notNull().$type<ProductionStage>(),
  startedAt:          date("started_at", { mode: "string" }).notNull(),
  expectedCompletion: date("expected_completion", { mode: "string" }).notNull(),
  delayed:            boolean("delayed").notNull().default(false),
  applicableStages:   jsonb("applicable_stages").$type<string[]>(),
  materialCategory:   text("material_category"),
  materialItemId:     text("material_item_id"),
  materialItemName:   text("material_item_name"),
  comment:            text("comment"),
  createdAt:          timestamp("created_at").defaultNow().notNull(),
  updatedAt:          timestamp("updated_at").defaultNow().notNull(),
});

export const batchStageHistory = pgTable("batch_stage_history", {
  id:      serial("id").primaryKey(),
  batchId: text("batch_id").notNull().references(() => productionBatches.id, { onDelete: "cascade" }),
  stage:   text("stage").notNull().$type<ProductionStage>(),
  date:    date("date", { mode: "string" }).notNull(),
  note:    text("note"),
});

export const productionBatchesRelations = relations(productionBatches, ({ one, many }) => ({
  sku:          one(skus,          { fields: [productionBatches.skuId],          references: [skus.id] }),
  manufacturer: one(manufacturers, { fields: [productionBatches.manufacturerId], references: [manufacturers.id] }),
  stageHistory: many(batchStageHistory),
}));

export const batchStageHistoryRelations = relations(batchStageHistory, ({ one }) => ({
  batch: one(productionBatches, { fields: [batchStageHistory.batchId], references: [productionBatches.id] }),
}));

export type ProductionBatch    = typeof productionBatches.$inferSelect;
export type NewProductionBatch = typeof productionBatches.$inferInsert;
export type BatchStageHistory  = typeof batchStageHistory.$inferSelect;
