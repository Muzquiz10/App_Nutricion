create table if not exists public.notification_preferences (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email_enabled boolean not null default true,
  push_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  is_active boolean not null default true,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  patient_id uuid references public.patients(id) on delete cascade,
  type text not null check (type in ('chat_message', 'appointment')),
  title text not null,
  body text not null,
  href text,
  related_message_id uuid references public.chat_messages(id) on delete cascade,
  read_at timestamptz,
  email_fallback_due_at timestamptz,
  email_sent_at timestamptz,
  email_error text,
  created_at timestamptz not null default now()
);

create index if not exists idx_app_notifications_user_date
on public.app_notifications(user_id, created_at desc);

create index if not exists idx_app_notifications_email_due
on public.app_notifications(email_fallback_due_at)
where email_fallback_due_at is not null and email_sent_at is null;

create index if not exists idx_push_subscriptions_user
on public.push_subscriptions(user_id, is_active);

drop trigger if exists set_notification_preferences_updated_at on public.notification_preferences;
create trigger set_notification_preferences_updated_at
before update on public.notification_preferences
for each row execute function public.set_updated_at();

drop trigger if exists set_push_subscriptions_updated_at on public.push_subscriptions;
create trigger set_push_subscriptions_updated_at
before update on public.push_subscriptions
for each row execute function public.set_updated_at();

alter table public.notification_preferences enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.app_notifications enable row level security;

drop policy if exists "Users can read own notification preferences" on public.notification_preferences;
create policy "Users can read own notification preferences"
on public.notification_preferences for select
using (user_id = auth.uid());

drop policy if exists "Users can create own notification preferences" on public.notification_preferences;
create policy "Users can create own notification preferences"
on public.notification_preferences for insert
with check (
  user_id = auth.uid()
  and (
    public.current_tenant_role(tenant_id) in ('owner', 'nutritionist')
    or exists (
      select 1
      from public.patients p
      where p.tenant_id = notification_preferences.tenant_id
        and p.user_id = auth.uid()
    )
  )
);

drop policy if exists "Users can update own notification preferences" on public.notification_preferences;
create policy "Users can update own notification preferences"
on public.notification_preferences for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users can read own push subscriptions" on public.push_subscriptions;
create policy "Users can read own push subscriptions"
on public.push_subscriptions for select
using (user_id = auth.uid());

drop policy if exists "Users can create own push subscriptions" on public.push_subscriptions;
create policy "Users can create own push subscriptions"
on public.push_subscriptions for insert
with check (
  user_id = auth.uid()
  and (
    public.current_tenant_role(tenant_id) in ('owner', 'nutritionist')
    or exists (
      select 1
      from public.patients p
      where p.tenant_id = push_subscriptions.tenant_id
        and p.user_id = auth.uid()
    )
  )
);

drop policy if exists "Users can update own push subscriptions" on public.push_subscriptions;
create policy "Users can update own push subscriptions"
on public.push_subscriptions for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users can delete own push subscriptions" on public.push_subscriptions;
create policy "Users can delete own push subscriptions"
on public.push_subscriptions for delete
using (user_id = auth.uid());

drop policy if exists "Users can read own app notifications" on public.app_notifications;
create policy "Users can read own app notifications"
on public.app_notifications for select
using (user_id = auth.uid());

drop policy if exists "Users can update own app notifications" on public.app_notifications;
create policy "Users can update own app notifications"
on public.app_notifications for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  )
  and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'app_notifications'
  ) then
    alter publication supabase_realtime add table public.app_notifications;
  end if;
end $$;
