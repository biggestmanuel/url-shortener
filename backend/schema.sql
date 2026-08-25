create table links (
  id bigserial primary key,
  code text unique,
  destination_url text not null,
  clicks int not null default 0,
  created_at timestamptz not null default now()
);

-- No Row Level Security here — that's a Supabase-specific feature.
-- Neon is plain Postgres accessed only by this backend server via
-- DATABASE_URL, never directly from the browser, so there's no
-- client-facing access to lock down.
