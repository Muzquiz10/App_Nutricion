alter table public.meal_items
  add column if not exists quantity numeric(8,2),
  add column if not exists unit text,
  add column if not exists food_name text;

update public.meal_items
set food_name = title
where food_name is null;
