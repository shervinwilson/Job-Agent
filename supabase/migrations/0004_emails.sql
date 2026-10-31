-- Stage 4: one email per job
create unique index if not exists emails_job_unique on emails (job_id);
