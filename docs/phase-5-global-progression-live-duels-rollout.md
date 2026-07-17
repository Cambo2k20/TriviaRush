# Phase 5 Live Duel Global XP Rollout

## Scope

This checkpoint awards global XP to both players when an authoritative live duel completes.

It includes:

- difficulty-based base XP from accepted duel answers;
- speed and streak multipliers reconstructed in answer order;
- score-efficiency multiplier derived from the authoritative duel score;
- result multipliers for score wins, draws, losses and forfeits;
- the existing 150% per-game cap;
- one idempotent XP-ledger row per participant session;
- a participant-only summary RPC.

It does not include turn-based challenge XP, historical backfill or frontend XP presentation.

## Prerequisites

The following must already be deployed:

1. Phase 4B live multiplayer;
2. `phase-5-global-progression-foundation.sql`;
3. the existing authoritative duel finalisation and answer tables.

The solo XP migration is not a technical dependency, although it is deployed earlier in the planned rollout.

## Deployment

Run these files in order through the Supabase SQL Editor:

1. `supabase/sql/phase-5-global-progression-live-duels.sql`
2. `supabase/sql/phase-5-global-progression-live-duels-verification.sql`

The migration is additive. It does not rewrite the Phase 4B finaliser. An `AFTER UPDATE OF status` trigger observes the authoritative transition to `completed`, after both participant sessions and outcomes have already been stored.

## Award timing

For each completed duel:

1. Phase 4B determines score win, draw or forfeit;
2. each player receives a `game_sessions` row;
3. each `duel_players` row receives its completed session ID and outcome;
4. `duel_matches.status` changes to `completed`;
5. the progression trigger reconstructs and records one award for each participant.

The award writer uses the unique game session ID as its idempotency key. Repeated finalisation or award calls cannot add XP twice.

## Result multipliers

| Authoritative result | Multiplier |
|---|---:|
| Score win | 1.10 |
| Forfeit win | 1.05 |
| Draw | 1.05 |
| Loss | 1.00 |
| Forfeiting player | 1.00 |

A result multiplier cannot create XP when the player earned zero base XP.

## Production verification

The verification script should report:

```text
verification_status = PASS
max_score_helper_exists = true
calculation_helper_exists = true
award_helper_exists = true
summary_rpc_exists = true
completion_trigger_exists = true
```

Browser-role expectations:

- `authenticated` can execute `get_live_duel_global_xp_summary(uuid)`;
- `anon` cannot execute it;
- neither browser role can execute private calculation or award helpers.

The final informational count can include historical completed duels without XP. Those rows are intentionally left for the separate backfill checkpoint.

## Live validation

After deployment:

1. complete a new live duel between two permanent accounts;
2. query the latest `global_xp_awards` rows where `source_kind = 'live_duel'`;
3. confirm two rows exist with the same `source_id` and distinct game session IDs;
4. confirm the winner/draw multiplier matches the authoritative result;
5. confirm each player's `player_global_progress` total increased exactly once.

## Failure behaviour

The progression trigger runs inside the same database transaction as duel completion. If trusted duel state is internally inconsistent, the completion update fails rather than creating a partial or unverifiable XP award. The finaliser can then be retried after the underlying issue is corrected.
