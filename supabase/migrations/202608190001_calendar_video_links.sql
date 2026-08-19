alter table public.calendar_events
add column if not exists video_url text;

comment on column public.calendar_events.video_url is
'Enlace opcional para videollamadas en citas online.';
