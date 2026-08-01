alter table public.patients
  add column if not exists objective text
    check (
      objective is null
      or objective in (
        'Reducir peso',
        'Ganar masa muscular',
        'Bienestar',
        'Aprendizaje'
      )
    ),
  add column if not exists sex text
    check (sex is null or sex in ('male', 'female')),
  add column if not exists exercise_hours_per_week numeric(5,2)
    check (
      exercise_hours_per_week is null
      or exercise_hours_per_week between 0 and 168
    ),
  add column if not exists exercise_type text,
  add column if not exists questionnaire_version integer not null default 1,
  add column if not exists questionnaire_completed_at timestamptz;
