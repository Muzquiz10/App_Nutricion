alter table public.patient_consultations
  add column if not exists prospective_food_record jsonb not null default '[]'::jsonb,
  add column if not exists retrospective_food_record jsonb not null default '[]'::jsonb,
  add column if not exists food_frequency_record jsonb not null default '[]'::jsonb;

create table if not exists public.patient_appointment_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  recorded_at date not null default current_date,
  advance_status text not null check (
    advance_status in ('yes', 'no', 'illness', 'other')
  ),
  advance_other text,
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint patient_appointment_records_other_check check (
    advance_status <> 'other'
    or nullif(trim(advance_other), '') is not null
  ),
  constraint patient_appointment_records_patient_tenant_fk check (
    tenant_id is not null and patient_id is not null
  )
);

create index if not exists idx_patient_appointment_records_patient_date
on public.patient_appointment_records(patient_id, recorded_at desc, created_at desc);

create index if not exists idx_patient_appointment_records_tenant_date
on public.patient_appointment_records(tenant_id, recorded_at desc);

alter table public.patient_appointment_records enable row level security;

drop trigger if exists set_patient_appointment_records_updated_at
on public.patient_appointment_records;

create trigger set_patient_appointment_records_updated_at
before update on public.patient_appointment_records
for each row execute function public.set_updated_at();

drop policy if exists "Nutritionists can read patient appointment records"
on public.patient_appointment_records;

create policy "Nutritionists can read patient appointment records"
on public.patient_appointment_records for select
using (
  public.current_tenant_role(tenant_id) in ('owner', 'nutritionist')
  and exists (
    select 1
    from public.patients p
    where p.id = patient_appointment_records.patient_id
      and p.tenant_id = patient_appointment_records.tenant_id
  )
);

drop policy if exists "Nutritionists can insert patient appointment records"
on public.patient_appointment_records;

create policy "Nutritionists can insert patient appointment records"
on public.patient_appointment_records for insert
with check (
  public.current_tenant_role(tenant_id) in ('owner', 'nutritionist')
  and created_by = auth.uid()
  and exists (
    select 1
    from public.patients p
    where p.id = patient_appointment_records.patient_id
      and p.tenant_id = patient_appointment_records.tenant_id
  )
);

drop policy if exists "Nutritionists can update patient appointment records"
on public.patient_appointment_records;

create policy "Nutritionists can update patient appointment records"
on public.patient_appointment_records for update
using (
  public.current_tenant_role(tenant_id) in ('owner', 'nutritionist')
  and exists (
    select 1
    from public.patients p
    where p.id = patient_appointment_records.patient_id
      and p.tenant_id = patient_appointment_records.tenant_id
  )
)
with check (
  public.current_tenant_role(tenant_id) in ('owner', 'nutritionist')
  and exists (
    select 1
    from public.patients p
    where p.id = patient_appointment_records.patient_id
      and p.tenant_id = patient_appointment_records.tenant_id
  )
);

comment on column public.patient_consultations.prospective_food_record is
  'Registro alimentario prospectivo editable desde la ficha profesional.';

comment on column public.patient_consultations.retrospective_food_record is
  'Recordatorio de 24 horas editable desde la ficha profesional.';

comment on column public.patient_consultations.food_frequency_record is
  'Cuestionario de frecuencia de consumo editable desde la ficha profesional.';

comment on table public.patient_appointment_records is
  'Historico de registros de cita creados por el profesional para cada cliente.';
