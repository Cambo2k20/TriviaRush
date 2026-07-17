# Phase 5 Global Progression — Solo XP Rollout

## Scope

This checkpoint attaches the deployed global XP foundation to authoritative solo-game completion.

It does not yet:

- display XP in the frontend;
- award XP from live or turn-based multiplayer;
- backfill historical completed games;
- create category mastery progression.

## Award flow

When `game_runs.completed_session_id` changes from `NULL` to a completed session ID, a server-side trigger:

1. reads accepted answers from `game_run_answers`;
2. reads difficulty from `trivia_questions`;
3. reconstructs the correct-answer streak in answer order;
4. applies the approved difficulty, speed and streak rules;
5. derives the maximum possible score from the authoritative scoring model;
6. applies the score-efficiency multiplier and 150% cap;
7. records one immutable `global_xp_awards` ledger row;
8. updates `player_global_progress` atomically.

The unique `game_session_id` ledger key makes retries idempotent.

## Deployment order

Run these scripts in Supabase SQL Editor in this order:

1. `supabase/sql/phase-5-global-progression-solo.sql`
2. `supabase/sql/phase-5-global-progression-solo-verification.sql`

Do not rerun historical Phase 4 or Phase 5 migrations.

## Expected migration result

```text
Success. No rows returned
```

## Expected verification result

The first result row should be:

```text
PASS,true,true,true,true,true
```

The columns are:

- `verification_status`
- `max_score_helper_exists`
- `calculation_helper_exists`
- `award_helper_exists`
- `summary_rpc_exists`
- `completion_trigger_exists`

The privilege result should show:

- `authenticated` can execute `get_solo_global_xp_summary(uuid)`;
- browser roles cannot execute private calculation or award functions.

## Production smoke test

After deployment:

1. Sign in to Trivia Rush.
2. Complete one solo game.
3. Copy its run ID from the browser console or network response.
4. Run:

```sql
select public.get_solo_global_xp_summary('<RUN_ID>'::uuid);
```

When run through the authenticated app RPC, the expected status is `credited` with a positive `xp_awarded` value when at least one answer was correct.

The SQL Editor does not carry the player's JWT, so the public RPC should normally be tested through the application rather than directly in the editor.

## Historical data

Completed solo sessions created before this trigger is deployed remain uncredited at this checkpoint. A later migration will backfill authoritative historical answer rows and apply conservative legacy credit where exact per-answer data is unavailable.
