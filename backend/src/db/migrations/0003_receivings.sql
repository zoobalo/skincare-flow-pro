-- Goods received at the warehouses, replacing the receiving spreadsheet.
--
-- Additive only: one new table and its indexes.

create table if not exists receivings (
  id              text primary key,
  team_id         text not null,
  sku_name        text not null,
  party_name      text not null,
  batch_no        text not null default '',
  received_qty    numeric,
  received_date   date,
  po_number       text not null default '',
  po_date         date,
  po_qty          numeric,
  invoice_number  text not null default '',
  invoice_date    date,
  invoice_qty     numeric,
  mfg_date        text not null default '',
  exp_date        text not null default '',
  mrp             numeric,
  coa_status      text not null default 'Pending',
  qc              text not null default 'Pending',
  final_status    text not null default 'Pending',
  comments        text not null default '',
  created_by_id   text not null default '',
  created_by_name text not null default '',
  created_at      timestamp not null default now(),
  updated_at      timestamp not null default now()
);
create index if not exists receivings_team_idx  on receivings (team_id);
create index if not exists receivings_date_idx  on receivings (received_date);
create index if not exists receivings_party_idx on receivings (party_name);

alter table receivings enable row level security;
revoke all on receivings from anon, authenticated;
