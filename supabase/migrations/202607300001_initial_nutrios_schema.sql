create extension if not exists pgcrypto;
create extension if not exists citext;

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  logo_url text,
  primary_color text not null default '#2f7d6d',
  privacy_policy_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  global_role text not null default 'patient' check (global_role in ('owner', 'nutritionist', 'patient')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tenant_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'nutritionist', 'patient')),
  status text not null default 'active' check (status in ('active', 'invited', 'disabled')),
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  invited_by uuid not null references auth.users(id) on delete restrict,
  email citext not null,
  role text not null default 'patient' check (role in ('patient')),
  token uuid not null unique default gen_random_uuid(),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  nutritionist_user_id uuid not null references auth.users(id) on delete restrict,
  patient_code text not null unique,
  full_name text not null,
  age integer not null check (age between 0 and 120),
  height_cm numeric(5,2) not null check (height_cm between 40 and 260),
  initial_weight_kg numeric(6,2) not null check (initial_weight_kg between 1 and 400),
  current_weight_kg numeric(6,2) not null check (current_weight_kg between 1 and 400),
  waist_cm numeric(6,2) check (waist_cm between 20 and 250),
  allergies text,
  avoided_foods text,
  exercise_routine text,
  status text not null default 'active' check (status in ('active', 'archived')),
  consent_given_at timestamptz,
  gdpr_policy_version text not null default '2026-07-30',
  registered_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create table if not exists public.weight_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  weight_kg numeric(6,2) not null check (weight_kg between 1 and 400),
  source text default 'patient' check (source in ('initial', 'patient', 'nutritionist')),
  logged_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.waist_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  waist_cm numeric(6,2) not null check (waist_cm between 20 and 250),
  logged_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.exercise_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  activity text not null,
  duration_minutes integer check (duration_minutes between 0 and 1440),
  intensity text,
  logged_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.meal_photos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  storage_path text not null,
  meal_type text,
  notes text,
  logged_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  title text not null,
  storage_path text not null,
  content_type text,
  uploaded_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  title text not null,
  start_date date,
  end_date date,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.meal_plan_days (
  id uuid primary key default gen_random_uuid(),
  meal_plan_id uuid not null references public.meal_plans(id) on delete cascade,
  day_index integer not null check (day_index between 1 and 7),
  day_label text not null,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.meal_items (
  id uuid primary key default gen_random_uuid(),
  meal_plan_day_id uuid not null references public.meal_plan_days(id) on delete cascade,
  meal_type text not null,
  title text not null,
  description text,
  calories integer,
  protein_g numeric(6,2),
  carbs_g numeric(6,2),
  fat_g numeric(6,2),
  position integer not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  nutritionist_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (tenant_id, patient_id)
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) <= 4000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.consent_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  patient_id uuid references public.patients(id) on delete cascade,
  consent_type text not null,
  policy_version text not null,
  accepted_at timestamptz not null default now()
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_tenant_members_user on public.tenant_members(user_id);
create index if not exists idx_patients_tenant on public.patients(tenant_id);
create index if not exists idx_patients_user on public.patients(user_id);
create index if not exists idx_weight_logs_patient_date on public.weight_logs(patient_id, logged_at desc);
create index if not exists idx_waist_logs_patient_date on public.waist_logs(patient_id, logged_at desc);
create index if not exists idx_exercise_logs_patient_date on public.exercise_logs(patient_id, logged_at desc);
create index if not exists idx_meal_photos_patient_date on public.meal_photos(patient_id, logged_at desc);
create index if not exists idx_documents_patient on public.documents(patient_id);
create index if not exists idx_messages_conversation_date on public.chat_messages(conversation_id, created_at);
create index if not exists idx_meal_plans_patient on public.meal_plans(patient_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_tenants_updated_at on public.tenants;
create trigger set_tenants_updated_at
before update on public.tenants
for each row execute function public.set_updated_at();

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_patients_updated_at on public.patients;
create trigger set_patients_updated_at
before update on public.patients
for each row execute function public.set_updated_at();

drop trigger if exists set_meal_plans_updated_at on public.meal_plans;
create trigger set_meal_plans_updated_at
before update on public.meal_plans
for each row execute function public.set_updated_at();

create or replace function public.current_tenant_role(target_tenant_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select tm.role
  from public.tenant_members tm
  where tm.tenant_id = target_tenant_id
    and tm.user_id = auth.uid()
    and tm.status = 'active'
  limit 1
$$;

create or replace function public.can_access_patient(target_patient_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.patients p
    where p.id = target_patient_id
      and (
        p.user_id = auth.uid()
        or public.current_tenant_role(p.tenant_id) in ('owner', 'nutritionist')
      )
  )
$$;

create or replace function public.try_uuid(value text)
returns uuid
language plpgsql
immutable
as $$
begin
  return value::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;

create or replace function public.can_access_storage_object(path text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with parsed as (
    select
      public.try_uuid(split_part(path, '/', 1)) as tenant_id,
      public.try_uuid(split_part(path, '/', 2)) as patient_id
  )
  select exists (
    select 1
    from parsed
    where public.current_tenant_role(parsed.tenant_id) in ('owner', 'nutritionist')
      or exists (
        select 1
        from public.patients p
        where p.id = parsed.patient_id
          and p.tenant_id = parsed.tenant_id
          and p.user_id = auth.uid()
      )
  )
$$;

alter table public.tenants enable row level security;
alter table public.profiles enable row level security;
alter table public.tenant_members enable row level security;
alter table public.invitations enable row level security;
alter table public.patients enable row level security;
alter table public.weight_logs enable row level security;
alter table public.waist_logs enable row level security;
alter table public.exercise_logs enable row level security;
alter table public.meal_photos enable row level security;
alter table public.documents enable row level security;
alter table public.meal_plans enable row level security;
alter table public.meal_plan_days enable row level security;
alter table public.meal_items enable row level security;
alter table public.conversations enable row level security;
alter table public.chat_messages enable row level security;
alter table public.consent_records enable row level security;
alter table public.audit_events enable row level security;

create policy "Public can read tenant branding"
on public.tenants for select
using (true);

create policy "Nutritionists can update tenant branding"
on public.tenants for update
using (public.current_tenant_role(id) in ('owner', 'nutritionist'))
with check (public.current_tenant_role(id) in ('owner', 'nutritionist'));

create policy "Users can read own profile"
on public.profiles for select
using (user_id = auth.uid());

create policy "Users can update own profile"
on public.profiles for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Members can read own membership or tenant patients"
on public.tenant_members for select
using (
  user_id = auth.uid()
  or public.current_tenant_role(tenant_id) in ('owner', 'nutritionist')
);

create policy "Nutritionists can manage invitations"
on public.invitations for all
using (public.current_tenant_role(tenant_id) in ('owner', 'nutritionist'))
with check (public.current_tenant_role(tenant_id) in ('owner', 'nutritionist'));

create policy "Patients and nutritionists can read patient files"
on public.patients for select
using (
  user_id = auth.uid()
  or public.current_tenant_role(tenant_id) in ('owner', 'nutritionist')
);

create policy "Nutritionists can update patients"
on public.patients for update
using (public.current_tenant_role(tenant_id) in ('owner', 'nutritionist'))
with check (public.current_tenant_role(tenant_id) in ('owner', 'nutritionist'));

create policy "Nutritionists can insert patients"
on public.patients for insert
with check (public.current_tenant_role(tenant_id) in ('owner', 'nutritionist'));

create policy "Allowed users can read weight logs"
on public.weight_logs for select
using (public.can_access_patient(patient_id));

create policy "Patients can insert own weight logs"
on public.weight_logs for insert
with check (
  exists (
    select 1
    from public.patients p
    where p.id = patient_id
      and p.tenant_id = tenant_id
      and p.user_id = auth.uid()
  )
);

create policy "Allowed users can read waist logs"
on public.waist_logs for select
using (public.can_access_patient(patient_id));

create policy "Patients can insert own waist logs"
on public.waist_logs for insert
with check (
  exists (
    select 1
    from public.patients p
    where p.id = patient_id
      and p.tenant_id = tenant_id
      and p.user_id = auth.uid()
  )
);

create policy "Allowed users can read exercise logs"
on public.exercise_logs for select
using (public.can_access_patient(patient_id));

create policy "Patients can insert own exercise logs"
on public.exercise_logs for insert
with check (
  exists (
    select 1
    from public.patients p
    where p.id = patient_id
      and p.tenant_id = tenant_id
      and p.user_id = auth.uid()
  )
);

create policy "Allowed users can read meal photos"
on public.meal_photos for select
using (public.can_access_patient(patient_id));

create policy "Patients can insert own meal photos"
on public.meal_photos for insert
with check (
  exists (
    select 1
    from public.patients p
    where p.id = patient_id
      and p.tenant_id = tenant_id
      and p.user_id = auth.uid()
  )
);

create policy "Allowed users can read documents"
on public.documents for select
using (public.can_access_patient(patient_id));

create policy "Nutritionists can insert documents"
on public.documents for insert
with check (public.current_tenant_role(tenant_id) in ('owner', 'nutritionist'));

create policy "Allowed users can read meal plans"
on public.meal_plans for select
using (public.can_access_patient(patient_id));

create policy "Nutritionists can manage meal plans"
on public.meal_plans for all
using (public.current_tenant_role(tenant_id) in ('owner', 'nutritionist'))
with check (public.current_tenant_role(tenant_id) in ('owner', 'nutritionist'));

create policy "Allowed users can read meal plan days"
on public.meal_plan_days for select
using (
  exists (
    select 1 from public.meal_plans mp
    where mp.id = meal_plan_id and public.can_access_patient(mp.patient_id)
  )
);

create policy "Nutritionists can manage meal plan days"
on public.meal_plan_days for all
using (
  exists (
    select 1 from public.meal_plans mp
    where mp.id = meal_plan_id
      and public.current_tenant_role(mp.tenant_id) in ('owner', 'nutritionist')
  )
)
with check (
  exists (
    select 1 from public.meal_plans mp
    where mp.id = meal_plan_id
      and public.current_tenant_role(mp.tenant_id) in ('owner', 'nutritionist')
  )
);

create policy "Allowed users can read meal items"
on public.meal_items for select
using (
  exists (
    select 1
    from public.meal_plan_days mpd
    join public.meal_plans mp on mp.id = mpd.meal_plan_id
    where mpd.id = meal_plan_day_id
      and public.can_access_patient(mp.patient_id)
  )
);

create policy "Nutritionists can manage meal items"
on public.meal_items for all
using (
  exists (
    select 1
    from public.meal_plan_days mpd
    join public.meal_plans mp on mp.id = mpd.meal_plan_id
    where mpd.id = meal_plan_day_id
      and public.current_tenant_role(mp.tenant_id) in ('owner', 'nutritionist')
  )
)
with check (
  exists (
    select 1
    from public.meal_plan_days mpd
    join public.meal_plans mp on mp.id = mpd.meal_plan_id
    where mpd.id = meal_plan_day_id
      and public.current_tenant_role(mp.tenant_id) in ('owner', 'nutritionist')
  )
);

create policy "Allowed users can read conversations"
on public.conversations for select
using (public.can_access_patient(patient_id));

create policy "Allowed users can read messages"
on public.chat_messages for select
using (public.can_access_patient(patient_id));

create policy "Allowed users can send messages"
on public.chat_messages for insert
with check (
  sender_id = auth.uid()
  and public.can_access_patient(patient_id)
);

create policy "Users can read own consents"
on public.consent_records for select
using (
  user_id = auth.uid()
  or public.current_tenant_role(tenant_id) in ('owner', 'nutritionist')
);

create policy "Users can create own consents"
on public.consent_records for insert
with check (user_id = auth.uid());

create policy "Nutritionists can read audit events"
on public.audit_events for select
using (public.current_tenant_role(tenant_id) in ('owner', 'nutritionist'));

insert into storage.buckets (id, name, public, file_size_limit)
values ('nutrios-branding', 'nutrios-branding', true, 2097152)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit;

create policy "Public can read NutriOS branding objects"
on storage.objects for select
using (bucket_id = 'nutrios-branding');

create policy "Nutritionists can upload NutriOS branding objects"
on storage.objects for insert
with check (
  bucket_id = 'nutrios-branding'
  and public.current_tenant_role(public.try_uuid(split_part(name, '/', 1))) in ('owner', 'nutritionist')
);

create policy "Nutritionists can update NutriOS branding objects"
on storage.objects for update
using (
  bucket_id = 'nutrios-branding'
  and public.current_tenant_role(public.try_uuid(split_part(name, '/', 1))) in ('owner', 'nutritionist')
)
with check (
  bucket_id = 'nutrios-branding'
  and public.current_tenant_role(public.try_uuid(split_part(name, '/', 1))) in ('owner', 'nutritionist')
);

create policy "Nutritionists can delete NutriOS branding objects"
on storage.objects for delete
using (
  bucket_id = 'nutrios-branding'
  and public.current_tenant_role(public.try_uuid(split_part(name, '/', 1))) in ('owner', 'nutritionist')
);

insert into storage.buckets (id, name, public, file_size_limit)
values ('nutrios-private', 'nutrios-private', false, 10485760)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit;

create policy "Allowed users can read private NutriOS objects"
on storage.objects for select
using (
  bucket_id = 'nutrios-private'
  and public.can_access_storage_object(name)
);

create policy "Allowed users can upload private NutriOS objects"
on storage.objects for insert
with check (
  bucket_id = 'nutrios-private'
  and public.can_access_storage_object(name)
);

create policy "Allowed users can update private NutriOS objects"
on storage.objects for update
using (
  bucket_id = 'nutrios-private'
  and public.can_access_storage_object(name)
)
with check (
  bucket_id = 'nutrios-private'
  and public.can_access_storage_object(name)
);

create policy "Allowed users can delete private NutriOS objects"
on storage.objects for delete
using (
  bucket_id = 'nutrios-private'
  and public.can_access_storage_object(name)
);
