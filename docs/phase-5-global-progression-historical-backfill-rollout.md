# Phase 5 global progression historical backfill rollout

This checkpoint credits authoritative game sessions that completed before their global XP completion triggers were deployed.

It covers:

- completed solo `game_runs` with a canonical `game_sessions` row;
- completed live-duel participant sessions;
- completed turn-based participant sessions.

It does not invent XP from legacy browser-submitted summaries that have no authoritative answer rows.

## Deployment order

Run the production files in this order:

1. `supabase/sql/phase-5-global-progression-historical-backfill-preview.sql`
2. `supabase/sql/phase-5-global-progression-historical-backfill.sql`
3. `supabase/sql/phase-5-global-progression-historical-backfill-verification.sql`

The preview and verification files are read-only. The middle file creates the private audit structures and executes the backfill.

## 1. Preview

Run the preview file and retain both result sets.

The first result groups pending sessions by source. The second lists each pending session with its player, question count, score and completion time.

The preview does not lock or modify game data. A newly completed game can therefore change the count before the write migration runs.

## 2. Backfill migration

Run the backfill file once.

The migration:

- creates private backfill-run and failure-audit tables;
- finds only completed sessions without an existing `global_xp_awards` row;
- calls the same trusted source-specific XP functions used by live gameplay;
- records the original source as `solo`, `live_duel` or `turn_based`;
- tags newly inserted award breakdowns with `credit_path = historical_backfill`;
- isolates malformed sessions so valid sessions can still be credited;
- remains safe to run again because the award ledger is unique by `game_session_id`.

The migration returns one `backfill_result` JSON object. A clean run has:

- `status = completed`
- `failure_count = 0`
- awarded counts matching the preview, except for games credited concurrently between preview and execution.

`completed_with_failures` means at least one historical session failed trusted reconstruction. Do not manually insert XP for it. Use the failure audit output from verification, repair the authoritative source inconsistency, then rerun:

```sql
select trivia_private.run_global_xp_historical_backfill();
```

Successful retries resolve earlier failure-audit rows automatically.

## 3. Verification

Run the verification file.

The first result must be `PASS`. It verifies:

- the private audit structures and backfill helper exist;
- the latest run completed without failures;
- no eligible solo, live-duel or turn-based session remains uncredited;
- no unresolved backfill failure remains;
- player XP totals, credited-game counts and levels match the immutable ledger;
- multiplayer source labels match each match format;
- browser roles cannot execute the backfill helper.

The remaining result sets show:

- the latest run counters;
- historical awards and XP by source;
- unresolved failures, which should be empty;
- progression aggregate mismatch count, which should be zero.

## Rollback policy

Do not delete individual XP awards after players have observed progression. This checkpoint is additive and idempotent.

If deployment fails before commit, PostgreSQL rolls back the migration transaction. If it completes with isolated candidate failures, valid awards remain correct and the failed sessions are retained in the private audit table for controlled repair and retry.
