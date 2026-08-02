do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'patients_status_check'
      and conrelid = 'public.patients'::regclass
  ) then
    alter table public.patients drop constraint patients_status_check;
  end if;
end $$;

update public.patients
set status = 'inactive'
where status = 'archived';

alter table public.patients
add constraint patients_status_check
check (status in ('active', 'inactive'));

create index if not exists idx_patients_tenant_status
on public.patients(tenant_id, status);
