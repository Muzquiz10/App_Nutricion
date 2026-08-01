drop policy if exists "Allowed users can delete meal photos"
on public.meal_photos;

create policy "Allowed users can delete meal photos"
on public.meal_photos for delete
using (public.can_access_patient(patient_id));
