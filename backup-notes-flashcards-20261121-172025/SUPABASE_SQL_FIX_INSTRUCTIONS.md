# Supabase SQL Fix Instructions (Second Brain)

This document describes the SQL/migration repairs prepared in the repository, the recommended apply order, and what has **not** been executed against a live Supabase database from this environment.

## What was verified locally (no live DB execution)

- Source migrations reviewed/updated: `006_team_live_communication.sql`, `008_team_live_reactions_and_rpc_compat.sql`, `009_flashcards_system.sql`.
- Added corrective migration: `010_fix_team_live_and_flashcards_compat.sql`.
- Frontend RPC/table usage cross-checked against migration definitions for Team Live and Flashcards (static inspection).
- No SQL was run against production/staging Supabase from this session; **do not treat these changes as applied** until executed in Supabase.

## Key compatibility fixes included

### Team Live (006/008/010)
- Replaced incorrect `public.team_memberships` references with `public.team_members` (with `status` respected) in membership checks and related RLS/policies/functions.
- Fixed `team_live_open_task_conversation` to resolve the real `team_id` from `public.team_tasks` (never inserts a task id as `team_id`).
- `team_chat_conversations` returns `SETOF public.team_conversations` for multi-row results.
- Migration 008 already provides client-compatible RPC overloads used by the frontend: `team_live_join_call(uuid)`, `team_live_leave_call(uuid)`, `team_live_respond_call(uuid, boolean)`, `team_live_pending_invites()`, `team_chat_mark_read(uuid, timestamptz, uuid)`, `team_live_open_task_chat(uuid, uuid)`.

### Flashcards (009/010)
- `flashcard_award_daily_xp()` now records daily awards **only** in `public.flashcard_xp_awards` (idempotent, `ON CONFLICT DO NOTHING`) and **does not modify `public.user_xp`** (tasks/daily XP remains separate).
- Frontend reads Flashcards XP from `flashcard_user_xp` if present, else sums `flashcard_xp_awards`; absence is handled safely. No `flashcard_user_xp` table is created by these migrations (avoids guessing schema); if your live DB requires it, add it via a reviewed, additive migration after confirming the intended columns.

## Recommended apply order (Supabase SQL Editor)

Run in order on a safe environment first when possible:

1. `supabase/migrations/006_team_live_communication.sql` (if not yet applied / for fresh setup)
2. `supabase/migrations/008_team_live_reactions_and_rpc_compat.sql`
3. `supabase/migrations/009_flashcards_system.sql`
4. `supabase/migrations/010_fix_team_live_and_flashcards_compat.sql` (**recommended** for any DB that may have applied earlier/broken versions)

Notes:
- All listed migrations are written to be re-runnable/idempotent where feasible (`IF NOT EXISTS`, `CREATE OR REPLACE`, conditional checks). `010` is explicitly corrective for existing deployments.
- Do **not** run `DROP CASCADE`, do **not** delete tables/columns/data, and do **not** alter historical migration timestamps for already-applied migrations.
- `006`/`008` create/assume Team Live tables and policies; ensure dependent base schema (teams, team_members, team_tasks, profiles, etc.) exists in your project.

## Manual checks after apply (in Supabase)

- Confirm functions exist with expected signatures: `team_live_is_member(uuid,uuid)`, `team_chat_conversations(uuid)`, `team_live_open_task_chat(uuid,uuid)`, `team_live_join_call(uuid)`, `team_live_leave_call(uuid)`, `team_live_respond_call(uuid,boolean)`, `team_live_pending_invites()`, `team_chat_mark_read(...)` overloads, `flashcard_award_daily_xp()`.
- Confirm `public.team_message_reactions` unique constraint/index enforces one reaction per (message_id,user_id) and RLS allows only the owning user to mutate.
- Confirm `flashcard_award_daily_xp` inserts into `flashcard_xp_awards` only and **does not** change `public.user_xp`.
- Test a Team Live flow (open conversation, send, mark read, react, start/join/leave/respond call) and watch PostgREST/RPC responses for 400s (payload/param names/types).
- Review RLS policies for `team_messages`, `team_message_reactions`, and flashcard tables against your membership model.

## Limitations

- Live Supabase schema/RLS/policies were **not** introspected or modified from this environment (no credentials/DB access). Differences between these files and your production schema may still exist.
- If `team_members` uses different column names/status semantics than assumed (`status <> 'removed'` / active membership), adjust conditions accordingly in a reviewed follow-up migration.
- Creating or changing RPC return types/signatures on databases with conflicting existing definitions can require manual resolution; prefer the provided overloads/new function names and test on staging first.
