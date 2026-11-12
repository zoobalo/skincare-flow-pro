-- Vendor payments: credit terms per supplier, and invoices booked against them.
--
-- Additive only: two new tables and their indexes.

create table if not exists payment_terms (
  id          text primary key,
  team_id     text not null,
  party_type  text not null,
  party_id    text not null,
  credit_days integer not null default 0,
  updated_at  timestamp not null default now(),
  constraint payment_terms_party_uq unique (team_id, party_type, party_id)
);
create index if not exists payment_terms_team_idx on payment_terms (team_id);

create table if not exists payment_invoices (
  id              text primary key,
  team_id         text not null,
  party_type      text not null,
  party_id        text not null,
  invoice_number  text not null,
  invoice_date    date,
  due_days        integer not null default 0,
  internal_qc     text not null default 'Pending',
  external_qc     text not null default 'Pending',
  final_status    text not null default 'Stop',
  payment_status  text not null default 'Pending',
  comments        text not null default '',
  created_by_id   text not null default '',
  created_by_name text not null default '',
  created_at      timestamp not null default now(),
  updated_at      timestamp not null default now()
);
create index if not exists payment_invoices_team_idx   on payment_invoices (team_id);
create index if not exists payment_invoices_status_idx on payment_invoices (payment_status);
create index if not exists payment_invoices_party_idx  on payment_invoices (party_id);

alter table payment_terms    enable row level security;
alter table payment_invoices enable row level security;
revoke all on payment_terms    from anon, authenticated;
revoke all on payment_invoices from anon, authenticated;
