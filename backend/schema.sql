create table if not exists links (
  id bigserial primary key,
  code text unique,
  destination_url text not null,
  clicks integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists links_created_at_idx on links (created_at desc);
create index if not exists links_code_idx on links (code);
