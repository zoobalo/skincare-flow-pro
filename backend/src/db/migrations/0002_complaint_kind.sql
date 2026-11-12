-- A complaint is either about one SKU or general to the business.
--
-- Additive only. Existing rows become "General", which is what they were
-- before the distinction existed.

alter table complaints add column if not exists kind   text not null default 'General';
alter table complaints add column if not exists sku_id text;

create index if not exists complaints_sku_idx on complaints (sku_id);
