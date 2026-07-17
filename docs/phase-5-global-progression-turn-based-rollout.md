# Phase 5 Turn-Based Global XP Rollout

## Scope

This checkpoint awards global XP to both participants when an authoritative turn-based challenge reaches `completed`.

It also hardens the previously deployed live-duel trigger so only `match_format = 'live'` enters the live-duel XP path. Any existing turn-based ledger rows labelled `live_duel` are reclassified to `turn_based` without changing XP totals, levels or credited-game counts.

This checkpoint does not backfill completed player sessions that have no XP ledger row and does not change frontend presentation.

## Prerequisites

Deploy and verify these systems first:

1. Phase 4B multiplayer
2. Phase 5 turn-based challenges
3. Global progression foundation
4. Live-duel global XP integration

## Deployment order

Run each file once in a separate Supabase SQL Editor query.

### 1. Write migration

`supabase/sql/phase-5-global-progression-turn-based.sql`

Expected SQL Editor response:

```text
Success. No rows returned
```

The migration:

- creates a shared authoritative multiplayer XP reconstruction helper
- preserves the existing live-duel calculation API while adding format validation
- restricts the live completion trigger to live matches
- adds turn-based calculation and award helpers
- adds a turn-based completion trigger
- adds the participant-only `get_turn_based_global_xp_summary(match_id)` RPC
- reclassifies any already-awarded turn-based rows labelled `live_duel`

### 2. Read-only verification

`supabase/sql/phase-5-global-progression-turn-based-verification.sql`

The first result must report:

```text
PASS,true,true,true,true,true,true,true,true
```

The final count of completed turn-based player sessions without XP is informational. Historical rows remain for the later backfill checkpoint.

## Production smoke test

After verification:

1. Complete a new turn-based challenge with two permanent accounts.
2. Confirm the match reaches `completed`.
3. Query the latest `turn_based` ledger rows.
4. Confirm there are two rows with the same `source_id`, one for each player.
5. Confirm the winner or draw multiplier matches the authoritative result.

Suggested query:

```sql
select
  award.created_at,
  award.source_id as match_id,
  profile.display_name,
  player.outcome,
  match.result_reason,
  award.base_xp,
  award.answer_xp,
  award.score_efficiency,
  award.score_multiplier,
  award.result_multiplier,
  award.xp_awarded,
  progress.total_xp,
  progress.level,
  progress.credited_games
from public.global_xp_awards award
join public.profiles profile
  on profile.id = award.player_id
join public.player_global_progress progress
  on progress.player_id = award.player_id
join public.duel_matches match
  on match.id = award.source_id
join public.duel_players player
  on player.match_id = match.id
 and player.player_id = award.player_id
where award.source_kind = 'turn_based'
order by award.created_at desc
limit 10;
```

## Safety properties

- XP inputs are rebuilt from `duel_answers`, `trivia_questions`, `duel_players` and `duel_matches`.
- The browser cannot submit difficulty, streak, XP, score denominator or result multipliers.
- The match format is enforced by private server wrappers.
- The completion trigger runs only on the first transition to `completed`.
- One ledger row per game session makes retries idempotent.
- Participants can read only their own turn-based XP summary.
