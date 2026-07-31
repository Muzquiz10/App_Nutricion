alter table public.patients
add column if not exists status text not null default 'active';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'patients_status_check'
      and conrelid = 'public.patients'::regclass
  ) then
    alter table public.patients
    add constraint patients_status_check
    check (status in ('active', 'archived'));
  end if;
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit)
values ('nutrios-branding', 'nutrios-branding', true, 2097152)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit;

drop policy if exists "Public can read NutriOS branding objects"
on storage.objects;

create policy "Public can read NutriOS branding objects"
on storage.objects for select
using (bucket_id = 'nutrios-branding');

drop policy if exists "Nutritionists can upload NutriOS branding objects"
on storage.objects;

create policy "Nutritionists can upload NutriOS branding objects"
on storage.objects for insert
with check (
  bucket_id = 'nutrios-branding'
  and public.current_tenant_role(public.try_uuid(split_part(name, '/', 1))) in ('owner', 'nutritionist')
);

drop policy if exists "Nutritionists can update NutriOS branding objects"
on storage.objects;

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

drop policy if exists "Nutritionists can delete NutriOS branding objects"
on storage.objects;

create policy "Nutritionists can delete NutriOS branding objects"
on storage.objects for delete
using (
  bucket_id = 'nutrios-branding'
  and public.current_tenant_role(public.try_uuid(split_part(name, '/', 1))) in ('owner', 'nutritionist')
);

drop policy if exists "Allowed users can insert weight logs"
on public.weight_logs;

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

drop policy if exists "Allowed users can insert waist logs"
on public.waist_logs;

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

drop policy if exists "Allowed users can insert exercise logs"
on public.exercise_logs;

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

drop policy if exists "Allowed users can insert meal photos"
on public.meal_photos;

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
