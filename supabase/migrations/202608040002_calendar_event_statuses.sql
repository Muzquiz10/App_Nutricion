alter table public.calendar_events
drop constraint if exists calendar_events_status_check;

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
