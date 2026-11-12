-- COA on a booked invoice.
--
-- Additive only. Existing invoices start at 'Not Received', which is what an
-- invoice booked before the column existed had recorded: nothing.

alter table payment_invoices
  add column if not exists coa_status text not null default 'Not Received';
