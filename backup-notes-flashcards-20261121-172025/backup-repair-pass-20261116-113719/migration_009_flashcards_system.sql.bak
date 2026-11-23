-- Study Zone: Flashcards spaced repetition system (additive migration).
--
-- Creates the local-first flashcard persistence tables used by the web app and
-- the Capacitor shell. Fully additive: no existing table or column is touched.
-- Safe to run more than once.

begin;

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Decks
-- ---------------------------------------------------------------------------
create table if not exists public.flashcard_decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  parent_id uuid references public.flashcard_decks (id) on delete set null,
  name text not null,
  description text,
  color text default "#06D6A0",
  icon text default "f",
  subject_id text,
  new_per_day integer not null default 20,
  reviews_per_day integer not null default 200,
  desired_retention numeric not null default 0.9,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists flashcard_decks_user_idx
  on public.flashcard_decks (user_id, deleted_at);
create index if not exists flashcard_decks_parent_idx
  on public.flashcard_decks (parent_id);

alter table public.flashcard_decks enable row level security;
drop policy if exists "flashcard_decks_select_own" on public.flashcard_decks;
create policy "flashcard_decks_select_own"
  on public.flashcard_decks for select to authenticated
  using (auth.uid() = user_id);
drop policy if exists "flashcard_decks_insert_own" on public.flashcard_decks;
create policy "flashcard_decks_insert_own"
  on public.flashcard_decks for insert to authenticated
  with check (auth.uid() = user_id);
drop policy if exists "flashcard_decks_update_own" on public.flashcard_decks;
create policy "flashcard_decks_update_own"
  on public.flashcard_decks for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "flashcard_decks_delete_own" on public.flashcard_decks;
create policy "flashcard_decks_delete_own"
  on public.flashcard_decks for delete to authenticated
  using (auth.uid() = user_id);

create or replace function public.flashcard_set_user_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is null then
    new.user_id := auth.uid();
  end if;
  if new.updated_at is null then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

create or replace function public.flashcard_block_user_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = TG_TABLE
      and column_name = 'user_id'
      and (old.user_id is distinct from new.user_id)
  ) then
    raise exception 'flashcard user_id is immutable';
  end if;
  return new;
end;
$$;

create trigger if not exists flashcard_decks_user_id_default
  before insert or update on public.flashcard_decks
  for each row execute function public.flashcard_set_user_id();
create trigger if not exists flashcard_decks_user_id_immutable
  before update on public.flashcard_decks
  for each row execute function public.flashcard_block_user_change();

-- ---------------------------------------------------------------------------
-- Notes (content containers that generate cards)
-- ---------------------------------------------------------------------------
create table if not exists public.flashcard_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  deck_id uuid not null references public.flashcard_decks (id) on delete cascade,
  type text not null default 'basic',
  fields jsonb not null default '{}'::jsonb,
  tags text[] not null default '{}',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists flashcard_notes_deck_idx
  on public.flashcard_notes (deck_id, deleted_at);

alter table public.flashcard_notes enable row level security;
drop policy if exists "flashcard_notes_select_own" on public.flashcard_notes;
create policy "flashcard_notes_select_own"
  on public.flashcard_notes for select to authenticated
  using (auth.uid() = user_id);
drop policy if exists "flashcard_notes_insert_own" on public.flashcard_notes;
create policy "flashcard_notes_insert_own"
  on public.flashcard_notes for insert to authenticated
  with check (auth.uid() = user_id);
drop policy if exists "flashcard_notes_update_own" on public.flashcard_notes;
create policy "flashcard_notes_update_own"
  on public.flashcard_notes for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "flashcard_notes_delete_own" on public.flashcard_notes;
create policy "flashcard_notes_delete_own"
  on public.flashcard_notes for delete to authenticated
  using (auth.uid() = user_id);

create trigger if not exists flashcard_notes_user_id_default
  before insert or update on public.flashcard_notes
  for each row execute function public.flashcard_set_user_id();
create trigger if not exists flashcard_notes_user_id_immutable
  before update on public.flashcard_notes
  for each row execute function public.flashcard_block_user_change();

-- ---------------------------------------------------------------------------
-- Cards (scheduling units)
-- ---------------------------------------------------------------------------
create table if not exists public.flashcard_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  note_id uuid references public.flashcard_notes (id) on delete cascade,
  deck_id uuid not null references public.flashcard_decks (id) on delete cascade,
  template text not null default 'basic',
  type text not null default 'basic',
  front text not null default '',
  back text not null default '',
  media_id uuid,
  state text not null default 'new',
  due_at timestamptz not null default now(),
  interval_days numeric not null default 0,
  ease numeric not null default 2.5,
  reps integer not null default 0,
  lapses integer not null default 0,
  learning_step integer not null default 0,
  last_reviewed_at timestamptz,
  suspended boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists flashcard_cards_deck_idx
  on public.flashcard_cards (deck_id, deleted_at);
create index if not exists flashcard_cards_user_deck_idx
  on public.flashcard_cards (user_id, deck_id, deleted_at);
create index if not exists flashcard_cards_user_due_idx
  on public.flashcard_cards (user_id, due_at)
  where deleted_at is null;

create unique index if not exists flashcard_cards_user_note_template
  on public.flashcard_cards (user_id, note_id, template)
  where deleted_at is null;

alter table public.flashcard_cards enable row level security;
drop policy if exists "flashcard_cards_select_own" on public.flashcard_cards;
create policy "flashcard_cards_select_own"
  on public.flashcard_cards for select to authenticated
  using (auth.uid() = user_id);
drop policy if exists "flashcard_cards_insert_own" on public.flashcard_cards;
create policy "flashcard_cards_insert_own"
  on public.flashcard_cards for insert to authenticated
  with check (auth.uid() = user_id);
drop policy if exists "flashcard_cards_update_own" on public.flashcard_cards;
create policy "flashcard_cards_update_own"
  on public.flashcard_cards for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "flashcard_cards_delete_own" on public.flashcard_cards;
create policy "flashcard_cards_delete_own"
  on public.flashcard_cards for delete to authenticated
  using (auth.uid() = user_id);

create trigger if not exists flashcard_cards_user_id_default
  before insert or update on public.flashcard_cards
  for each row execute function public.flashcard_set_user_id();
create trigger if not exists flashcard_cards_user_id_immutable
  before update on public.flashcard_cards
  for each row execute function public.flashcard_block_user_change();

-- ---------------------------------------------------------------------------
-- Review logs (append-only scheduling history)
-- ---------------------------------------------------------------------------
create table if not exists public.flashcard_review_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  card_id uuid not null references public.flashcard_cards (id) on delete cascade,
  deck_id uuid references public.flashcard_decks (id) on delete set null,
  rating integer not null check (rating between 1 and 4),
  reviewed_at timestamptz not null default now(),
  local_day date,
  was_new boolean not null default false,
  state text,
  interval_days numeric,
  ease numeric,
  lapses integer,
  learning_step integer,
  duration_ms integer,
  created_at timestamptz not null default now()
);

create index if not exists flashcard_reviews_user_day_idx
  on public.flashcard_review_logs (user_id, reviewed_at);
create index if not exists flashcard_reviews_card_idx
  on public.flashcard_review_logs (card_id);
create index if not exists flashcard_reviews_deck_idx
  on public.flashcard_review_logs (deck_id);

alter table public.flashcard_review_logs enable row level security;
drop policy if exists "flashcard_reviews_select_own" on public.flashcard_review_logs;
create policy "flashcard_reviews_select_own"
  on public.flashcard_review_logs for select to authenticated
  using (auth.uid() = user_id);
drop policy if exists "flashcard_reviews_insert_own" on public.flashcard_review_logs;
create policy "flashcard_reviews_insert_own"
  on public.flashcard_review_logs for insert to authenticated
  with check (auth.uid() = user_id);
drop policy if exists "flashcard_reviews_update_own" on public.flashcard_review_logs;
create policy "flashcard_reviews_update_own"
  on public.flashcard_review_logs for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "flashcard_reviews_delete_own" on public.flashcard_review_logs;
create policy "flashcard_reviews_delete_own"
  on public.flashcard_review_logs for delete to authenticated
  using (auth.uid() = user_id);

create trigger if not exists flashcard_reviews_user_id_default
  before insert or update on public.flashcard_review_logs
  for each row execute function public.flashcard_set_user_id();

-- ---------------------------------------------------------------------------
-- Media attachments
-- ---------------------------------------------------------------------------
create table if not exists public.flashcard_media (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null default 'image',
  name text,
  mime_type text,
  data_url text,
  byte_size integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists flashcard_media_user_idx
  on public.flashcard_media (user_id, deleted_at);

alter table public.flashcard_media enable row level security;
drop policy if exists "flashcard_media_select_own" on public.flashcard_media;
create policy "flashcard_media_select_own"
  on public.flashcard_media for select to authenticated
  using (auth.uid() = user_id);
drop policy if exists "flashcard_media_insert_own" on public.flashcard_media;
create policy "flashcard_media_insert_own"
  on public.flashcard_media for insert to authenticated
  with check (auth.uid() = user_id);
drop policy if exists "flashcard_media_delete_own" on public.flashcard_media;
create policy "flashcard_media_delete_own"
  on public.flashcard_media for delete to authenticated
  using (auth.uid() = user_id);

create trigger if not exists flashcard_media_user_id_default
  before insert or update on public.flashcard_media
  for each row execute function public.flashcard_set_user_id();

-- ---------------------------------------------------------------------------
-- Per-user settings
-- ---------------------------------------------------------------------------
create table if not exists public.flashcard_user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.flashcard_user_settings enable row level security;
drop policy if exists "flashcard_settings_select_own" on public.flashcard_user_settings;
create policy "flashcard_settings_select_own"
  on public.flashcard_user_settings for select to authenticated
  using (auth.uid() = user_id);
drop policy if exists "flashcard_settings_insert_own" on public.flashcard_user_settings;
create policy "flashcard_settings_insert_own"
  on public.flashcard_user_settings for insert to authenticated
  with check (auth.uid() = user_id);
drop policy if exists "flashcard_settings_update_own" on public.flashcard_user_settings;
create policy "flashcard_settings_update_own"
  on public.flashcard_user_settings for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- XP ledger (one daily award per user, idempotent)
-- ---------------------------------------------------------------------------
create table if not exists public.flashcard_xp_awards (
  user_id uuid not null references auth.users (id) on delete cascade,
  award_day date not null,
  amount integer not null default 10,
  created_at timestamptz not null default now(),
  primary key (user_id, award_day)
);

create or replace function public.flashcard_award_daily_xp()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_today date;
  v_count integer;
  v_table text := 'public.user_xp';
  v_column text := 'total_xp';
begin
  v_user := auth.uid();
  if v_user is null then return; end if;
  v_today := (now() AT TIME ZONE 'UTC')::date;

  if to_regclass(v_table) is null then return; end if;
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'user_xp' and column_name = 'total_xp'
  ) then
    return;
  end if;

  select count(*) into v_count
  from public.flashcard_review_logs
  where user_id = v_user
    and (local_day = v_today or reviewed_at >= date_trunc('day', now()));

  if v_count < 10 then return; end if;

  if exists (
    select 1 from public.flashcard_xp_awards
    where user_id = v_user and award_day = v_today
  ) then
    return;
  end if;

  insert into public.flashcard_xp_awards (user_id, award_day, amount)
  values (v_user, v_today, 10);

  execute format(
    'update public.user_xp set total_xp = coalesce(total_xp, 0) + %s where user_id = $1',
    '10'
  ) using v_user;
end;
$$;

grant execute on function public.flashcard_award_daily_xp() to authenticated;

commit;
