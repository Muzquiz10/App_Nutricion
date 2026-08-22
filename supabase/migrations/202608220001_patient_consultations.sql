create table if not exists public.patient_consultations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  consultation_at date not null default current_date,
  weight_kg numeric(6,2) check (weight_kg is null or weight_kg between 1 and 400),
  height_cm numeric(5,2) check (height_cm is null or height_cm between 40 and 260),
  stress_level text check (
    stress_level is null
    or stress_level in ('none', 'low', 'medium', 'high', 'very_high')
  ),
  body_fat_percentage numeric(5,2) check (
    body_fat_percentage is null
    or body_fat_percentage between 0 and 100
  ),
  fat_mass_percentage numeric(5,2) check (
    fat_mass_percentage is null
    or fat_mass_percentage between 0 and 100
  ),
  birth_date date,
  age integer check (age is null or age between 0 and 120),
  gender text check (
    gender is null
    or gender in ('male', 'female', 'non_binary', 'prefer_not_to_say')
  ),
  is_menstruating boolean,
  menstruation_start_date date,
  is_pregnant boolean,
  physical_activity_level text check (
    physical_activity_level is null
    or physical_activity_level in ('sedentary', 'light_moderate', 'intense', 'very_intense')
  ),
  diagnosis_problem text,
  diagnosis_cause text,
  diagnosis_symptoms text,
  comments text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint patient_consultations_patient_tenant_fk check (
    tenant_id is not null and patient_id is not null
  )
);

create index if not exists idx_patient_consultations_patient_date
on public.patient_consultations(patient_id, consultation_at desc, created_at desc);

create index if not exists idx_patient_consultations_tenant_date
on public.patient_consultations(tenant_id, consultation_at desc);

alter table public.patient_consultations enable row level security;

drop trigger if exists set_patient_consultations_updated_at
on public.patient_consultations;

create trigger set_patient_consultations_updated_at
before update on public.patient_consultations
for each row execute function public.set_updated_at();

drop policy if exists "Nutritionists can read patient consultations"
on public.patient_consultations;

create policy "Nutritionists can read patient consultations"
on public.patient_consultations for select
using (
  public.current_tenant_role(tenant_id) in ('owner', 'nutritionist')
  and exists (
    select 1
    from public.patients p
    where p.id = patient_consultations.patient_id
      and p.tenant_id = patient_consultations.tenant_id
  )
);

drop policy if exists "Nutritionists can insert patient consultations"
on public.patient_consultations;

create policy "Nutritionists can insert patient consultations"
on public.patient_consultations for insert
with check (
  public.current_tenant_role(tenant_id) in ('owner', 'nutritionist')
  and created_by = auth.uid()
  and exists (
    select 1
    from public.patients p
    where p.id = patient_consultations.patient_id
      and p.tenant_id = patient_consultations.tenant_id
  )
);

drop policy if exists "Nutritionists can update patient consultations"
on public.patient_consultations;

create policy "Nutritionists can update patient consultations"
on public.patient_consultations for update
using (
  public.current_tenant_role(tenant_id) in ('owner', 'nutritionist')
  and exists (
    select 1
    from public.patients p
    where p.id = patient_consultations.patient_id
      and p.tenant_id = patient_consultations.tenant_id
  )
)
with check (
  public.current_tenant_role(tenant_id) in ('owner', 'nutritionist')
  and exists (
    select 1
    from public.patients p
    where p.id = patient_consultations.patient_id
      and p.tenant_id = patient_consultations.tenant_id
  )
);
