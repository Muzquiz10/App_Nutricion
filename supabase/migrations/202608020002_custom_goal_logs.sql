alter table public.patient_goals
add column if not exists custom_input_type text not null default 'check';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'patient_goals_custom_input_type_check'
  ) then
    alter table public.patient_goals
    add constraint patient_goals_custom_input_type_check
    check (custom_input_type in ('check', 'number', 'minutes', 'sleep_hours'));
  end if;
end $$;

update public.patient_goals
set unit = 'hecho'
where goal_type = 'custom'
  and unit is null;

create table if not exists public.patient_goal_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  goal_id uuid not null references public.patient_goals(id) on delete cascade,
  logged_on date not null default current_date,
  status text not null default 'in_progress' check (status in ('fulfilled', 'in_progress', 'not_fulfilled')),
  value numeric(10, 2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (goal_id, logged_on)
);

create index if not exists idx_patient_goal_logs_patient_date
on public.patient_goal_logs(patient_id, logged_on desc);

create index if not exists idx_patient_goal_logs_goal_date
on public.patient_goal_logs(goal_id, logged_on desc);

alter table public.patient_goal_logs enable row level security;

drop trigger if exists set_patient_goal_logs_updated_at on public.patient_goal_logs;
create trigger set_patient_goal_logs_updated_at
before update on public.patient_goal_logs
for each row execute function public.set_updated_at();

drop policy if exists "Allowed users can read patient goal logs"
on public.patient_goal_logs;

create policy "Allowed users can read patient goal logs"
on public.patient_goal_logs for select
using (public.can_access_patient(patient_id));

drop policy if exists "Patients can insert own custom goal logs"
on public.patient_goal_logs;

create policy "Patients can insert own custom goal logs"
on public.patient_goal_logs for insert
with check (
  exists (
    select 1
    from public.patients p
    join public.patient_goals g
      on g.id = patient_goal_logs.goal_id
      and g.patient_id = p.id
      and g.tenant_id = p.tenant_id
      and g.goal_type = 'custom'
    where p.id = patient_goal_logs.patient_id
      and p.tenant_id = patient_goal_logs.tenant_id
      and p.user_id = auth.uid()
  )
);

drop policy if exists "Patients can update own custom goal logs"
on public.patient_goal_logs;

create policy "Patients can update own custom goal logs"
on public.patient_goal_logs for update
using (
  exists (
    select 1
    from public.patients p
    join public.patient_goals g
      on g.id = patient_goal_logs.goal_id
      and g.patient_id = p.id
      and g.tenant_id = p.tenant_id
      and g.goal_type = 'custom'
    where p.id = patient_goal_logs.patient_id
      and p.tenant_id = patient_goal_logs.tenant_id
      and p.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.patients p
    join public.patient_goals g
      on g.id = patient_goal_logs.goal_id
      and g.patient_id = p.id
      and g.tenant_id = p.tenant_id
      and g.goal_type = 'custom'
    where p.id = patient_goal_logs.patient_id
      and p.tenant_id = patient_goal_logs.tenant_id
      and p.user_id = auth.uid()
  )
);
