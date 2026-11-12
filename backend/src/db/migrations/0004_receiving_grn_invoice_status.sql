-- GRN Status and Invoice Status, added to the sheet after COA Status.
--
-- Additive only. Existing rows start at 'Pending', which is what an
-- unfilled cell meant.

alter table receivings add column if not exists grn_status     text not null default 'Pending';
alter table receivings add column if not exists invoice_status text not null default 'Pending';
