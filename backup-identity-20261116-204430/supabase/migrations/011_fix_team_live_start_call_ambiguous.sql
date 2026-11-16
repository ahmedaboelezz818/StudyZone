-- 011_fix_team_live_start_call_ambiguous.sql
-- Fix the team_live_start_call RPC pair so that:
--   1) Only ONE team_live_start_call overload remains (the one the app calls);
--   2) The function used for the membership check verifies membership by
--      EXISTENCE of a row in public.team_members(team_id, user_id) only.
--      `team_members` has NO status column in this project (confirmed);
--      `team_call_participants` uses invite_status (not status);
--      `team_calls` does have status (used below where needed).
--   3) p_task_id is persisted into public.team_calls.task_id (column added here
--      with IF NOT EXISTS — additive, non-destructive).
--   4) The function keeps its exact signature used by the app:
--      (uuid, text, text, jsonb, boolean, uuid, text, uuid)
--      The incompatible uuid[] overload is dropped with IF EXISTS only; no CASCADE.
--   5) SECURITY DEFINER and search_path are preserved exactly as deployed;
--      validation of membership, invitees, task and conversation is kept;
--      the "only one active group call per team" guard is preserved.
-- Idempotent and re-runnable. No DROP/CASCADE outside the precise overload.

-- 0) Schema: add task_id to team_calls if it is missing (additive only).
alter table public.team_calls
  add column if not exists task_id uuid;

-- Optional FK: link task_id to team_tasks when the base table exists.
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'team_tasks') then
    begin
      alter table public.team_calls
        add constraint team_calls_task_id_fkey foreign key (task_id)
        references public.team_tasks(id) on delete set null;
    exception when duplicate_object then null;
    end;
  end if;
end $$;

-- 1) Drop the OTHER overload by exact signature (no CASCADE, exact match).
drop function if exists public.team_live_start_call(uuid, text, text, uuid[], boolean, uuid, text, uuid);

-- 2) Canonical definition — membership by existence, no status column reference.
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
  v_uid uuid;
  v_invitee uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  -- Membership check: existence of a row in team_members(team_id, user_id).
  if not exists (
    select 1
    from public.team_members tm
    where tm.team_id = p_team_id
      and tm.user_id = v_uid
  ) then
    raise exception 'You are not a member of this team';
  end if;

  -- Validate call type and scope.
  if p_call_type is null or p_call_type not in ('audio', 'video') then
    raise exception 'Invalid call type: %', coalesce(p_call_type, 'null');
  end if;
  if p_scope is null or p_scope not in ('direct', 'group') then
    raise exception 'Invalid call scope: %', coalesce(p_scope, 'null');
  end if;

  -- Validate p_task_id belongs to the same team when supplied.
  if p_task_id is not null and not exists (
    select 1
    from public.team_tasks t
    where t.id = p_task_id
      and t.team_id = p_team_id
  ) then
    raise exception 'Task % does not exist in this team', p_task_id;
  end if;

  -- Validate p_conversation_id belongs to the same team when supplied.
  if p_conversation_id is not null and not exists (
    select 1
    from public.team_conversations c
    where c.id = p_conversation_id
      and c.team_id = p_team_id
  ) then
    raise exception 'Conversation % does not exist in this team', p_conversation_id;
  end if;

  -- p_invitee_ids must be a JSON array.
  p_invitee_ids := coalesce(p_invitee_ids, '[]'::jsonb);
  if jsonb_typeof(p_invitee_ids) <> 'array' then
    raise exception 'p_invitee_ids must be a JSON array';
  end if;

  if p_scope = 'direct' then
    if coalesce(p_invite_all, false) then
      raise exception 'p_invite_all is only valid for group calls';
    end if;
    if jsonb_array_length(p_invitee_ids) <> 1 then
      raise exception 'A direct call requires exactly one invitee';
    end if;
  elsif not coalesce(p_invite_all, false) and jsonb_array_length(p_invitee_ids) = 0 then
    raise exception 'A group call needs at least one invitee or p_invite_all = true';
  end if;

  -- Every invitee must be a member of the same team (membership by existence).
  for v_invitee in
    select (value)::uuid
    from jsonb_array_elements_text(p_invitee_ids) as t(value)
  loop
    if not exists (
      select 1
      from public.team_members tm2
      where tm2.team_id = p_team_id
        and tm2.user_id = v_invitee
    ) then
      raise exception 'User % is not a member of this team', v_invitee;
    end if;
  end loop;

  -- Only one active group call per team at a time.
  if p_scope = 'group' and exists (
    select 1
    from public.team_calls c
    where c.team_id = p_team_id
      and c.scope = 'group'
      and c.status = 'active'
  ) then
    raise exception 'A group call is already in progress in this team';
  end if;

  insert into public.team_calls (
    team_id,
    conversation_id,
    scope,
    call_type,
    status,
    title,
    created_by,
    task_id
  )
  values (
    p_team_id,
    p_conversation_id,
    p_scope,
    p_call_type,
    'ringing',
    p_title,
    v_uid,
    p_task_id
  )
  returning id into v_call_id;

  if coalesce(p_invite_all, false) then
    insert into public.team_call_participants (call_id, user_id, invite_status)
    select v_call_id, tm3.user_id, 'invited'
    from public.team_members tm3
    where tm3.team_id = p_team_id
      and tm3.user_id <> v_uid;
  else
    for v_invitee in
      select (value)::uuid
      from jsonb_array_elements_text(p_invitee_ids) as t(value)
    loop
      insert into public.team_call_participants (call_id, user_id, invite_status)
      values (v_call_id, v_invitee, 'invited');
    end loop;
  end if;

  return v_call_id;
end;
$$;

-- 3) Re-grant execute to the client-facing role only.
revoke all on function public.team_live_start_call(uuid, text, text, jsonb, boolean, uuid, text, uuid) from public;
grant execute on function public.team_live_start_call(uuid, text, text, jsonb, boolean, uuid, text, uuid) to authenticated;
