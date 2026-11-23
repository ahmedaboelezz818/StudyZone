-- Team Live communication schema for Study Zone.
-- Additive migration: creates the Team Live tables, helper functions, call and
-- chat RPCs, the private attachment bucket and the row level security policies.
-- Existing tables, policies and data are never modified or removed.

create extension if not exists "pgcrypto";

create table if not exists public.team_conversations (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  kind text not null default 'group',
  title text,
  task_id uuid,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  last_message_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.team_calls (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  conversation_id uuid references public.team_conversations (id) on delete set null,
  scope text not null default 'team',
  call_type text not null default 'audio',
  status text not null default 'ringing',
  title text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  ended_at timestamptz,
  connected_at timestamptz,
  last_signal_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.team_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.team_conversations (id) on delete cascade,
  sender_id uuid references public.profiles (id) on delete set null,
  message_type text not null default 'text',
  body text not null default '',
  call_id uuid,
  reply_to_id uuid,
  attachment_name text,
  attachment_size integer,
  attachment_type text,
  storage_path text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.team_conversation_reads (
  conversation_id uuid not null references public.team_conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  last_message_id uuid,
  primary key (conversation_id, user_id)
);

create table if not exists public.team_call_participants (
  call_id uuid not null references public.team_calls (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  invite_status text not null default 'invited',
  mic_on boolean not null default true,
  camera_on boolean not null default false,
  screen_sharing boolean not null default false,
  joined_at timestamptz,
  left_at timestamptz,
  last_seen_at timestamptz,
  primary key (call_id, user_id)
);

create table if not exists public.team_call_signals (
  id bigint generated always as identity primary key,
  call_id uuid not null references public.team_calls (id) on delete cascade,
  from_user_id uuid not null references public.profiles (id) on delete cascade,
  to_user_id uuid references public.profiles (id) on delete cascade,
  signal_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Helper functions. They are created after the tables they query so the
-- migration applies cleanly on a fresh database.
create or replace function public.team_live_is_member(p_team_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.team_memberships m
    where m.team_id = p_team_id
      and m.user_id = p_user_id
      and m.role in ('owner', 'admin', 'member')
  );
$$;

create or replace function public.team_live_conversation_team(p_conversation_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.team_id from public.team_conversations c where c.id = p_conversation_id;
$$;

create or replace function public.team_live_call_team(p_call_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.team_id from public.team_calls c where c.id = p_call_id;
$$;

create or replace function public.team_live_prepare_message(p_message jsonb)
returns public.team_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_message public.team_messages;
begin
  v_message.message_type := coalesce(p_message->>'message_type', 'text');
  v_message.body := coalesce(p_message->>'body', '');
  v_message.reply_to_id := nullif(p_message->>'reply_to_id', null);
  if length(coalesce(v_message.body, '')) > 4000 then
    raise exception 'Message text is too long';
  end if;
  return v_message;
end;
$$;

create or replace function public.team_live_guard_message_update(p_message public.team_messages)
returns public.team_messages
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_message.deleted_at is null then
    raise exception 'Messages can only be soft-deleted';
  end if;
  return p_message;
end;
$$;

-- Only one live group call per team at a time.
create unique index if not exists team_calls_one_live
  on public.team_calls (team_id)
  where scope = 'group' and status = 'active';

-- Row level security for the Team Live tables.
alter table public.team_conversations enable row level security;
alter table public.team_calls enable row level security;
alter table public.team_messages enable row level security;
alter table public.team_conversation_reads enable row level security;
alter table public.team_call_participants enable row level security;
alter table public.team_call_signals enable row level security;

create policy team_live_conversation_select on public.team_conversations
  for select using (public.team_live_is_member(team_id, auth.uid()));
create policy team_live_conversation_insert on public.team_conversations
  for insert with check (public.team_live_is_member(team_id, auth.uid()));
create policy team_live_conversation_update on public.team_conversations
  for update using (public.team_live_is_member(team_id, auth.uid()))
  with check (public.team_live_is_member(team_id, auth.uid()));
create policy team_live_conversation_delete on public.team_conversations
  for delete using (public.team_live_is_member(team_id, auth.uid()));

create policy team_live_call_select on public.team_calls
  for select using (public.team_live_is_member(team_id, auth.uid()));
create policy team_live_call_insert on public.team_calls
  for insert with check (public.team_live_is_member(team_id, auth.uid()));
create policy team_live_call_update on public.team_calls
  for update using (public.team_live_is_member(team_id, auth.uid()));
create policy team_live_call_delete on public.team_calls
  for delete using (public.team_live_is_member(team_id, auth.uid()));

create policy team_live_message_select on public.team_messages
  for select using (
    public.team_live_is_member(public.team_live_conversation_team(team_messages.conversation_id), auth.uid())
  );
create policy team_live_message_insert on public.team_messages
  for insert with check (
    public.team_live_is_member(public.team_live_conversation_team(team_messages.conversation_id), auth.uid())
  );
create policy team_live_message_update on public.team_messages
  for update using (
    public.team_live_is_member(public.team_live_conversation_team(team_messages.conversation_id), auth.uid())
  );

create policy team_live_read_select on public.team_conversation_reads
  for select using (
    public.team_live_is_member(public.team_live_conversation_team(conversation_id), auth.uid())
  );

create policy team_live_participant_select on public.team_call_participants
  for select using (public.team_live_is_member(public.team_live_call_team(call_id), auth.uid()));
create policy team_live_participant_insert on public.team_call_participants
  for insert with check (public.team_live_is_member(public.team_live_call_team(call_id), auth.uid()));
create policy team_live_participant_update on public.team_call_participants
  for update using (public.team_live_is_member(public.team_live_call_team(call_id), auth.uid()));

create policy team_live_signal_select on public.team_call_signals
  for select using (public.team_live_is_member(public.team_live_call_team(call_id), auth.uid()));

-- Private team chat attachments bucket.
insert into storage.buckets (id, name, public)
values ('team-chat', false)
on conflict (id) do nothing;

create policy team_chat_attachments_select_member on storage.objects
  for select using (bucket_id = 'team-chat');

create policy team_live_storage_conversation on storage.objects
  for select using (bucket_id = 'team-chat');

-- Team live call RPCs.
create or replace function public.team_live_start_call(
  p_team_id uuid,
  p_call_type text,
  p_scope text,
  p_invitee_ids jsonb,
  p_invite_all boolean,
  p_task_id uuid,
  p_title text,
  p_conversation_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_call_id uuid;
  v_user_id uuid;
begin
  if p_scope = 'group' then
    if exists (
      select 1
      from public.team_calls c
      where c.team_id = p_team_id
        and c.scope = 'group'
        and c.status = 'active'
    ) then
      raise exception 'A group call is already in progress in this team';
    end if;
  end if;

  insert into public.team_calls (team_id, conversation_id, scope, call_type, status, title, created_by)
  values (p_team_id, p_conversation_id, p_scope, p_call_type, 'ringing', p_title, auth.uid())
  returning id into v_call_id;

  for u in
    select jsonb_array_elements_text(coalesce(p_invitee_ids, '[]'::jsonb)) as user_id
    loop
      v_user_id := u.user_id::uuid;
      if v_user_id is not null then
        insert into public.team_call_participants (call_id, user_id, invite_status)
        values (v_call_id, v_user_id, 'invited');
      end if;
    end loop;

  return v_call_id;
end;
$$;

create or replace function public.team_live_join_call(p_call_id uuid, p_user_id uuid)
returns public.team_calls
language plpgsql
security definer
set search_path = public
as $$
declare
  v_call public.team_calls;
begin
  select c.* into v_call from public.team_calls c where c.id = p_call_id;
  if v_call.id is null then
    raise exception 'Call not found';
  end if;
  if exists (
    select 1
    from public.team_call_participants p
    join public.team_calls c on c.id = p.call_id
    where p.user_id = p_user_id
      and p.left_at is null
      and c.status <> 'ended'
  ) then
    raise exception 'You are already in a call';
  end if;
  insert into public.team_call_participants (call_id, user_id, invite_status, joined_at)
  values (p_call_id, p_user_id, 'accepted', now())
  on conflict (call_id, user_id) do update
  set invite_status = 'accepted',
      joined_at = now(),
      left_at = null;
  update public.team_calls
  set status = 'active',
      started_at = coalesce(started_at, now()),
      connected_at = now()
  where id = p_call_id;
  return v_call;
end;
$$;

create or replace function public.team_live_end_call(p_call_id uuid)
returns public.team_calls
language plpgsql
security definer
set search_path = public
as $$
declare
  v_call public.team_calls;
begin
  select c.* into v_call from public.team_calls c where c.id = p_call_id;
  update public.team_calls
  set status = 'ended', ended_at = now()
  where id = p_call_id;
  update public.team_call_participants
  set invite_status = 'ended', left_at = now()
  where call_id = p_call_id;
  return v_call;
end;
$$;

create or replace function public.team_live_leave_call(p_call_id uuid, p_user_id uuid)
returns public.team_calls
language plpgsql
security definer
set search_path = public
as $$
declare
  v_call public.team_calls;
begin
  select c.* into v_call from public.team_calls c where c.id = p_call_id;
  update public.team_call_participants
  set invite_status = 'left', left_at = now()
  where call_id = p_call_id
    and user_id = p_user_id;
  return v_call;
end;
$$;

create or replace function public.team_live_invite_call(p_call_id uuid, p_user_ids jsonb)
returns public.team_call_participants
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.team_call_participants;
begin
  for u in
    select jsonb_array_elements_text(coalesce(p_user_ids, '[]'::jsonb)) as user_id
    loop
      insert into public.team_call_participants (call_id, user_id, invite_status)
      values (p_call_id, u.user_id::uuid, 'invited');
    end loop;
  return null;
end;
$$;

create or replace function public.team_live_respond_call(p_call_id uuid, p_user_id uuid, p_accept boolean)
returns public.team_call_participants
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.team_call_participants
  set invite_status = case when p_accept then 'accepted' else 'declined' end,
      left_at = case when p_accept then null else now() end
  where call_id = p_call_id
    and user_id = p_user_id;
  return null;
end;
$$;

create or replace function public.team_live_pending_invites(p_user_id uuid)
returns table(call_id uuid, call_type text, caller_id uuid, team_name text, title text, created_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select c.id, c.call_type, c.created_by, t.name, c.title, c.created_at
  from public.team_calls c
  join public.teams t on t.id = c.team_id
  join public.team_call_participants p
    on p.call_id = c.id and p.user_id = p_user_id and p.invite_status = 'invited'
  where c.status = 'ringing';
$$;

create or replace function public.team_live_prune_signals(p_call_id uuid)
returns public.team_call_signals
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.team_call_signals
  where call_id = p_call_id
    and created_at < now() - interval '1 hour';
  return null;
end;
$$;

create or replace function public.team_live_open_direct(p_team_id uuid, p_other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conversation_id uuid;
begin
  select c.id into v_conversation_id
  from public.team_conversations c
  join public.team_memberships me
    on me.team_id = c.team_id and me.user_id = auth.uid() and me.role in ('owner', 'admin', 'member')
  join public.team_memberships them
    on them.team_id = c.team_id and them.user_id = p_other_user_id and them.role in ('owner', 'admin', 'member')
  where c.team_id = p_team_id
    and c.kind = 'direct'
  order by c.created_at desc
  limit 1;
  if v_conversation_id is null then
    insert into public.team_conversations (team_id, kind, title, created_by)
    values (p_team_id, 'direct', p_other_user_id::text, auth.uid())
    returning id into v_conversation_id;
  end if;
  return v_conversation_id;
end;
$$;

create or replace function public.team_live_open_task_conversation(p_task_id uuid, p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conversation_id uuid;
begin
  select c.id into v_conversation_id
  from public.team_conversations c
  where c.task_id = p_task_id
    and c.kind = 'task';
  if v_conversation_id is null then
    insert into public.team_conversations (team_id, kind, task_id, title, created_by)
    values (p_task_id, 'task', p_task_id, p_task_id::text, p_user_id)
    returning id into v_conversation_id;
  end if;
  return v_conversation_id;
end;
$$;

create or replace function public.team_live_ensure_group(p_team_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conversation_id uuid;
begin
  select c.id into v_conversation_id
  from public.team_conversations c
  where c.team_id = p_team_id
    and c.kind = 'group'
  order by c.created_at desc
  limit 1;
  if v_conversation_id is null then
    insert into public.team_conversations (team_id, kind, title, created_by)
    values (p_team_id, 'group', 'Team Live group', auth.uid())
    returning id into v_conversation_id;
  end if;
  return v_conversation_id;
end;
$$;

create or replace function public.team_chat_conversations(p_team_id uuid)
returns public.team_conversations
language sql
security definer
set search_path = public
as $$
  select c.id, c.team_id, c.kind, c.title, c.task_id, c.created_by, c.created_at, c.last_message_at, c.updated_at
  from public.team_conversations c
  where c.team_id = p_team_id
    and public.team_live_is_member(c.team_id, auth.uid());
$$;

create or replace function public.team_chat_mark_read(
  p_conversation_id uuid,
  p_user_id uuid,
  p_at timestamptz,
  p_message_id uuid
)
returns public.team_conversation_reads
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.team_conversation_reads
  set last_read_at = least(coalesce(p_at, now()), now()),
      last_message_id = coalesce(p_message_id, last_message_id)
  where conversation_id = p_conversation_id
    and user_id = p_user_id;
  return null;
end;
$$;

grant execute on function public.team_live_is_member(uuid, uuid) to authenticated;
grant execute on function public.team_live_conversation_team(uuid) to authenticated;
grant execute on function public.team_live_call_team(uuid) to authenticated;
grant execute on function public.team_live_prepare_message(jsonb) to authenticated;
grant execute on function public.team_live_guard_message_update(public.team_messages) to authenticated;
grant execute on function public.team_live_start_call(uuid, text, text, jsonb, boolean, uuid, text, uuid) to authenticated;
grant execute on function public.team_live_join_call(uuid, uuid) to authenticated;
grant execute on function public.team_live_end_call(uuid) to authenticated;
grant execute on function public.team_live_leave_call(uuid, uuid) to authenticated;
grant execute on function public.team_live_invite_call(uuid, jsonb) to authenticated;
grant execute on function public.team_live_respond_call(uuid, uuid, boolean) to authenticated;
grant execute on function public.team_live_pending_invites(uuid) to authenticated;
grant execute on function public.team_live_prune_signals(uuid) to authenticated;
grant execute on function public.team_live_open_direct(uuid, uuid) to authenticated;
grant execute on function public.team_live_open_task_conversation(uuid, uuid) to authenticated;
grant execute on function public.team_live_ensure_group(uuid) to authenticated;
grant execute on function public.team_chat_conversations(uuid) to authenticated;
grant execute on function public.team_chat_mark_read(uuid, uuid, timestamptz, uuid) to authenticated;
