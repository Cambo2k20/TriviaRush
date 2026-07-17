# Trivia Rush — Phase 5: Authoritative Trivia and Multiplayer

## Turn-based challenges prepared

The repository now contains the additive turn-based multiplayer checkpoint:

- challenge any permanent account; friendship remains optional;
- challenger plays first and the opponent has 72 hours to respond;
- independent 30/60/90-second server clocks with no pausing;
- identical questions and order, server-validated answers and scoring;
- challenger score and progress hidden until the second round finishes;
- draw on equal score and no competitive result for declined/expired matches;
- one multiplayer leaderboard with All, Live and Turn-based filters;
- private match history labels and recent expired/declined activity;
- in-app friend, invitation, reminder and result notifications;
- opt-in standards-based Web Push with an installable PWA;
- optional verified-email fallback through a server-only delivery outbox.

Deploy this checkpoint only by following
[`docs/phase-5-turn-based-rollout.md`](docs/phase-5-turn-based-rollout.md).

## Current question bank

The repository contains the verified Phase 5 content checkpoint:

- ten controlled categories, adding Food & Drink, Nature & Animals, and Art &
  Literature;
- 1,000 sourced questions, exactly 100 per category at 40 Easy / 40 Medium /
  20 Hard;
- permanent question keys preserved through taxonomy cleanup;
- category icon and colour metadata for the upcoming selection-card UI;
- a safe staged migration, generated idempotent seed, verification script and
  reversible rollback.

Follow
[`docs/phase-5-category-rollout.md`](docs/phase-5-category-rollout.md) exactly.

Phase 4 remains the architectural baseline described below.

Phase 4A is the safe first checkpoint for live 1v1 multiplayer. It moves the
question bank and solo answer validation into Supabase before duel rooms are
allowed to depend on them.

Phase 4B then adds permanent-account friends, challenges and live duels while
keeping solo and multiplayer statistics isolated. The two deployment stages
remain separate so the authoritative question cutover can be production-tested
before Realtime match state is introduced.

## Delivered platform baseline

- 1,000 sourced questions: exactly 100 in each of ten controlled categories.
- Per category: 40 easy, 40 medium and 20 hard questions.
- Balanced correct-answer positions: 334 / 333 / 333.
- Stable question keys, source URLs and a verification date for every record.
- Controlled category and question RPCs; clients never read answer keys.
- Server-owned question order, timing, answer validation, streaks and score.
- Idempotent answer submissions for safe network retries.
- Passing counts as an incorrect answer and uses the normal 850 ms feedback
  interval.
- Exactly one canonical `game_sessions` row per completed run.
- Existing `player_stats` trigger and solo leaderboard remain in place.
- Registered `duel_30`, `duel_60` and `duel_90` modes for Phase 4B.

## Files

- `phase-4a-question-platform.sql` — additive schema and RPC migration.
- `phase-4a-question-seed.sql` — generated, idempotent 700-question seed.
- `phase-4a-verification.sql` — read-only production verification queries.
- `phase-4a-final-cutover.sql` — closes the legacy client-score RPC after the
  new frontend is verified.
- `phase-4b-multiplayer.sql` — friends, rooms, live authoritative duels,
  private history and separate duel rankings.
- `phase-4b-verification.sql` — read-only multiplayer security and integrity
  checks.
- `data/questions.json` — source registry and verification date.
- `data/categories/*.json` — reviewable category question records.
- `scripts/build-question-seed.mjs` — validates the bank and regenerates SQL.
- `scripts/database-smoke-test.mjs` — executable PostgreSQL-compatible flow
  test using PGlite.
- `app.js`, `index.html`, `styles.css` — authoritative solo, live-duel,
  turn-based and notification frontend.
- `smoke-test.mjs` — DOM/category/leaderboard/social/lobby frontend checks.
- `phase-5-turn-based-challenges.sql` — additive per-player turn clocks,
  private challenge state, filtered multiplayer rankings and notification
  outbox.
- `phase-5-turn-based-verification.sql` — read-only production security and
  integrity checks for turn-based play and notifications.
- `supabase/functions/dispatch-notifications/index.ts` — authenticated Web Push
  and optional email delivery worker.
- `manifest.webmanifest`, `sw.js`, `icons/*` — installable web app and push
  notification receiver.
- `scripts/generate-vapid-keys.mjs` — local VAPID key generator; private keys
  must be saved only as Supabase secrets.

## Original Phase 4 deployment order

This historical order documents how the Phase 4 baseline was installed. Do not
rerun it on the current production database. For the current incremental
changes, use the two Phase 5 rollout documents linked above.

1. Run `phase-4a-question-platform.sql`.
2. Run `phase-4a-question-seed.sql`.
3. Run `phase-4a-verification.sql` and check its expected results.
4. Run `phase-4b-multiplayer.sql`.
5. Run `phase-4b-verification.sql` and check its expected results.
6. Deploy `index.html`, `app.js` and `styles.css` together.
7. Production-test one solo game and the two-account duel checklist below.
8. Only after both tests pass, run `phase-4a-final-cutover.sql` to close the
   legacy client-computed score path.

Steps 1–5 are compatible with the deployed Phase 3 frontend. This avoids a
window where the final frontend exposes controls whose RPCs are not installed.
The final cutover stays last so an older cached frontend keeps working during
the rollout and can be closed only after the replacement is verified.

## Phase 4A migration details

### 1. Run the additive platform migration

In Supabase SQL Editor, run:

```text
phase-4a-question-platform.sql
```

This keeps the deployed Phase 3 site operational. It does not drop or replace
`profiles`, `player_stats`, `game_sessions`, the stats trigger, leaderboard
RPCs or `submit_game_result`.

### 2. Load the question bank

Run:

```text
phase-4a-question-seed.sql
```

Then run:

```text
phase-4a-verification.sql
```

Confirm:

- seven categories report 100 active questions each;
- the total is 700;
- each category reports 40 easy / 40 medium / 20 hard;
- answer positions report 234 / 233 / 233;
- both quality-check queries report zero;
- the client table-privilege query returns no rows;
- RLS is enabled on all five RPC-only tables.

### Authoritative solo frontend behaviour

The final frontend no longer loads `questions.js` and uses only:

- `get_question_categories`
- `start_solo_game`
- `get_current_solo_question`
- `submit_solo_answer`
- `finish_solo_game`

It no longer computes or submits a final score in the browser. Deploy the
frontend at step 6 of the combined order, after both backend migrations exist.

### Solo production test

1. Hard-refresh the published site.
2. Confirm all seven categories appear, including Gaming.
3. Complete a game with at least one correct answer, one incorrect answer and
   one pass.
4. Confirm the result says it was server-validated and saved.
5. Confirm exactly one new `game_sessions` row exists for the player.
6. Confirm the Today and relevant category leaderboard entries update.
7. Confirm retrying or double-clicking cannot create duplicate answers or a
   duplicate session.

### Final cutover check

Only after both the solo and duel production tests pass, run:

```text
phase-4a-final-cutover.sql
```

Its final query must report `false` for both `anon` and `authenticated`. The
function remains installed for reversible rollback, but browser roles can no
longer submit client-computed scores.

## Local verification

```bash
npm install
npm test
```

`npm test` rebuilds and audits the question bank, runs the full database game
flow (including idempotency, pass semantics, canonical history and final
cutover), and runs the frontend smoke checks.

## Phase 4B deployment

For the combined rollout, Phase 4B is installed after the Phase 4A platform and
question seed but before the final frontend and cutover, as listed above.

### 1. Run the multiplayer migration

In Supabase SQL Editor, run:

```text
phase-4b-multiplayer.sql
```

The migration checks the confirmed production prerequisites before writing:

- `auth.users.is_anonymous` is a non-null boolean;
- the `supabase_realtime` publication exists;
- Phase 4A tables and RPCs exist.

It then adds:

- proper friend requests, acceptance, decline and removal;
- open room codes/share links and reserved account-number challenges;
- server-owned match/question/answer state;
- participant-only Realtime policies for match state and a safe progress
  projection containing only score and questions answered;
- reconnect heartbeats and end-of-timer forfeits;
- private opponent-filterable match history;
- separate duel rankings: wins, eligible win rate after five matches, then
  total duel score;
- mode-aware solo stats trigger and solo leaderboard filtering;
- two canonical `game_sessions` rows for each completed duel.

### 2. Run read-only verification

Run:

```text
phase-4b-verification.sql
```

Confirm all objects resolve, all multiplayer tables have RLS, no browser role
has write privileges, only `duel_matches` and `duel_live_progress` were added to
Realtime, and every completed match has exactly two canonical sessions.

### 3. Deploy the Phase 4 frontend

Deploy:

```text
index.html
app.js
styles.css
```

### 4. Test with two permanent accounts

1. Open the published site in two separate browser profiles.
2. Sign into a different permanent account in each profile.
3. Send, accept and remove a friend request once.
4. Create an open duel and join it using its room code or copied link.
5. Confirm both players see the same questions in the same order.
6. Confirm each player sees only the opponent's score and answered count—not
   individual correctness.
7. Complete a draw test and a non-draw test.
8. Create a direct challenge using the second account's exact account number.
9. Refresh one browser during a match and confirm it reconnects.
10. Close one browser for the final twelve seconds and confirm a forfeit.
11. Confirm the duel appears in both private histories and the duel
    leaderboard, while solo totals remain unchanged.

Friendship is never required to challenge or join. Anonymous accounts see the
feature but must upgrade or sign in before any social or duel RPC can execute.
