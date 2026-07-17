# Trivia Rush

Trivia Rush is a browser-based trivia game with ten controlled question categories, solo rush games, live duels, turn-based challenges, leaderboards and opt-in notifications.

## Current state

- 1,000 sourced questions: 100 per category, split 40 Easy / 40 Medium / 20 Hard.
- Server-owned question order, clocks, answer validation, streaks and scoring.
- Solo, live 1v1 and asynchronous turn-based play.
- Permanent accounts, friend requests, private match history and filtered rankings.
- Installable PWA with in-app notifications and optional Web Push.
- Category mastery and progression are designed in `docs/phase-5-progression-design.md`; implementation is the next planned feature.

## Repository layout

| Path | Purpose |
| --- | --- |
| `index.html`, `app.js`, `styles.css` | GitHub Pages frontend |
| `manifest.webmanifest`, `sw.js`, `icons/` | PWA and notification assets |
| `data/` | Controlled category manifest, sources and question records |
| `scripts/` | Seed generation, validation and smoke tests |
| `supabase/sql/` | Database migrations, verification scripts and rollback SQL |
| `supabase/functions/` | Supabase Edge Functions |
| `docs/` | Architecture, rollout and product-design documentation |

See `docs/repository-structure.md` for the organisation rules.

## Local verification

```bash
npm install
npm test
```

`npm test` validates the question bank, executes the authoritative database flows with PGlite and runs the frontend smoke suite.

## Database deployment

SQL files are stored in `supabase/sql/` so the repository root remains focused on the web application. Moving them did **not** execute or redeploy anything in Supabase.

Use the rollout guide for the relevant checkpoint:

- `docs/phase-5-category-rollout.md`
- `docs/phase-5-turn-based-rollout.md`

Do not rerun historical migrations merely because their repository path changed.

## Security model

- Browsers never receive answer keys.
- Competitive game state is validated and finalised server-side.
- Answer submissions are idempotent for safe retries.
- Private multiplayer and notification tables are protected by RLS.
- Service-role credentials, VAPID private keys and dispatch secrets are never committed.
