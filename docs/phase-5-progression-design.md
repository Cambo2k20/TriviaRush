# Trivia Rush Phase 5 — Category Mastery and Player Identity

**Status:** approved product design; implementation not yet deployed  
**Target branch:** `phase-5-progression`  
**Baseline:** merged and verified Phase 4

## 1. Approved decisions

Phase 5 uses the recommended defaults accepted by the project owner:

- Solo and duel answers earn category XP under the same rules.
- Anonymous guests can earn progression and keep it when upgrading the same
  Supabase identity into a permanent account.
- Public profiles, title equipment and social display require a permanent
  account.
- Correct-answer XP is difficulty-based: Easy 10, Medium 15, Hard 25.
- Incorrect answers and passes award zero XP.
- Mixed games credit each question's actual category.
- Permanent XP is not multiplied by speed, streak, score, duel result or game
  duration.
- Category badges and titles unlock every five levels.
- The first reward catalogue covers levels 5, 10, 15, 20 and 25.
- Players equip one global title at a time.
- Permanent profiles publicly show the safe progression projection.
- Existing activity receives an exact-where-possible backfill, conservative
  legacy credit and a Founding Player badge.
- Question-bank expansion happens alongside progression.

## 2. Goals

Phase 5 must answer three player questions:

1. What subjects am I becoming good at?
2. What did I earn from this game?
3. What should I work toward next?

It must do that without weakening the Phase 4 security model or confusing
long-term experience with competitive skill.

### Non-goals

Phase 5 does not introduce:

- random matchmaking;
- Elo, Glicko or another competitive rating;
- seasonal rank resets;
- open chat;
- user-submitted questions;
- paid power-ups;
- a second completed-game history table.

Those features can build on Phase 5 later, but are not part of this migration.

## 3. Progression language

| Concept | Meaning | Can decrease? |
| --- | --- | --- |
| Category XP | Trusted correct-answer progress in one category | No |
| Category level | Level derived from cumulative category XP | No |
| Badge | Permanent collectible milestone reward | No |
| Title | Permanent text reward that may be equipped | No |
| Competitive rating | Future estimate of head-to-head skill | Yes |

The interface must never call category level a competitive rank or rating.

## 4. XP rules

### 4.1 Award table

| Server-accepted result | Easy | Medium | Hard |
| --- | ---: | ---: | ---: |
| Correct | 10 XP | 15 XP | 25 XP |
| Incorrect | 0 XP | 0 XP | 0 XP |
| Pass | 0 XP | 0 XP | 0 XP |

### 4.2 Invariants

- The server reads category and difficulty from `trivia_questions`.
- The browser never submits category XP, total XP, level or unlocks.
- A retry of the same accepted answer returns the stored award and never
  grants it again.
- Solo and duel modes use the same private award function.
- A Mixed run can advance several category tracks.
- An answer remains worth the XP that was recorded when it was accepted even
  if a question's difficulty changes later.
- Disabling or editing a question does not remove previously earned XP.
- A duel win does not grant extra category XP.
- A 90-second game has no per-answer XP advantage over a 30-second game.

### 4.3 Category statistics

Every accepted answer updates trusted category activity even when it awards no
XP:

- questions answered;
- correct answers;
- incorrect answers, including passes;
- solo questions answered;
- duel questions answered;
- last activity time.

This supports profile accuracy and future achievements without deriving it
from client state.

## 5. Level curve

Level 1 starts at zero XP.

The cost to advance from level `L` to `L + 1` is:

```text
L × 100 XP
```

The cumulative XP threshold for level `L` is:

```text
50 × (L - 1) × L
```

Examples:

| Level | Cumulative XP | XP to next level |
| ---: | ---: | ---: |
| 1 | 0 | 100 |
| 2 | 100 | 200 |
| 5 | 1,000 | 500 |
| 10 | 4,500 | 1,000 |
| 15 | 10,500 | 1,500 |
| 20 | 19,000 | 2,000 |
| 25 | 30,000 | 2,500 |
| 50 | 122,500 | — |

The first migration seeds thresholds through level 50. Rewards initially stop
at level 25. Thresholds and rewards are data rows so later balancing or new
tiers do not require frontend constants.

XP is never discarded at a level boundary. If one award crosses several
thresholds, every crossed milestone is processed in the same transaction.

## 6. Reward catalogue

Every milestone grants two permanent rewards:

- a category badge using the category icon and milestone frame;
- a category-themed title.

### 6.1 Shared badge tiers

| Level | Tier | Frame key |
| ---: | --- | --- |
| 5 | Bronze | `bronze` |
| 10 | Silver | `silver` |
| 15 | Gold | `gold` |
| 20 | Platinum | `platinum` |
| 25 | Diamond | `diamond` |

Badge assets are assembled from one category icon plus one shared tier frame.
This produces 50 distinct category badges from 15 reusable visual components:
ten category icons and five shared milestone frames.

### 6.2 Titles

| Category | Level 5 | Level 10 | Level 15 | Level 20 | Level 25 |
| --- | --- | --- | --- | --- | --- |
| Science | Lab Assistant | Researcher | Scientist | Theorist | Scientific Luminary |
| History | Archivist | Chronicler | Historian | Timekeeper | Keeper of Ages |
| Geography | Wayfinder | Explorer | Cartographer | Pathfinder | Master of the Map |
| Entertainment | Fan | Critic | Aficionado | Tastemaker | Entertainment Icon |
| Sport | Contender | Competitor | Analyst | Champion | Sporting Legend |
| Technology | Tinkerer | Developer | Engineer | Architect | Tech Visionary |
| Gaming | Player One | Adventurer | Strategist | Game Master | Gaming Legend |

Title text is configuration data and can be refined before the reward seed is
approved. Reward IDs and asset keys remain stable once players can earn them.

### 6.3 Global reward

Existing permanent players who qualify for the historical backfill receive:

- badge: `Founding Player`;
- title: `Founding Player`.

The global reward is independent of category level and is granted once.

## 7. Database design

All new tables use RLS, no direct browser writes and controlled RPC access.
All public mutation functions use `security definer`, `set search_path = ''`
and identify the caller through `auth.uid()`.

### 7.1 `category_level_thresholds`

Configuration table:

```text
level               smallint primary key
cumulative_xp       bigint not null unique
created_at          timestamptz not null default now()
```

Constraints:

- level between 1 and 500;
- cumulative XP is non-negative;
- level 1 threshold is zero;
- the seed is monotonic and verified by the migration.

Browser roles receive no direct privileges.

### 7.2 `progression_rewards`

Reward definition table:

```text
id                   text primary key
category_id          text null references question_categories(id)
reward_type          text not null
level_required       smallint null
name                 text not null
description          text not null
badge_tier           text null
asset_key            text null
sort_order           integer not null
is_active            boolean not null default true
created_at           timestamptz not null default now()
```

Rules:

- `reward_type` is `badge` or `title`;
- category milestone rewards require a category and level;
- global rewards may have both values null;
- stable ID format: `category.type.level`, for example
  `science.title.10`;
- one badge and one title per category milestone;
- asset keys never contain a public storage URL.

Browser roles receive no direct privileges. Safe reward definitions are
returned through profile/progression RPCs.

### 7.3 `player_category_progress`

Trigger/RPC-owned aggregate:

```text
player_id             uuid references profiles(id) on delete cascade
category_id           text references question_categories(id)
xp                     bigint not null default 0
level                  smallint not null default 1
questions_answered     bigint not null default 0
correct_answers        bigint not null default 0
incorrect_answers      bigint not null default 0
solo_questions         bigint not null default 0
duel_questions         bigint not null default 0
last_activity_at       timestamptz null
updated_at             timestamptz not null default now()
primary key (player_id, category_id)
```

Constraints reconcile totals and prevent negative values. `level` is cached
for fast reads but is always derived from `xp` inside the private award
function.

Indexes:

- `(player_id, level desc, xp desc)` for profiles;
- `(category_id, level desc, xp desc)` reserved for future mastery boards.

Browser roles receive no direct table privileges.

### 7.4 `player_rewards`

Immutable reward ownership:

```text
player_id             uuid references profiles(id) on delete cascade
reward_id             text references progression_rewards(id)
earned_at             timestamptz not null default now()
source_category_id    text null
source_level          smallint null
primary key (player_id, reward_id)
```

Unlock writes use `on conflict do nothing`, making milestone processing safe
under retries and concurrent requests.

### 7.5 `player_profile_cosmetics`

Keeps `profiles` focused on identity:

```text
player_id             uuid primary key references profiles(id) on delete cascade
equipped_title_id     text null references progression_rewards(id)
updated_at             timestamptz not null default now()
```

`set_equipped_title` verifies that:

- the caller is a permanent account;
- the requested reward is an active title;
- the caller owns it.

Passing null unequips the title.

### 7.6 Authoritative answer audit fields

Add to both `game_run_answers` and `duel_answers`:

```text
category_xp_awarded   integer not null default 0
progression_version   smallint null
progression_awarded_at timestamptz null
```

These columns store the historical award on the existing authoritative answer
record. They do not create a parallel answer or game history.

## 8. Award transaction

Create a private function conceptually named:

```text
trivia_private.award_category_progress(
  player_id,
  question_id,
  is_correct,
  mode_family,
  answer_table,
  answer_id,
  progression_version
)
```

The final SQL may use typed wrappers rather than a text table identifier. It
must never use dynamic SQL derived from browser input.

Transaction behaviour:

1. Read the question category and difficulty.
2. Calculate XP from the fixed server rule.
3. Lock or upsert the player's category aggregate row.
4. Increment answer totals and mode-family totals.
5. Add XP and derive the new level from the threshold table.
6. Insert every newly eligible reward with `on conflict do nothing`.
7. Store XP and progression version on the accepted answer row.
8. Return the trusted progression delta.

The award occurs after the unique answer insert and in the same database
transaction. Existing idempotent-replay branches return the stored award
without invoking progression again. Any failure rolls back both answer and XP.

### 8.1 Concurrency

The aggregate row is updated with a row lock or atomic upsert. Two simultaneous
accepted answers in different modes must produce the same final XP as two
sequential answers. Reward ownership uniqueness prevents duplicate unlocks.

## 9. Browser RPC design

### `get_my_progression()`

Authenticated and anonymous players with a profile receive:

- ten category progress records;
- current level and XP;
- current and next level thresholds;
- answered/correct totals and accuracy;
- owned badges and titles;
- equipped title when eligible;
- permanent-account capability flags.

Missing category aggregate rows are represented as level 1 / zero XP without
requiring eager inserts for every new player.

### `get_public_player_profile(p_account_number bigint)`

Returns only a permanent player's safe public projection:

- display name and account number;
- equipped title;
- category levels and badge IDs;
- existing safe duel summary;
- account creation month or member-since date if approved for display.

It never returns UUIDs, email, anonymous status metadata, answer details,
friendship internals or private match history.

Profiles are reachable from friends, duel history, leaderboards and exact
account-number lookup. Phase 5 does not add fuzzy player search.

### `set_equipped_title(p_reward_id text)`

Permanent-account mutation described in section 7.5.

### `get_solo_progression_summary(p_run_id uuid)`

Owner-only result for the completed or expired solo run:

- XP gained per real category;
- levels before and after;
- newly unlocked reward IDs;
- final current progress.

### `get_duel_progression_summary(p_match_id uuid)`

Participant-only result for the caller's completed duel. It never returns the
opponent's per-answer progression or correctness.

## 10. Existing-player backfill

The migration performs a single transactional backfill using a captured launch
cutoff and a progression version.

### 10.1 Exact Phase 4 credit

For existing authoritative solo and duel answer rows:

- join the actual `trivia_questions` record;
- award the approved difficulty XP for correct answers;
- update category activity for every answer;
- write the historical XP and progression version onto the answer row.

### 10.2 Conservative legacy credit

For older single-category solo `game_sessions` that do not map to a Phase 4
`game_runs.completed_session_id` and have no duel match:

- award 10 XP per recorded correct answer;
- credit the stored category only when it matches an active controlled
  category;
- increment answered/correct/incorrect category totals from the session;
- do not attempt difficulty weighting.

Older `mixed` sessions receive no invented category allocation.

### 10.3 Founding Player

Grant the Founding Player badge and title to every permanent account with at
least one completed `game_sessions` row before the captured launch cutoff.

### 10.4 Idempotency

The migration records progression version 1. Backfill statements update only
unprocessed authoritative answers and insert reward ownership with conflict
protection. A verification query must prove that running the backfill body
again changes zero rows.

## 11. Player experience

### 11.1 Home screen

Keep the existing category selector and fast start action. Add a compact
“Mastery” button or strip showing:

- equipped title for permanent accounts;
- the player's three highest category levels;
- a link to the full profile/progression screen.

Do not turn the home screen into ten large progress cards on small phones.

### 11.2 Results screen

Below the existing score summary, show:

- total category XP earned;
- one row per category advanced in the game;
- level progress before and after;
- new badge/title unlocks;
- a non-blocking level-up animation.

Mixed games can show several rows. Zero-XP games show encouraging accuracy
feedback without pretending XP was earned.

### 11.3 Profile and mastery screen

Sections:

1. Identity card: name, account number, equipped title.
2. Seven-part knowledge wheel or accessible equivalent.
3. Category cards with level, XP bar, accuracy and next reward.
4. Badge cabinet.
5. Title collection and equip action.
6. Existing safe duel record.

Every visual representation must also have text values and must not rely on
colour alone.

### 11.4 Social and leaderboard surfaces

Show the equipped title beneath a permanent player's display name. Avoid
placing ten levels in every row; full mastery belongs on the profile.

## 12. Frontend structure

Before adding the full UI, split the current single IIFE into native ES modules
without adding a framework:

```text
src/config.js
src/supabase-client.js
src/state.js
src/auth.js
src/profile.js
src/solo-game.js
src/leaderboard.js
src/social.js
src/duel.js
src/progression.js
src/speech.js
src/ui.js
src/main.js
```

The refactor must be behaviour-preserving and land separately from the
progression UI where possible. Existing smoke tests should be adapted before
new behaviour is introduced.

## 13. Security requirements

- No direct browser writes to progression tables.
- No public UUIDs in profile RPCs.
- No progression data may reveal private answer history.
- Guest XP is retained because account upgrade preserves `auth.uid()`.
- Only permanent accounts can expose a public profile or equip a title.
- Reward IDs and asset keys are escaped or assigned through DOM properties.
- Rate-limit public profile lookup by exact account number if abuse appears.
- User metadata remains UX state, never progression authority.
- The legacy client-score RPC remains closed.

## 14. Verification and tests

### Database

- Correct Easy/Medium/Hard answers award 10/15/25 XP.
- Incorrect answers and passes award zero XP but update totals.
- Mixed games update the actual question category.
- Solo and duel awards are identical.
- Idempotent answer replay does not duplicate XP.
- Concurrent answers produce correct aggregate totals.
- One answer crossing a threshold unlocks badge and title exactly once.
- Crossing multiple thresholds unlocks all eligible rewards.
- Guests earn progress and keep it after upgrade.
- Guests cannot equip titles or return a public profile.
- Permanent players can equip only owned active titles.
- Public profile output contains no UUID, email or private match data.
- Backfill exact and conservative paths do not overlap.
- Backfill rerun changes zero rows.
- Deleting a profile cascades progression ownership safely.

### Frontend

- Category progress renders loading, empty, error and populated states.
- Level bars use trusted threshold values.
- Mixed results render multiple categories.
- Level-up presentation is non-blocking and reduced-motion aware.
- Title equipment has pending, success and error states.
- Guest upgrade prompt preserves visible earned progress.
- Existing solo, leaderboard, friends and duel flows remain functional.

### Production acceptance

1. Verify pre-migration counts and take a database backup.
2. Run the additive Phase 5 progression migration.
3. Run read-only verification and backfill reconciliation.
4. Confirm the Phase 4 frontend still works unchanged.
5. Deploy the modularised frontend with progression screens.
6. Test one guest solo game and upgrade that guest.
7. Test a permanent-account solo game crossing a level boundary.
8. Test a two-account duel and compare both XP awards.
9. Test a Mixed game that awards at least two categories.
10. Test title equipment and public profile safety.

## 15. Delivery stages

### Phase 5.0 — completed foundation merge

- Complete Phase 4 source is now represented in GitHub.
- The local audit suite is included.
- GitHub verification runs on pull requests.

### Phase 5.1 — progression backend

- additive tables and audit fields;
- level and reward seeds;
- award function and answer integration;
- backfill and verification;
- controlled progression/profile RPCs;
- database tests.

### Phase 5.2 — frontend structure and UI

- behaviour-preserving ES-module split;
- mastery/profile screen;
- result XP summary;
- badge cabinet and title equipment;
- public-safe profiles;
- frontend tests.

### Phase 5.3 — question depth and quality

- controlled candidate intake;
- independently rewritten and sourced questions;
- question reporting;
- exposure/correct-rate metrics;
- first reviewed expansion batch.

## 16. Exit criteria

Phase 5 is complete only when:

- every trusted answer updates exactly one real category track;
- retries cannot duplicate XP or rewards;
- all ten categories level independently;
- guests keep progress through upgrade;
- badges and titles unlock at levels 5/10/15/20/25;
- a permanent player can equip one owned title;
- public profiles expose only approved fields;
- existing players receive the approved idempotent backfill;
- the frontend explains every XP and unlock result clearly;
- the expanded question batch passes source, duplicate and distribution audits;
- all previous solo and duel acceptance tests still pass.
