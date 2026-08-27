alter table public.patients
  add column if not exists email text;

update public.patients p
set email = au.email
from auth.users au
where p.user_id = au.id
  and (p.email is null or p.email = '');

create index if not exists idx_patients_tenant_email
on public.patients(tenant_id, lower(email));

alter table public.patient_consultations
  add column if not exists phone_number text,
  add column if not exists country_city text,
  add column if not exists occupation text,
  add column if not exists treatment_motivation text,
  add column if not exists self_esteem_identification text,
  add column if not exists situation_description text,
  add column if not exists condition_start_date date,
  add column if not exists trigger_factors text,
  add column if not exists previous_treatments text,
  add column if not exists associated_pathologies text,
  add column if not exists desired_weight_kg numeric(6,2)
    check (desired_weight_kg is null or desired_weight_kg between 1 and 400),
  add column if not exists theoretical_weight_kg numeric(6,2)
    check (theoretical_weight_kg is null or theoretical_weight_kg between 1 and 400),
  add column if not exists glucose_mg_dl numeric(7,2)
    check (glucose_mg_dl is null or glucose_mg_dl between 0 and 1000),
  add column if not exists hemoglobin_g_dl numeric(5,2)
    check (hemoglobin_g_dl is null or hemoglobin_g_dl between 0 and 30),
  add column if not exists cholesterol_mg_dl numeric(7,2)
    check (cholesterol_mg_dl is null or cholesterol_mg_dl between 0 and 1000),
  add column if not exists triglycerides_mg_dl numeric(7,2)
    check (triglycerides_mg_dl is null or triglycerides_mg_dl between 0 and 2000),
  add column if not exists meals_per_day integer
    check (meals_per_day is null or meals_per_day between 0 and 20),
  add column if not exists meal_context text,
  add column if not exists breakfast_time text,
  add column if not exists lunch_time text,
  add column if not exists dinner_time text,
  add column if not exists snacking_habit text,
  add column if not exists meal_preparer text,
  add column if not exists grocery_buyer text,
  add column if not exists food_preferences_aversions text,
  add column if not exists appetite_sensation text,
  add column if not exists peak_appetite_time text,
  add column if not exists fast_compulsive_eating text,
  add column if not exists previous_diet_treatment_followup text,
  add column if not exists diet_treatment_count_types text,
  add column if not exists frequent_cooking_methods text,
  add column if not exists healthy_eating_knowledge text,
  add column if not exists diet_knowledge text,
  add column if not exists diabetes_status text
    check (diabetes_status is null or diabetes_status in ('yes', 'no')),
  add column if not exists hypertension_status text
    check (hypertension_status is null or hypertension_status in ('yes', 'no')),
  add column if not exists fatty_liver_status text
    check (fatty_liver_status is null or fatty_liver_status in ('yes', 'no')),
  add column if not exists culinary_resources text,
  add column if not exists activity_type text,
  add column if not exists activity_duration text,
  add column if not exists activity_frequency text;

comment on column public.patients.email is
  'Email del cliente para mostrarlo en la ficha profesional y facilitar busquedas administrativas.';

comment on column public.patient_consultations.condition_start_date is
  'Fecha de inicio de la situacion, patologia o motivo clinico indicado en anamnesis.';
