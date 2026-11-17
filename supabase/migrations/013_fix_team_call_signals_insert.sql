-- ============================================================================
-- Second Brain — Team Live call signaling fix (migration 013)
-- Date: 2026-11-17
-- ============================================================================
-- ROOT CAUSE (verified by reading every policy in this repository):
--   public.team_call_signals has RLS **enabled** but only ONE policy exists —
--   `team_live_signal_select` (SELECT). There is no INSERT policy anywhere in
--   the migration history (003, 006–013). The web/Android app sends every
--   WebRTC signal (SDP offer, SDP answer, trickled ICE candidate) with the
--   publishable anon key, so EVERY insert is rejected with:
--     42501 — new row violates row-level security policy
--   Consequences (exactly the reported symptom):
--     * the caller's SDP offer never reaches the callee,
--     * the callee never answers,
--     * ICE candidates never cross either side,
--     * neither peer ever receives a remote track,
--     * the call UI is stuck on "في انتظار الفيديو…" / "Waiting for video…",
--       no matter how good the local camera looks.
--
-- This migration adds ONLY the missing INSERT policy, reusing the same
-- membership helper (public.team_live_is_member) the existing SELECT policy
-- uses. No existing policy, table, function or row is edited or removed,
-- nothing is dropped, and it is safe to re-apply (policy created conditionally).
--
-- It deliberately does NOT invent a private 1:1 call path: the private call
-- RPCs (private_call_start / private_conversation_open) are not part of this
-- repository's migrations. private calls need their own backend work first.
-- ============================================================================

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'team_call_signals'
      and policyname = 'team_live_signal_insert'
  ) then
    create policy team_live_signal_insert on public.team_call_signals
      for insert
      with check (
        public.team_live_is_member(public.team_live_call_team(call_id), auth.uid())
        and from_user_id = auth.uid()
      );
  end if;
end $$;
