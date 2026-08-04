create table if not exists public.appointment_availability (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  weekday integer not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  slot_minutes integer not null default 60 check (slot_minutes between 15 and 240),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_time < end_time)
);

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  patient_id uuid references public.patients(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  title text not null,
  notes text,
  event_type text not null default 'appointment'
    check (event_type in ('appointment', 'block', 'note')),
  appointment_mode text
    check (appointment_mode is null or appointment_mode in ('online', 'presential')),
  blocks_availability boolean not null default true,
  start_at timestamptz not null,
  end_at timestamptz not null,
  status text not null default 'confirmed'
    check (status in ('pending', 'confirmed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_at < end_at),
  check (
    event_type <> 'appointment'
    or (patient_id is not null and appointment_mode is not null)
  )
);

do $$
declare
  constraint_record record;
begin
  for constraint_record in
    select conname
    from pg_constraint
    where conrelid = 'public.calendar_events'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format(
      'alter table public.calendar_events drop constraint if exists %I',
      constraint_record.conname
    );
  end loop;
end $$;

update public.calendar_events
set status = 'pending'
where status = 'scheduled'
  and event_type = 'appointment'
  and title = 'Solicitud pendiente de cita';

update public.calendar_events
set status = 'confirmed'
where status = 'scheduled';

alter table public.calendar_events
alter column status set default 'confirmed';

alter table public.calendar_events
add constraint calendar_events_status_check
check (status in ('pending', 'confirmed', 'cancelled'));

create index if not exists idx_appointment_availability_tenant
on public.appointment_availability(tenant_id, weekday, start_time);

create index if not exists idx_calendar_events_tenant_start
on public.calendar_events(tenant_id, start_at);

create index if not exists idx_calendar_events_patient_start
on public.calendar_events(patient_id, start_at);

drop trigger if exists set_appointment_availability_updated_at
on public.appointment_availability;
create trigger set_appointment_availability_updated_at
before update on public.appointment_availability
for each row execute function public.set_updated_at();

drop trigger if exists set_calendar_events_updated_at
on public.calendar_events;
create trigger set_calendar_events_updated_at
before update on public.calendar_events
for each row execute function public.set_updated_at();

alter table public.appointment_availability enable row level security;
alter table public.calendar_events enable row level security;

drop policy if exists "Members can read appointment availability"
on public.appointment_availability;
create policy "Members can read appointment availability"
on public.appointment_availability for select
using (public.current_tenant_role(tenant_id) in ('owner', 'nutritionist', 'patient'));

drop policy if exists "Nutritionists can manage appointment availability"
on public.appointment_availability;
create policy "Nutritionists can manage appointment availability"
on public.appointment_availability for all
using (public.current_tenant_role(tenant_id) in ('owner', 'nutritionist'))
with check (public.current_tenant_role(tenant_id) in ('owner', 'nutritionist'));

drop policy if exists "Allowed users can read calendar events"
on public.calendar_events;
create policy "Allowed users can read calendar events"
on public.calendar_events for select
using (
  public.current_tenant_role(tenant_id) in ('owner', 'nutritionist')
  or (
    patient_id is not null
    and public.can_access_patient(patient_id)
  )
);

drop policy if exists "Nutritionists can manage calendar events"
on public.calendar_events;
create policy "Nutritionists can manage calendar events"
on public.calendar_events for all
using (public.current_tenant_role(tenant_id) in ('owner', 'nutritionist'))
with check (public.current_tenant_role(tenant_id) in ('owner', 'nutritionist'));

drop policy if exists "Patients can create own appointments"
on public.calendar_events;
create policy "Patients can create own appointments"
on public.calendar_events for insert
with check (
  event_type = 'appointment'
  and status = 'pending'
  and blocks_availability = true
  and appointment_mode in ('online', 'presential')
  and patient_id is not null
  and exists (
    select 1
    from public.patients p
    where p.id = patient_id
      and p.tenant_id = tenant_id
      and p.user_id = auth.uid()
      and p.status = 'active'
  )
);

create or replace function public.get_calendar_busy_slots(target_tenant_id uuid)
returns table (
  id uuid,
  start_at timestamptz,
  end_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select ce.id, ce.start_at, ce.end_at
  from public.calendar_events ce
  where ce.tenant_id = target_tenant_id
    and ce.status in ('pending', 'confirmed')
    and ce.blocks_availability = true
    and public.current_tenant_role(target_tenant_id) in ('owner', 'nutritionist', 'patient')
$$;
