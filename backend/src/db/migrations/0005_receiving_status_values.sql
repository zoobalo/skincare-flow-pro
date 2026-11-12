-- The real status vocabularies, replacing the guesses.
--
-- COA, GRN and invoice now read Received / Not Received / Stored, so their
-- old default of 'Pending' is no longer one of the choices. Rows still
-- carrying it are moved to 'Not Received', which is what it meant: nothing
-- has arrived yet. QC and final status keep 'Pending' — it remains a choice.

alter table receivings alter column coa_status     set default 'Not Received';
alter table receivings alter column grn_status     set default 'Not Received';
alter table receivings alter column invoice_status set default 'Not Received';

update receivings set coa_status     = 'Not Received' where coa_status     = 'Pending';
update receivings set grn_status     = 'Not Received' where grn_status     = 'Pending';
update receivings set invoice_status = 'Not Received' where invoice_status = 'Pending';
