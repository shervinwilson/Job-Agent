-- Stage 2: one company row per name (case-insensitive)
create unique index if not exists companies_name_lower_idx on companies (lower(name));
