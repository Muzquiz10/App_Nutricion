create table if not exists public.patient_goals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  goal_type text not null check (goal_type in ('steps_daily', 'weight_logged', 'activity_logged', 'custom')),
  title text not null,
  target_value numeric(10, 2),
  unit text,
  is_active boolean not null default true,
  custom_status text not null default 'in_progress' check (custom_status in ('fulfilled', 'in_progress', 'not_fulfilled')),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_patient_goals_unique_system_goal
on public.patient_goals(patient_id, goal_type)
where goal_type <> 'custom';

create index if not exists idx_patient_goals_patient_active
on public.patient_goals(patient_id, is_active);

create index if not exists idx_patient_goals_tenant
on public.patient_goals(tenant_id);

alter table public.patient_goals enable row level security;

drop trigger if exists set_patient_goals_updated_at on public.patient_goals;
create trigger set_patient_goals_updated_at
before update on public.patient_goals
for each row execute function public.set_updated_at();

drop policy if exists "Allowed users can read patient goals"
on public.patient_goals;

create policy "Allowed users can read patient goals"
on public.patient_goals for select
using (public.can_access_patient(patient_id));

drop policy if exists "Nutritionists can insert patient goals"
on public.patient_goals;

create policy "Nutritionists can insert patient goals"
on public.patient_goals for insert
with check (
  public.current_tenant_role(tenant_id) in ('owner', 'nutritionist')
  and exists (
    select 1
    from public.patients p
    where p.id = patient_goals.patient_id
      and p.tenant_id = patient_goals.tenant_id
  )
);

drop policy if exists "Nutritionists can update patient goals"
on public.patient_goals;

create policy "Nutritionists can update patient goals"
on public.patient_goals for update
using (public.current_tenant_role(tenant_id) in ('owner', 'nutritionist'))
with check (
  public.current_tenant_role(tenant_id) in ('owner', 'nutritionist')
  and exists (
    select 1
    from public.patients p
    where p.id = patient_goals.patient_id
      and p.tenant_id = patient_goals.tenant_id
  )
);

drop policy if exists "Nutritionists can delete patient goals"
on public.patient_goals;

create policy "Nutritionists can delete patient goals"
on public.patient_goals for delete
using (public.current_tenant_role(tenant_id) in ('owner', 'nutritionist'));

insert into public.patient_goals (tenant_id, patient_id, goal_type, title, target_value, unit, is_active)
select p.tenant_id, p.id, 'weight_logged', 'Registrar peso', null, null, true
from public.patients p
where coalesce(p.status, 'active') = 'active'
on conflict do nothing;

insert into public.patient_goals (tenant_id, patient_id, goal_type, title, target_value, unit, is_active)
select p.tenant_id, p.id, 'activity_logged', 'Realizar actividad', null, null, true
from public.patients p
where coalesce(p.status, 'active') = 'active'
on conflict do nothing;
