/*
 * 012_fix_team_live_invite_call_ambiguous.sql
 *
 * Problem
 * -------
 * The live database has TWO overloads of public.team_live_invite_call:
 *
 *   team_live_invite_call(p_call_id uuid, p_user_ids jsonb)
 *   team_live_invite_call(p_call_id uuid, p_user_ids uuid[])
 *
 * supabase-js sends p_user_ids as a JSON array, so PostgREST cannot choose and
 * answers HTTP 300 with:
 *
 *   PGRST203 Could not choose the best candidate function between:
 *     public.team_live_invite_call(p_call_id => uuid, p_user_ids => jsonb),
 *     public.team_live_invite_call(p_call_id => uuid, p_user_ids => uuid[])
 *
 * Fix
 * ---
 * The client (team-live.js -> inviteMembersFromSheet) sends a JSON array and
 * the Team Live system was built around the jsonb signature, so keep jsonb and
 * drop only the uuid[] overload by its exact signature. No CASCADE, no table
 * or data changes, no change to the remaining function.
 *
 * Apply this in the Supabase SQL editor (or `supabase db push`). It is
 * re-runnable: DROP FUNCTION IF EXISTS is a no-op when already applied.
 *
 * Verification (run after applying):
 *   select p.proname, pg_get_function_arguments(p.oid) as args
 *   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 *   where n.nspname = 'public' and p.proname = 'team_live_invite_call';
 * Expected: exactly one row with args
 *   "p_call_id uuid, p_user_ids jsonb"
 */

drop function if exists public.team_live_invite_call(uuid, uuid[]);
