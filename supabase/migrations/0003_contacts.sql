-- Stage 3: remember which companies were already checked for contacts
alter table companies add column if not exists contacts_checked_at timestamptz;
