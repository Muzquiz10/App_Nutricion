do $$
declare
  target_email text := 'ej.garcia@minor-hotels.com';

  target_user_id uuid;
  target_patient_ids uuid[];
begin
  select id
  into target_user_id
  from auth.users
  where lower(email) = lower(target_email);

  select coalesce(array_agg(id), '{}')
  into target_patient_ids
  from public.patients
  where user_id = target_user_id;

  delete from public.invitations
  where lower(email) = lower(target_email);

  delete from public.patients
  where id = any(target_patient_ids);

  if target_user_id is not null then
    delete from auth.users
    where id = target_user_id;
  end if;

  raise notice 'Correo: %, auth_user_id: %, pacientes borrados: %',
    target_email,
    target_user_id,
    coalesce(array_length(target_patient_ids, 1), 0);
end $$;