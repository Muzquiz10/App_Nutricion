create table if not exists public.analytics_sessions (
  id uuid primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'nutritionist', 'patient')),
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  ended_at timestamptz,
  user_agent text,
  device_type text not null default 'unknown'
    check (device_type in ('desktop', 'mobile', 'tablet', 'unknown')),
  created_at timestamptz not null default now()
);

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  session_id uuid not null references public.analytics_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'nutritionist', 'patient')),
  patient_id uuid references public.patients(id) on delete set null,
  event_name text not null
    check (event_name in ('session_start', 'tab_view', 'session_end')),
  tab_id text,
  tab_label text,
  duration_seconds integer
    check (duration_seconds is null or duration_seconds between 0 and 86400),
  device_type text not null default 'unknown'
    check (device_type in ('desktop', 'mobile', 'tablet', 'unknown')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_analytics_sessions_tenant_date
on public.analytics_sessions(tenant_id, started_at desc);

create index if not exists idx_analytics_sessions_user_date
on public.analytics_sessions(user_id, started_at desc);

create index if not exists idx_analytics_events_tenant_date
on public.analytics_events(tenant_id, created_at desc);

create index if not exists idx_analytics_events_user_date
on public.analytics_events(user_id, created_at desc);

create index if not exists idx_analytics_events_session_date
on public.analytics_events(session_id, created_at asc);

create index if not exists idx_analytics_events_tab_usage
on public.analytics_events(tenant_id, tab_id, created_at desc)
where event_name = 'tab_view';

alter table public.analytics_sessions enable row level security;
alter table public.analytics_events enable row level security;

comment on table public.analytics_sessions is
'Sesiones de uso de B-aura Connect para analitica de producto. Se escribe desde la API interna con service role.';

comment on table public.analytics_events is
'Eventos de uso no sensibles. No guardar contenido clinico, chats, fotos, alergias ni valores de salud.';

create or replace view public.analytics_powerbi_tab_usage
with (security_invoker = true)
as
select
  e.tenant_id,
  t.name as tenant_name,
  e.user_id,
  e.role,
  e.patient_id,
  date_trunc('day', e.created_at)::date as activity_date,
  e.session_id,
  e.tab_id,
  e.tab_label,
  count(*) as tab_visits,
  coalesce(sum(e.duration_seconds), 0)::integer as total_duration_seconds,
  min(e.created_at) as first_event_at,
  max(e.created_at) as last_event_at
from public.analytics_events e
join public.tenants t on t.id = e.tenant_id
where e.event_name = 'tab_view'
group by
  e.tenant_id,
  t.name,
  e.user_id,
  e.role,
  e.patient_id,
  date_trunc('day', e.created_at)::date,
  e.session_id,
  e.tab_id,
  e.tab_label;

create or replace view public.analytics_powerbi_sessions
with (security_invoker = true)
as
select
  s.tenant_id,
  t.name as tenant_name,
  s.user_id,
  s.role,
  s.id as session_id,
  s.started_at,
  s.last_seen_at,
  s.ended_at,
  s.device_type,
  greatest(
    0,
    extract(epoch from coalesce(s.ended_at, s.last_seen_at) - s.started_at)::integer
  ) as session_duration_seconds,
  count(e.id) filter (where e.event_name = 'tab_view') as tab_view_events
from public.analytics_sessions s
join public.tenants t on t.id = s.tenant_id
left join public.analytics_events e on e.session_id = s.id
group by
  s.tenant_id,
  t.name,
  s.user_id,
  s.role,
  s.id,
  s.started_at,
  s.last_seen_at,
  s.ended_at,
  s.device_type;
