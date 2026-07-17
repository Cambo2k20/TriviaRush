# Supabase SQL

This folder contains the database deployment history and its production checks. Moving these files from the repository root did not run them against Supabase.

## Historical Phase 4 baseline

1. `phase-4a-question-platform.sql`
2. `phase-4a-question-seed.sql`
3. `phase-4a-verification.sql`
4. `phase-4b-multiplayer.sql`
5. `phase-4b-verification.sql`
6. `phase-4a-final-cutover.sql` — only after the replacement frontend was verified

These scripts document the deployed baseline. Do not rerun them simply because the files were reorganised.

## Phase 5 category expansion

1. `phase-5-category-platform.sql`
2. `phase-5-question-seed.sql`
3. `phase-5-category-verification.sql`

Fallback: `phase-5-category-rollback.sql`

Follow `docs/phase-5-category-rollout.md`.

## Phase 5 turn-based challenges

1. `phase-5-turn-based-challenges.sql`
2. `phase-5-turn-based-verification.sql`

Follow `docs/phase-5-turn-based-rollout.md`.

## Phase 5 global XP progression

1. `phase-5-global-progression-foundation.sql`
2. `phase-5-global-progression-verification.sql`

This checkpoint creates the secure progression foundation only. It does not
award XP from games until the subsequent solo and multiplayer integration
migrations are deployed.

Follow `docs/phase-5-global-progression-rollout.md`.
