alter table public.exercise_logs
  add column if not exists duration_seconds integer
    check (duration_seconds is null or duration_seconds between 0 and 86400),
  add column if not exists distance_km numeric(7,2)
    check (distance_km is null or distance_km between 0 and 1000);

update public.exercise_logs
set duration_seconds = duration_minutes * 60
where duration_seconds is null
  and duration_minutes is not null;
