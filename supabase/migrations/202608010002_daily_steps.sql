create table if not exists public.step_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  steps integer not null check (steps between 0 and 200000),
  logged_on date not null default current_date,
  source text not null default 'patient' check (source in ('patient', 'integration')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (patient_id, logged_on)
);

create index if not exists idx_step_logs_patient_date
on public.step_logs(patient_id, logged_on desc);

alter table public.step_logs enable row level security;

drop trigger if exists set_step_logs_updated_at on public.step_logs;
create trigger set_step_logs_updated_at
before update on public.step_logs
for each row execute function public.set_updated_at();

drop policy if exists "Allowed users can read step logs"
on public.step_logs;

create policy "Allowed users can read step logs"
on public.step_logs for select
using (public.can_access_patient(patient_id));

drop policy if exists "Patients can insert own step logs"
on public.step_logs;

create policy "Patients can insert own step logs"
on public.step_logs for insert
with check (
  exists (
    select 1
    from public.patients p
    where p.id = patient_id
      and p.tenant_id = tenant_id
      and p.user_id = auth.uid()
  )
);

drop policy if exists "Patients can update own step logs"
on public.step_logs;

create policy "Patients can update own step logs"
on public.step_logs for update
using (
  exists (
    select 1
    from public.patients p
    where p.id = patient_id
      and p.tenant_id = tenant_id
      and p.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.patients p
    where p.id = patient_id
      and p.tenant_id = tenant_id
      and p.user_id = auth.uid()
  )
);
