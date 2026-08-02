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

update public.patients p
set status = 'inactive',
    updated_at = now()
from public.tenant_members tm
where tm.tenant_id = p.tenant_id
  and tm.user_id = p.user_id
  and tm.role = 'patient'
  and tm.status = 'disabled'
  and p.status = 'active';

update public.tenant_members tm
set status = 'disabled'
from public.patients p
where tm.tenant_id = p.tenant_id
  and tm.user_id = p.user_id
  and tm.role = 'patient'
  and p.status = 'inactive'
  and tm.status <> 'disabled';

do $$
begin
  if exists (
    select 1
    from public.tenant_members
    where role = 'patient'
      and status = 'active'
    group by user_id
    having count(*) > 1
  ) then
    raise exception 'Hay usuarios paciente activos en mas de un nutricionista. Deja solo un tenant activo antes de crear el indice unico.';
  end if;

  if exists (
    select 1
    from public.patients
    where user_id is not null
      and status = 'active'
    group by user_id
    having count(*) > 1
  ) then
    raise exception 'Hay fichas de paciente activas en mas de un nutricionista. Mueve las fichas antiguas a inactive antes de crear el indice unico.';
  end if;
end $$;

create index if not exists idx_patients_tenant_status
on public.patients(tenant_id, status);

create unique index if not exists idx_patients_one_active_user
on public.patients(user_id)
where user_id is not null
  and status = 'active';

create unique index if not exists idx_tenant_members_one_active_patient
on public.tenant_members(user_id)
where role = 'patient'
  and status = 'active';
