-- Stage 1 schema. Run in Supabase SQL editor.
create extension if not exists pgcrypto;

create table app_owner (email text primary key);
create function is_owner() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from app_owner where email = auth.jwt() ->> 'email');
$$;

create table settings (
  id int primary key default 1 check (id = 1),
  daily_send_limit int not null default 15,
  auto_send boolean not null default false,
  search_frequency text not null default 'daily',
  min_score int not null default 70,
  portfolio_url text, resume_url text,
  profile jsonb not null default '{}'
);
insert into settings (id) values (1);

create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null, website text, domain text unique,
  ats_type text, ats_slug text, created_at timestamptz default now()
);

create table jobs (
  id uuid primary key default gen_random_uuid(),
  source text not null, external_id text,
  company_id uuid references companies(id),
  title text not null, location text, remote boolean default false,
  salary_min int, salary_max int, description text, apply_url text,
  posted_at timestamptz, is_active boolean default true,
  score int check (score between 0 and 100), score_breakdown jsonb,
  dedupe_hash text not null unique,
  status text not null default 'discovered' check (status in
    ('discovered','shortlisted','draft_created','approved','email_sent','replied','interview','rejected','manual_apply')),
  created_at timestamptz default now()
);
create index on jobs (status); create index on jobs (score desc);

create table contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  name text, role text, email text not null, source_url text,
  verified boolean default false, verification_result text, verified_at timestamptz,
  unique (company_id, email)
);

create table emails (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references jobs(id) on delete cascade,
  contact_id uuid references contacts(id),
  subject text, body text,
  gmail_draft_id text, gmail_message_id text, gmail_thread_id text,
  state text not null default 'draft' check (state in ('draft','approved','sent','failed')),
  error text, sent_at timestamptz, created_at timestamptz default now()
);

-- Blocks duplicate applications at the database level
create table applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references jobs(id), company_id uuid references companies(id),
  normalized_title text not null, applied_at timestamptz default now(),
  unique (company_id, normalized_title)
);

create table oauth_tokens (
  provider text primary key, encrypted_refresh_token text not null, scopes text[]
);
create table runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz default now(), finished_at timestamptz,
  jobs_found int default 0, shortlisted int default 0, drafts int default 0, errors jsonb default '[]'
);
create table logs (
  id bigserial primary key, run_id uuid references runs(id),
  level text not null, message text not null, meta jsonb, created_at timestamptz default now()
);

-- Row level security: only the owner row in app_owner can read or write
do $$ declare t text; begin
  foreach t in array array['settings','companies','jobs','contacts','emails','applications','oauth_tokens','runs','logs','app_owner'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy owner_all on %I for all using (is_owner()) with check (is_owner())', t);
  end loop;
end $$;
