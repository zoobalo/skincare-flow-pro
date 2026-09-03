import { pgTable, text, integer, timestamp, date, index, unique } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { skus } from "./skus.ts";

/**
 * Units sold per SKU, per week, per sales platform — imported from the weekly
 * sales spreadsheet.
 *
 * Stored per platform rather than pre-summed so channel trends stay available;
 * the forecast simply sums them. `weekEnding` is the Sunday the week closed on,
 * and (sku, week, platform) is unique so re-importing a week corrects it
 * instead of double counting.
 */
export const skuSalesWeekly = pgTable("sku_sales_weekly", {
  id:         text("id").primaryKey(),
  skuId:      text("sku_id").notNull().references(() => skus.id, { onDelete: "cascade" }),
  weekEnding: date("week_ending", { mode: "string" }).notNull(),
  platform:   text("platform").notNull(),
  units:      integer("units").notNull().default(0),
  teamId:     text("team_id").notNull(),
  importedAt:     timestamp("imported_at").defaultNow().notNull(),
  importedByName: text("imported_by_name"),
}, (t) => [
  index("sales_weekly_sku_idx").on(t.skuId),
  index("sales_weekly_week_idx").on(t.weekEnding),
  index("sales_weekly_team_idx").on(t.teamId),
  unique("sales_weekly_unique").on(t.skuId, t.weekEnding, t.platform),
]);

export const skuSalesWeeklyRelations = relations(skuSalesWeekly, ({ one }) => ({
  sku: one(skus, { fields: [skuSalesWeekly.skuId], references: [skus.id] }),
}));

export type SkuSalesWeekly = typeof skuSalesWeekly.$inferSelect;
