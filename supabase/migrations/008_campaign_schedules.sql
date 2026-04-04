create table if not exists campaign_schedules (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid references projects(id) on delete cascade not null,
  user_id       uuid references auth.users(id) on delete cascade not null,
  enabled       boolean not null default true,
  frequency     text not null default 'manual',   -- manual | daily | weekly | monthly
  day_of_week   int,      -- 0=Sun..6=Sat (weekly only)
  day_of_month  int,      -- 1-28 (monthly only)
  hour_utc      int not null default 9,
  timezone      text not null default 'UTC',
  pipeline_config jsonb not null default '{}',
  last_run_at   timestamptz,
  next_run_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists campaign_schedules_project_id_idx on campaign_schedules(project_id);
create index if not exists campaign_schedules_next_run_idx on campaign_schedules(next_run_at) where enabled = true;

alter table campaign_schedules enable row level security;

create policy "Users manage own schedules"
  on campaign_schedules for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function update_campaign_schedules_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger campaign_schedules_updated_at
  before update on campaign_schedules
  for each row execute function update_campaign_schedules_updated_at();
