-- Lead lists: global per-user saved contact collections
create table if not exists lead_lists (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  name        text not null,
  source      text,          -- 'apollo', 'csv', 'gsheet', 'hunter', 'hubspot', 'apify', etc.
  lead_count  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Individual leads within a list
create table if not exists lead_list_contacts (
  id           uuid primary key default gen_random_uuid(),
  list_id      uuid references lead_lists(id) on delete cascade not null,
  first_name   text not null default '',
  last_name    text not null default '',
  email        text not null default '',
  company      text not null default '',
  title        text not null default '',
  linkedin_url text,
  website      text,
  phone        text,
  created_at   timestamptz not null default now()
);

-- Indexes
create index if not exists lead_lists_user_id_idx on lead_lists(user_id);
create index if not exists lead_list_contacts_list_id_idx on lead_list_contacts(list_id);

-- RLS
alter table lead_lists enable row level security;
alter table lead_list_contacts enable row level security;

create policy "Users manage own lists"
  on lead_lists for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users access own list contacts"
  on lead_list_contacts for all
  using (
    list_id in (
      select id from lead_lists where user_id = auth.uid()
    )
  )
  with check (
    list_id in (
      select id from lead_lists where user_id = auth.uid()
    )
  );

-- Auto-update updated_at
create or replace function update_lead_lists_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger lead_lists_updated_at
  before update on lead_lists
  for each row execute function update_lead_lists_updated_at();
