-- Study Zone migration 003 — Android / offline / notification preferences
--
-- Additive and idempotent. Safe to run on an existing project and safe to
-- re-run. It never drops or truncates data, and every new table keeps RLS
-- enabled with owner-scoped policies.

-- Theme preset id plus per-user notification settings live on the profile row
-- that the web and Android clients already read. Defaults keep existing rows
-- valid without a backfill.
alter table public.profiles
  add column if not exists theme text;

alter table public.profiles
  add column if not exists notification_settings jsonb;

-- Device push tokens (optional FCM path). Rows are scoped to their owner.
create table if not exists public.device_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  token text not null,
  platform text not null default 'android',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, token)
);

alter table public.device_push_tokens enable row level security;

drop policy if exists device_push_tokens_select_own on public.device_push_tokens;
create policy device_push_tokens_select_own on public.device_push_tokens
  for select using (auth.uid() = user_id);

drop policy if exists device_push_tokens_insert_own on public.device_push_tokens;
create policy device_push_tokens_insert_own on public.device_push_tokens
  for insert with check (auth.uid() = user_id);

drop policy if exists device_push_tokens_update_own on public.device_push_tokens;
create policy device_push_tokens_update_own on public.device_push_tokens
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists device_push_tokens_delete_own on public.device_push_tokens;
create policy device_push_tokens_delete_own on public.device_push_tokens
  for delete using (auth.uid() = user_id);

create index if not exists device_push_tokens_user_idx
  on public.device_push_tokens (user_id);
