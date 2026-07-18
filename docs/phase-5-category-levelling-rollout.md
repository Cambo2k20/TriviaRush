# Phase 5 Category Levelling Rollout

**Code status:** backend and player-facing mastery UI included  
**Production status:** not active until the SQL steps below are completed

## Outcome

This checkpoint adds independent, server-owned levels for every active trivia
category and exposes them through the existing account and result screens.

- Correct Easy answers award 10 category XP.
- Correct Medium answers award 15 category XP.
- Correct Hard answers award 25 category XP.
- Incorrect answers and passes award 0 XP but still update trusted activity.
- Solo, live duel and turn-based answers use the same category XP rules.
- Mixed games credit each question's real category.
- Category levels use the approved cumulative curve through level 50.
- Existing authoritative solo and duel answers are backfilled exactly.
- Browser clients receive read-only RPCs and cannot write XP or levels.
- Account shows every category's level, XP progress, accuracy and activity.
- Solo and Online results show exact per-category XP and level-ups.

Global XP remains separate. Global progression can reward speed, streaks, score
efficiency and multiplayer outcomes; category levelling measures subject
mastery only.

## Files

### Database

- `supabase/sql/phase-5-category-levelling.sql`
- `supabase/sql/phase-5-category-levelling-verification.sql`
- `scripts/category-progression-smoke-test.mjs`

### Frontend

- `category-progression-ui.js`
- `category-progression-ui.css`
- `category-progression-ui-smoke-test.mjs`

## Database objects

### Tables

- `category_level_thresholds`
- `player_category_progress`
- `category_xp_awards`

All three tables use RLS and expose no direct browser privileges.

### Private award path

- `trivia_private.category_xp_for_answer`
- `trivia_private.category_level_for_xp`
- `trivia_private.record_category_answer_progress`
- `trivia_private.award_solo_category_progress`
- `trivia_private.award_duel_category_progress`

Completion triggers process authoritative answer rows after solo runs and duel
matches complete. Each answer has one stable ledger identity, so retries cannot
award it twice.

### Browser read RPCs

- `get_my_category_progression()`
- `get_solo_category_xp_summary(p_run_id uuid)`
- `get_duel_category_xp_summary(p_match_id uuid)`

The solo summary is owner-only. The duel summary is participant-only and returns
only the caller's progression.

## Player-facing behaviour

### Account

The Account dialog contains a **Category Mastery** panel. Each category card
shows:

- current category level;
- server-calculated progress to the next level;
- questions answered;
- trusted accuracy;
- XP remaining to the next level.

### Results

After a Solo, live duel or turn-based game completes, the result screen shows:

- total category XP earned;
- one row per category credited;
- exact XP gained in each category;
- correct/answered counts;
- current progress toward the next level;
- a highlighted level-up state when a threshold was crossed.

Mixed games display multiple category rows. The browser never derives XP or
levels locally; it renders the authoritative RPC response.

## Exact production order

### 1. Confirm prerequisites

The following checkpoints must already be deployed:

1. Phase 4 authoritative question platform
2. Phase 4 solo runs
3. Phase 4 live duels
4. Turn-based match format
5. Phase 5 ten-category platform and question seed

Take a Supabase database backup before continuing.

### 2. Merge and publish the frontend

Merge the pull request and allow GitHub Pages to publish the updated static
assets. The UI will remain safely empty until the database migration is active.

### 3. Run the category levelling migration

In **Supabase → SQL Editor → New query**, run the complete contents of:

```text
supabase/sql/phase-5-category-levelling.sql
```

The migration is additive and transactional. It creates the progression
objects, installs completion triggers and backfills existing authoritative
answers before committing.

### 4. Run read-only verification

In a fresh SQL Editor query, run:

```text
supabase/sql/phase-5-category-levelling-verification.sql
```

Confirm:

- 50 thresholds exist from level 1 to level 50;
- level 1 starts at 0 XP and level 50 starts at 122,500 XP;
- invalid award rows are zero;
- duplicate authoritative awards are zero;
- aggregate mismatches are zero;
- invalid cached levels are zero;
- the browser table-privilege query returns no rows;
- authenticated users can execute the three safe read RPCs;
- authenticated users cannot execute the private award writer.

### 5. Production acceptance

1. Open Account and confirm ten Category Mastery cards appear.
2. Complete one Easy solo answer correctly and confirm +10 category XP.
3. Complete one Medium solo answer correctly and confirm +15 category XP.
4. Complete one Hard solo answer correctly and confirm +25 category XP.
5. Submit an incorrect answer and confirm activity rises but XP does not.
6. Complete a Mixed game and confirm multiple category rows appear on Results.
7. Complete a live duel and verify each player receives only their own answer XP.
8. Complete a turn-based challenge and verify it is classified as turn-based.
9. Retry the result/summary calls and confirm XP does not increase again.
10. Upgrade an anonymous account and confirm the same profile retains progress.

Example read check while authenticated:

```sql
select public.get_my_category_progression();
```

## Security and calculation boundary

The browser must not duplicate the XP table or level formula. It may format
server values and display progress bars, but all award amounts, aggregate totals,
levels and percentages remain authoritative database outputs.

## Rollback

Do not drop progression tables after players have earned XP.

If award processing must be paused, disable the two triggers:

```sql
alter table public.game_runs
  disable trigger game_runs_category_progression_after_completion;

alter table public.duel_matches
  disable trigger duel_matches_category_progression_after_completion;
```

Existing category progression remains readable. Re-enable the triggers after
the issue is corrected, then rerun the migration to idempotently repair any
completed authoritative answers that were missed.
