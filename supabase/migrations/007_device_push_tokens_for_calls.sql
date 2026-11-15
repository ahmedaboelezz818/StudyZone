-- Device push tokens for native app notifications (including incoming calls).
-- Additive and idempotent: safe to re-run.

create extension if not exists "pgcrypto";

create table if not exists public.device_push_tokens (
  user_id uuid not null references public.profiles (id) on delete cascade,
  token text not null,
  platform text not null default 'android',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, token)
);

alter table public.device_push_tokens enable row level security;

drop policy if exists device_push_tokens_select_own on public.device_push_tokens;
create policy device_push_tokens_select_own
  on public.device_push_tokens
  for select
  using (auth.uid() = user_id);

drop policy if exists device_push_tokens_insert_own on public.device_push_tokens;
create policy device_push_tokens_insert_own
  on public.device_push_tokens
  for insert
  with check (auth.uid() = user_id);

drop policy if exists device_push_tokens_update_own on public.device_push_tokens;
create policy device_push_tokens_update_own
  on public.device_push_tokens
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists device_push_tokens_delete_own on public.device_push_tokens;
create policy device_push_tokens_delete_own
  on public.device_push_tokens
  for delete
  using (auth.uid() = user_id);

create index if not exists device_push_tokens_user_platform_idx
  on public.device_push_tokens (user_id, platform);

grant select, insert, update, delete on public.device_push_tokens to authenticated;
