# Phase 5 global progression UI rollout

This checkpoint exposes the already-deployed server-authoritative progression system in the browser. It does not add or change any XP rules.

## Deployment files

There are no Supabase SQL files in this checkpoint. Merge the frontend pull request to deploy through GitHub Pages.

The deployed static files are:

1. `progression-ui.css`
2. `progression-ui.js`
3. `index.html`
4. `progression-ui-smoke-test.mjs` — repository verification only

## What players see

- current global level and total XP in the header
- level progress in the account dialog
- exact server-awarded XP after a solo game
- exact server-awarded XP after a live duel or turn-based challenge
- progress remaining to the next configured level

## Trust boundary

The browser never calculates XP, applies a multiplier or determines a level. The UI reads only:

- `get_my_global_progression()`
- `get_solo_global_xp_summary(run_id)`
- `get_live_duel_global_xp_summary(match_id)`
- `get_turn_based_global_xp_summary(match_id)`

The progression script observes successful authoritative completion RPCs and then requests the matching owner-only XP summary.

## Production check

1. Open Trivia Rush after GitHub Pages deploys the merged commit.
2. Confirm the header shows the same level and total XP returned by `get_my_global_progression()`.
3. Open Account and confirm the progress bar and XP-to-next-level copy appear.
4. Complete a solo game and confirm the results card shows the exact `xp_awarded` value returned by `get_solo_global_xp_summary(run_id)`.
5. Complete a multiplayer match and confirm the match results show the exact participant award.
6. Refresh the page and confirm total XP persists.

A progression read failure must not block gameplay, score saving, authentication or multiplayer state.
