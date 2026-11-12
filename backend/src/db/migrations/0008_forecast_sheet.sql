-- Inventory forecast, mirrored from the spreadsheet.
--
-- Additive only. The older weekly-sales and stock-location tables are left
-- untouched: they hold history and appear in the backup export.

create table if not exists forecast_rows (
  id        text primary key,
  team_id   text not null,
  position  integer not null default 0,
  sku_name  text not null,
  sale_d2c      numeric,
  sale_amazon   numeric,
  sale_nykaa    numeric,
  sale_blinkit  numeric,
  sale_zepto    numeric,
  current_inventory numeric,
  open_production   numeric,
  week1 numeric, week2 numeric, week3 numeric, week4 numeric,
  avg_weekly_sale         numeric,
  monthly_sale_rate       numeric,
  daily_sale_rate         numeric,
  stock_sufficiency_days  numeric,
  stock_needed_lead_time  numeric,
  stock_out_date          text not null default '',
  production_trigger_date text not null default '',
  status                  text not null default '',
  suggested_production_qty numeric
);
create index if not exists forecast_rows_team_idx   on forecast_rows (team_id);
create index if not exists forecast_rows_status_idx on forecast_rows (status);

create table if not exists forecast_meta (
  team_id          text primary key,
  report_date      text not null default '',
  month_start      text not null default '',
  current_week     text not null default '',
  lead_time_days   integer,
  trigger_at_days  integer,
  total_to_produce numeric,
  row_count        integer not null default 0,
  imported_at      timestamp not null default now(),
  imported_by_name text not null default ''
);

alter table forecast_rows enable row level security;
alter table forecast_meta enable row level security;
revoke all on forecast_rows from anon, authenticated;
revoke all on forecast_meta from anon, authenticated;
