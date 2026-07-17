# Phase 5 Category Expansion Rollout

**Code status:** prepared and tested  
**Production status:** not deployed until the SQL steps below are completed

## Outcome

This checkpoint expands the authoritative bank from seven categories and 700
questions to ten categories and 1,000 questions.

New categories:

- Food & Drink (`food_drink`)
- Nature & Animals (`nature_animals`)
- Art & Literature (`art_literature`)

Every category contains exactly 40 Easy, 40 Medium and 20 Hard questions. The
same controlled RPCs serve solo games, duels and category filters.

## Why deployment is non-breaking

- The frontend update accepts database-controlled category counts instead of
  requiring exactly seven. It still works against the current seven-category
  production database.
- `supabase/sql/phase-5-category-platform.sql` initially inserts the three new
  categories as inactive, so running it alone does not expose an empty category.
- `supabase/sql/phase-5-question-seed.sql` inserts and validates all questions in
  one transaction. It activates the new categories only after every category
  has exactly 100 active questions.
- Existing question keys are updated in place during taxonomy moves. History
  and future progression backfill retain the same identities.
- The rollback hides the three new categories and their questions without
  deleting data.

## Exact production order

### 1. Merge and wait for GitHub Pages

Merge the category-expansion pull request. Wait for GitHub Pages to finish, then
hard-refresh the website. The site should still show the existing seven
categories because the database has not changed yet.

### 2. Run the category platform migration

In **Supabase → SQL Editor → New query**, run the complete contents of:

```text
supabase/sql/phase-5-category-platform.sql
```

This adds safe card metadata, replaces the controlled category RPC and stages
the new category rows as inactive. The deployed site should still show seven
categories after this step.

### 3. Run the 1,000-question seed

In a fresh SQL Editor query, run:

```text
supabase/sql/phase-5-question-seed.sql
```

The script is generated and idempotent. It upserts all 1,000 stable keys,
validates 100 questions in each category, then activates all ten categories.
Any error rolls back the complete seed and leaves the staged categories hidden.

### 4. Run read-only verification

In a fresh query, run:

```text
supabase/sql/phase-5-category-verification.sql
```

Confirm:

- ten category rows, each with 100 questions;
- `active_categories = 10` and `categories_with_card_metadata = 10`;
- every category reports 40 Easy, 40 Medium and 20 Hard;
- total active questions is 1,000;
- answer positions are 334 / 333 / 333;
- all 30 moved keys have their expected new category;
- every quality count is zero;
- the category RPC returns ten safe rows;
- the final privilege query returns no rows.

### 5. Production test

1. Hard-refresh the website.
2. Confirm all ten categories appear in solo, duel and leaderboard controls.
3. Complete one solo game in each new category.
4. Complete one two-account duel in a new category.
5. Confirm scores save once, passes count as incorrect and opponents still see
   score/progress rather than correctness.
6. Confirm the relevant solo and duel leaderboard views update.

## Reversible fallback

If the new content must be hidden, run:

```text
supabase/sql/phase-5-category-rollback.sql
```

It disables the three new category banks and checks that the remaining active
surface is seven categories and 700 questions. It deletes nothing. Rerunning
`supabase/sql/phase-5-question-seed.sql` restores the ten-category bank.
