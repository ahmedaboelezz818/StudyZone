-- Study Zone: Team Live reactions + RPC compatibility.
--
-- Additive, re-runnable migration. It never drops tables or columns and never
-- truncates data. Its goals:
--   1. One emoji per user per message, enforced by a unique index and RLS.
--   2. Realtime support for reactions.
--   3. Overloads for the RPC argument shapes used by team-live.js.
--   4. The message columns the client already selects but migration 006 does
--      not create (team_id, attachment_path, edited_at, deleted_by).
--
-- Apply after 006 (and 007). Safe to run more than once.

begin;

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- 1. team_messages compatibility columns used by the client.
-- ---------------------------------------------------------------------------
alter table public.team_messages add column if not exists team_id uuid;
alter table public.team_messages add column if not exists attachment_path text;
alter table public.team_messages add column if not exists edited_at timestamptz;
alter table public.team_messages add column if not exists deleted_by uuid;
alter table public.team_messages add column if not exists updated_at timestamptz default now();

-- Messages with an attachment legitimately carry a null body.
alter table public.team_messages alter column body drop not null;

-- Backfill team_id from the conversation when possible.
update public.team_messages m
set team_id = c.team_id
from public.team_conversations c
where m.team_id is null
  and c.id = m.conversation_id;

-- Older schemas used storage_path; mirror it into attachment_path.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'team_messages'
      and column_name = 'storage_path'
  ) then
    execute $sql$
      update public.team_messages
      set attachment_path = storage_path
      where attachment_path is null
        and storage_path is not null
    $sql$;
  end if;
end;
$$;

create index if not exists team_messages_conversation_created_idx
  on public.team_messages (conversation_id, created_at desc);

-- Fill values the client intentionally lets the database own. Existing
-- triggers in a live database may already do this; filling only nulls keeps
-- this trigger compatible with them.
create or replace function public.team_live_prepare_message_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.id is null then
    new.id := gen_random_uuid();
  end if;
  if new.sender_id is null then
    new.sender_id := auth.uid();
  end if;
  if new.team_id is null then
    new.team_id := public.team_live_conversation_team(new.conversation_id);
  end if;
  if new.created_at is null then
    new.created_at := now();
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists team_live_prepare_message_row_008 on public.team_messages;
create trigger team_live_prepare_message_row_008
  before insert on public.team_messages
  for each row execute function public.team_live_prepare_message_row();

create or replace function public.team_live_touch_message_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.sender_id is distinct from old.sender_id then
    raise exception 'The message sender cannot be changed';
  end if;
  if new.conversation_id is distinct from old.conversation_id then
    raise exception 'A message cannot move between conversations';
  end if;
  new.updated_at := now();
  if new.body is distinct from old.body and old.deleted_at is null then
    new.edited_at := coalesce(new.edited_at, now());
  end if;
  return new;
end;
$$;

drop trigger if exists team_live_touch_message_row_008 on public.team_messages;
create trigger team_live_touch_message_row_008
  before update on public.team_messages
  for each row execute function public.team_live_touch_message_row();

-- Re-assert message ownership in RLS. The trigger above fills sender_id, and
-- these policies stop a member from posting or editing as somebody else. Team
-- owners/admins keep the moderation ability the UI already exposes.
drop policy if exists team_live_message_insert on public.team_messages;
create policy team_live_message_insert on public.team_messages
  for insert with check (
    sender_id = auth.uid()
    and public.team_live_is_member(
      public.team_live_conversation_team(conversation_id),
      auth.uid()
    )
  );

drop policy if exists team_live_message_update on public.team_messages;
create policy team_live_message_update on public.team_messages
  for update using (
    public.team_live_is_member(
      public.team_live_conversation_team(conversation_id),
      auth.uid()
    )
    and (
      sender_id = auth.uid()
      or exists (
        select 1
        from public.team_memberships m
        where m.team_id = public.team_live_conversation_team(conversation_id)
          and m.user_id = auth.uid()
          and m.role in ('owner', 'admin')
      )
    )
  )
  with check (
    public.team_live_is_member(
      public.team_live_conversation_team(conversation_id),
      auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 2. Reactions: one emoji per user per message.
-- ---------------------------------------------------------------------------
create table if not exists public.team_message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.team_messages (id) on delete cascade,
  conversation_id uuid not null references public.team_conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now()
);

-- If an older version of the table exists, make sure every client column is
-- present. Message/conversation/user ids stay nullable here so backfilling
-- never fails; the cleanup below removes unusable rows before the unique
-- index is created.
alter table public.team_message_reactions add column if not exists id uuid default gen_random_uuid();
alter table public.team_message_reactions add column if not exists message_id uuid;
alter table public.team_message_reactions add column if not exists conversation_id uuid;
alter table public.team_message_reactions add column if not exists user_id uuid;
alter table public.team_message_reactions add column if not exists emoji text;
alter table public.team_message_reactions add column if not exists created_at timestamptz default now();

-- Repair missing conversation ids and drop rows that cannot reference a
-- message, then keep only the newest reaction per (message, user).
update public.team_message_reactions r
set conversation_id = m.conversation_id
from public.team_messages m
where r.message_id = m.id
  and (r.conversation_id is null or r.conversation_id <> m.conversation_id);

delete from public.team_message_reactions
where message_id is null
   or user_id is null
   or emoji is null
   or btrim(emoji) = '';

delete from public.team_message_reactions older
using public.team_message_reactions newer
where older.message_id = newer.message_id
  and older.user_id = newer.user_id
  and (
    coalesce(older.created_at, 'epoch'::timestamptz) < coalesce(newer.created_at, 'epoch'::timestamptz)
    or (
      coalesce(older.created_at, 'epoch'::timestamptz) = coalesce(newer.created_at, 'epoch'::timestamptz)
      and older.id::text < newer.id::text
    )
  );

create unique index if not exists team_message_reactions_one_per_user
  on public.team_message_reactions (message_id, user_id);

create index if not exists team_message_reactions_conversation_idx
  on public.team_message_reactions (conversation_id, message_id);

alter table public.team_message_reactions enable row level security;
alter table public.team_message_reactions replica identity full;

-- The client sends only message_id, conversation_id, user_id and emoji. Derive
-- the canonical conversation from the message so a reaction can never land in
-- the wrong chat.
create or replace function public.team_live_prepare_reaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conversation_id uuid;
begin
  if new.message_id is null then
    raise exception 'A reaction needs a message';
  end if;
  if new.user_id is null then
    new.user_id := auth.uid();
  end if;
  if auth.uid() is not null and new.user_id <> auth.uid() then
    raise exception 'A reaction can only be written for the signed-in user';
  end if;
  select m.conversation_id into v_conversation_id
  from public.team_messages m
  where m.id = new.message_id;
  if v_conversation_id is null then
    raise exception 'Message not found';
  end if;
  if new.conversation_id is not null and new.conversation_id <> v_conversation_id then
    raise exception 'Reaction conversation does not match the message';
  end if;
  if new.emoji is null or btrim(new.emoji) = '' or char_length(new.emoji) > 16 then
    raise exception 'Invalid reaction emoji';
  end if;
  new.conversation_id := v_conversation_id;
  new.created_at := coalesce(new.created_at, now());
  return new;
end;
$$;

drop trigger if exists team_live_prepare_reaction_008 on public.team_message_reactions;
create trigger team_live_prepare_reaction_008
  before insert or update on public.team_message_reactions
  for each row execute function public.team_live_prepare_reaction();

drop policy if exists team_live_reaction_select on public.team_message_reactions;
create policy team_live_reaction_select on public.team_message_reactions
  for select using (
    public.team_live_is_member(
      public.team_live_conversation_team(conversation_id),
      auth.uid()
    )
  );

drop policy if exists team_live_reaction_insert on public.team_message_reactions;
create policy team_live_reaction_insert on public.team_message_reactions
  for insert with check (
    user_id = auth.uid()
    and public.team_live_is_member(
      public.team_live_conversation_team(conversation_id),
      auth.uid()
    )
  );

drop policy if exists team_live_reaction_update on public.team_message_reactions;
create policy team_live_reaction_update on public.team_message_reactions
  for update using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and public.team_live_is_member(
      public.team_live_conversation_team(conversation_id),
      auth.uid()
    )
  );

drop policy if exists team_live_reaction_delete on public.team_message_reactions;
create policy team_live_reaction_delete on public.team_message_reactions
  for delete using (user_id = auth.uid());

grant select, insert, update, delete on public.team_message_reactions to authenticated;

-- Publish reaction changes so other devices update without a refresh.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'team_message_reactions'
     ) then
    execute 'alter publication supabase_realtime add table public.team_message_reactions';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. RPC overloads used by the Android/web client.
--
-- PostgreSQL does not allow adding default values to an existing signature,
-- so each shape the client calls gets an explicit, small overload. The
-- signed-in user always comes from auth.uid() here; the client never supplies
-- a user id.
-- ---------------------------------------------------------------------------

create or replace function public.team_live_join_call(p_call_id uuid)
returns public.team_calls
language plpgsql
security definer
set search_path = public
as $$
declare
  v_call public.team_calls;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select c.* into v_call from public.team_calls c where c.id = p_call_id;
  if v_call.id is null then
    raise exception 'Call not found';
  end if;
  if v_call.status in ('ended', 'missed') then
    raise exception 'This call has ended';
  end if;
  if not public.team_live_is_member(v_call.team_id, v_user_id) then
    raise exception 'Not a team member';
  end if;

  -- Ignore this very call when checking for another live call. The old check
  -- also matched the invite row of the call being joined, which made every
  -- join fail with "You are already in a call".
  if exists (
    select 1
    from public.team_call_participants p
    join public.team_calls c on c.id = p.call_id
    where p.user_id = v_user_id
      and p.call_id <> p_call_id
      and p.invite_status = 'accepted'
      and p.left_at is null
      and c.status not in ('ended', 'missed')
  ) then
    raise exception 'You are already in a call';
  end if;

  insert into public.team_call_participants (call_id, user_id, invite_status, joined_at, left_at)
  values (p_call_id, v_user_id, 'accepted', now(), null)
  on conflict (call_id, user_id) do update
  set invite_status = 'accepted',
      joined_at = now(),
      left_at = null;

  update public.team_calls
  set status = 'active',
      started_at = coalesce(started_at, now()),
      connected_at = now(),
      last_signal_at = now()
  where id = p_call_id
  returning * into v_call;

  return v_call;
end;
$$;

create or replace function public.team_live_leave_call(p_call_id uuid)
returns public.team_calls
language plpgsql
security definer
set search_path = public
as $$
declare
  v_call public.team_calls;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select c.* into v_call from public.team_calls c where c.id = p_call_id;
  if v_call.id is null then
    raise exception 'Call not found';
  end if;
  if not public.team_live_is_member(v_call.team_id, v_user_id) then
    raise exception 'Not a team member';
  end if;

  update public.team_call_participants
  set invite_status = 'left',
      left_at = now()
  where call_id = p_call_id
    and user_id = v_user_id;

  return v_call;
end;
$$;

create or replace function public.team_live_respond_call(p_call_id uuid, p_accept boolean)
returns public.team_call_participants
language plpgsql
security definer
set search_path = public
as $$
declare
  v_call public.team_calls;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select c.* into v_call from public.team_calls c where c.id = p_call_id;
  if v_call.id is null then
    raise exception 'Call not found';
  end if;
  if not public.team_live_is_member(v_call.team_id, v_user_id) then
    raise exception 'Not a team member';
  end if;

  update public.team_call_participants
  set invite_status = case when p_accept then 'accepted' else 'declined' end,
      joined_at = case when p_accept then now() else joined_at end,
      left_at = case when p_accept then null else now() end
  where call_id = p_call_id
    and user_id = v_user_id;

  if p_accept then
    update public.team_calls
    set status = 'active',
        started_at = coalesce(started_at, now()),
        connected_at = now()
    where id = p_call_id
      and status <> 'ended';
  end if;

  return null;
end;
$$;

create or replace function public.team_live_pending_invites()
returns table (
  call_id uuid,
  call_type text,
  caller_id uuid,
  team_name text,
  title text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select c.id, c.call_type, c.created_by, t.name, c.title, c.created_at
  from public.team_calls c
  join public.teams t on t.id = c.team_id
  join public.team_call_participants p
    on p.call_id = c.id
   and p.user_id = auth.uid()
   and p.invite_status = 'invited'
  where c.status = 'ringing'
    and c.created_at > now() - interval '15 minutes'
    and public.team_live_is_member(c.team_id, auth.uid());
$$;

create or replace function public.team_chat_mark_read(
  p_conversation_id uuid,
  p_at timestamptz,
  p_message_id uuid
)
returns public.team_conversation_reads
language plpgsql
security definer
set search_path = public
as $$
declare
  v_read public.team_conversation_reads;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  if not public.team_live_is_member(
    public.team_live_conversation_team(p_conversation_id),
    v_user_id
  ) then
    raise exception 'Not a team member';
  end if;

  insert into public.team_conversation_reads (conversation_id, user_id, last_read_at, last_message_id)
  values (
    p_conversation_id,
    v_user_id,
    least(coalesce(p_at, now()), now()),
    p_message_id
  )
  on conflict (conversation_id, user_id) do update
  set last_read_at = greatest(
        public.team_conversation_reads.last_read_at,
        least(coalesce(p_at, now()), now())
      ),
      last_message_id = coalesce(p_message_id, public.team_conversation_reads.last_message_id)
  returning * into v_read;

  return v_read;
end;
$$;

-- New, unambiguous name for the task-chat entry point. The historical
-- team_live_open_task_conversation(uuid, uuid) has different parameter names
-- on different deployments, and PostgreSQL forbids renaming input parameters
-- through CREATE OR REPLACE. A fresh name works on every schema.
create or replace function public.team_live_open_task_chat(
  p_team_id uuid,
  p_task_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conversation_id uuid;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  if not public.team_live_is_member(p_team_id, v_user_id) then
    raise exception 'Not a team member';
  end if;

  if to_regclass('public.team_tasks') is not null then
    if not exists (
      select 1 from public.team_tasks
      where id = p_task_id and team_id = p_team_id
    ) then
      raise exception 'Task not found';
    end if;
  end if;

  select c.id into v_conversation_id
  from public.team_conversations c
  where c.team_id = p_team_id
    and c.task_id = p_task_id
    and c.kind = 'task'
  order by c.created_at desc
  limit 1;

  if v_conversation_id is null then
    insert into public.team_conversations (team_id, kind, task_id, title, created_by)
    values (p_team_id, 'task', p_task_id, 'Task chat', v_user_id)
    returning id into v_conversation_id;
  end if;

  return v_conversation_id;
end;
$$;

grant execute on function public.team_live_join_call(uuid) to authenticated;
grant execute on function public.team_live_leave_call(uuid) to authenticated;
grant execute on function public.team_live_respond_call(uuid, boolean) to authenticated;
grant execute on function public.team_live_pending_invites() to authenticated;
grant execute on function public.team_chat_mark_read(uuid, timestamptz, uuid) to authenticated;
grant execute on function public.team_live_open_task_chat(uuid, uuid) to authenticated;

commit;
