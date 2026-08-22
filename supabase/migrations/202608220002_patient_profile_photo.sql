alter table public.patients
add column if not exists profile_photo_path text;

comment on column public.patients.profile_photo_path is
'Private storage path for the patient profile photo.';
