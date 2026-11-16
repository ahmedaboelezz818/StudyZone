/*
 * 011_fix_team_live_start_call_ambiguous.sql
 *
 * Problem
 * -------
 * The live database ended up with TWO overloads of public.team_live_start_call:
 *
 *   team_live_start_call(p_team_id uuid, p_call_type text, p_scope text,
 *                        p_invitee_ids uuid[],  p_invite_all boolean,
 *                        p_task_id uuid, p_title text, p_conversation_id uuid)
 *
 *   team_live_start_call(p_team_id uuid, p_call_type text, p_scope text,
 *                        p_invitee_ids jsonb,  p_invite_all boolean,
 *                        p_task_id uuid, p_title text, p_conversation_id uuid)
 *
 * supabase-js sends p_invitee_ids as a JSON array (["uuid", ...]) which
 * PostgREST cannot disambiguate, so PostgREST fails at call time with:
 *
 *   Could not choose the best candidate function between:
 *     public.team_live_start_call(uuid, text, text, uuid[], boolean, uuid, text, uuid),
 *     public.team_live_start_call(uuid, text, text, jsonb, boolean, uuid, text, uuid)
 *
 * Strategy (keeping a single, canonical signature)
 * -------------------------------------------------
 * The app sends a JSON array of UUID strings. The JSONB signature is the one
 * that the Team Live system was built around (006_team_live_communication.sql)
 * and the only one whose behaviour is preserved and verified, so JSONB is kept
 * and the uuid[] overload is dropped precisely by its exact signature.
 *
 * This migration:
 *   1. Drops the conflicting uuid[] overload (exact signature, no CASCADE).
 *   2. Drops and recreates the jsonb overload so the result is deterministic.
 *   3. Recreates it with the SAME return type (uuid) and the SAME security
 *      settings (SECURITY DEFINER, SET search_path = public), the SAME logic
 *      for inserting the call and its invitees, and ADDS full validation:
 *        - caller must be an authenticated, non-removed member of the team;
 *        - p_call_type must be 'audio' or 'video', p_scope 'direct' or 'group';
 *        - a direct call takes exactly one invitee; a group call needs at
 *          least one invitee or p_invite_all = TRUE;
 *        - every invitee must be an active member of the same team;
 *        - p_task_id (if given) must belong to the same team;
 *        - p_conversation_id (if given) must belong to the same team;
 *        - the "one active group call per team" guard is preserved.
 *   4. Re-grants EXECUTE to authenticated (no other privileges changed).
 *
 * Safety
 * ------
 * - Idempotent / re-runnable (drop-if-exists + create-or-replace + re-grant).
 * - Never touches tables, rows, indexes, or other functions.
 * - Uses no CASCADE.
 * - After applying, only ONE team_live_start_call remains and the client
 *   (app.js / team-live.js, unchanged) calls it with a JSON array as before.
 */

-- 1) Drop the conflicting uuid[] overload (exact signature).
drop function if exists public.team_live_start_call(uuid, text, text, uuid[], boolean, uuid, text, uuid);

-- 2) Drop the jsonb overload too so the resulting state is deterministic.
drop function if exists public.team_live_start_call(uuid, text, text, jsonb, boolean, uuid, text, uuid);

-- 3) Recreate the single canonical jsonb variant.
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

  -- Caller must be a non-removed member of the team.
  if not exists (
    select 1
    from public.team_members tm
    where tm.team_id = p_team_id
      and tm.user_id = v_uid
      and coalesce(tm.status, 'active') <> 'removed'
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

  -- Every invitee must be a non-removed member of the same team.
  for v_invitee in
    select (value)::uuid
    from jsonb_array_elements_text(p_invitee_ids) as t(value)
  loop
    if not exists (
      select 1
      from public.team_members tm2
      where tm2.team_id = p_team_id
        and tm2.user_id = v_invitee
        and coalesce(tm2.status, 'active') <> 'removed'
    ) then
      raise exception 'User % is not an active member of this team', v_invitee;
    end if;
  end loop;

  -- Only one active group call per team at a time (preserved from 006).
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
    created_by
  )
  values (
    p_team_id,
    p_conversation_id,
    p_scope,
    p_call_type,
    'ringing',
    p_title,
    v_uid
  )
  returning id into v_call_id;

  if coalesce(p_invite_all, false) then
    insert into public.team_call_participants (call_id, user_id, invite_status)
    select v_call_id, tm3.user_id, 'invited'
    from public.team_members tm3
    where tm3.team_id = p_team_id
      and coalesce(tm3.status, 'active') <> 'removed'
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

-- 4) Re-grant execute to the client-facing role only.
revoke all on function public.team_live_start_call(uuid, text, text, jsonb, boolean, uuid, text, uuid) from public;
grant execute on function public.team_live_start_call(uuid, text, text, jsonb, boolean, uuid, text, uuid) to authenticated;

-- Verification (manual, after applying):
--   select p.proname, pg_get_function_arguments(p.oid) as args
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and p.proname = 'team_live_start_call';
-- Expected: exactly one row, arguments
--   "p_team_id uuid, p_call_type text, p_scope text, p_invitee_ids jsonb, p_invite_all boolean, p_task_id uuid, p_title text, p_conversation_id uuid".
