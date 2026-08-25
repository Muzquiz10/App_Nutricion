alter table public.patients
  add column if not exists portal_access jsonb not null default '{
    "goals": true,
    "plans": true,
    "data_entry": true,
    "activities": true,
    "stats": true,
    "chat": true,
    "documents": true,
    "agenda": true
  }'::jsonb,
  add column if not exists onboarding_mode text not null default 'self';

alter table public.invitations
  add column if not exists portal_access jsonb not null default '{
    "goals": true,
    "plans": true,
    "data_entry": true,
    "activities": true,
    "stats": true,
    "chat": true,
    "documents": true,
    "agenda": true
  }'::jsonb;

alter table public.patients
  alter column age drop not null,
  alter column height_cm drop not null,
  alter column initial_weight_kg drop not null,
  alter column current_weight_kg drop not null;

update public.patients
set portal_access = coalesce(
  portal_access,
  '{
    "goals": true,
    "plans": true,
    "data_entry": true,
    "activities": true,
    "stats": true,
    "chat": true,
    "documents": true,
    "agenda": true
  }'::jsonb
);

update public.invitations
set portal_access = coalesce(
  portal_access,
  '{
    "goals": true,
    "plans": true,
    "data_entry": true,
    "activities": true,
    "stats": true,
    "chat": true,
    "documents": true,
    "agenda": true
  }'::jsonb
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'patients_onboarding_mode_check'
      and conrelid = 'public.patients'::regclass
  ) then
    alter table public.patients
      add constraint patients_onboarding_mode_check
      check (onboarding_mode in ('self', 'professional'));
  end if;
end $$;

comment on column public.patients.portal_access is
  'Per-client module visibility for the client portal. Mi Ficha Personal is always visible.';

comment on column public.patients.onboarding_mode is
  'self when the client completed the initial form, professional when the professional created the profile directly.';

comment on column public.invitations.portal_access is
  'Initial per-client module visibility applied when the invited client completes onboarding.';
