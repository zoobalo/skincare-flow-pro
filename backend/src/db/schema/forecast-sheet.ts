import { pgTable, text, integer, numeric, timestamp, index } from "drizzle-orm/pg-core";

/**
 * A snapshot of the Inventory Forecast spreadsheet.
 *
 * The sheet does the arithmetic now, so these columns mirror it rather than
 * re-derive anything. The last system computed its own weekly averages from
 * imported rows and disagreed with the sheet people were reading; holding one
 * copy of the numbers removes the question of which is right.
 *
 * Dates arrive as the sheet writes them ("29-Dec-26") and are kept that way,
 * for the same reason.
 */
export const forecastRows = pgTable("forecast_rows", {
  id:       text("id").primaryKey(),
  teamId:   text("team_id").notNull(),
  position: integer("position").notNull().default(0),
  skuName:  text("sku_name").notNull(),

  saleD2c:     numeric("sale_d2c"),
  saleAmazon:  numeric("sale_amazon"),
  saleNykaa:   numeric("sale_nykaa"),
  saleBlinkit: numeric("sale_blinkit"),
  saleZepto:   numeric("sale_zepto"),

  currentInventory: numeric("current_inventory"),
  openProduction:   numeric("open_production"),

  week1: numeric("week1"),
  week2: numeric("week2"),
  week3: numeric("week3"),
  week4: numeric("week4"),

  avgWeeklySale:        numeric("avg_weekly_sale"),
  monthlySaleRate:      numeric("monthly_sale_rate"),
  dailySaleRate:        numeric("daily_sale_rate"),
  stockSufficiencyDays: numeric("stock_sufficiency_days"),
  stockNeededLeadTime:  numeric("stock_needed_lead_time"),

  stockOutDate:          text("stock_out_date").notNull().default(""),
  productionTriggerDate: text("production_trigger_date").notNull().default(""),
  status:                text("status").notNull().default(""),
  suggestedProductionQty: numeric("suggested_production_qty"),
}, (t) => [
  index("forecast_rows_team_idx").on(t.teamId),
  index("forecast_rows_status_idx").on(t.status),
]);

/** What the sheet's banner says about the snapshot as a whole. */
export const forecastMeta = pgTable("forecast_meta", {
  teamId:          text("team_id").primaryKey(),
  reportDate:      text("report_date").notNull().default(""),
  monthStart:      text("month_start").notNull().default(""),
  currentWeek:     text("current_week").notNull().default(""),
  leadTimeDays:    integer("lead_time_days"),
  triggerAtDays:   integer("trigger_at_days"),
  totalToProduce:  numeric("total_to_produce"),
  rowCount:        integer("row_count").notNull().default(0),
  importedAt:      timestamp("imported_at").defaultNow().notNull(),
  importedByName:  text("imported_by_name").notNull().default(""),
});

export type ForecastRow = typeof forecastRows.$inferSelect;
export type ForecastMeta = typeof forecastMeta.$inferSelect;
