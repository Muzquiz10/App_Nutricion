update public.tenants
set primary_color = '#71c176'
where primary_color is distinct from '#71c176';

update public.tenants
set name = replace(name, 'DietDesk', 'B-aura Connect')
where name like '%DietDesk%';
