# Trivia Rush — Current State and Phase 5 Direction

**Status:** Phase 4 deployed and production-tested  
**Current planning baseline:** 17 July 2026  
**Live site:** https://cambo2k20.github.io/TriviaRush/  
**Repository:** https://github.com/Cambo2k20/TriviaRush

## 1. Product summary

Trivia Rush is a mobile-first, timed trivia game with authoritative solo play,
live one-versus-one duels, permanent player accounts, friends, private match
history and separate solo and multiplayer rankings.

The project has moved well beyond a static GitHub Pages quiz. GitHub Pages is
now the frontend host, while Supabase owns identity, question delivery, game
state, timing, answer validation, scoring, history, social relationships and
rankings.

The strongest product loop today is:

1. Choose a category.
2. Answer as many questions as possible before time expires.
3. Earn more points for correct, fast answers and longer streaks.
4. Compare a solo high score or challenge another permanent player live.
5. Review duel results and rankings.

Phase 5 should add a durable reason to return: category mastery, levels,
collectible badges, equippable titles and richer player identity.

## 2. Deployment status

The following are confirmed in production:

- Phase 3 hardening is deployed.
- The Phase 4 authoritative question platform is deployed.
- The 700-question seed is deployed and verified.
- The friends and live-duel migration is deployed.
- The Phase 4 frontend is deployed from `main`.
- A production solo game and two-account live duel complete successfully.
- The legacy client-computed score RPC has been closed to both `anon` and
  `authenticated` browser roles.

Local verification also passes the question audit, database flow test and
frontend smoke suite. The database test covers idempotent answers, pass
semantics, canonical history, friends, identical duel questions, private
opponent correctness, draws, reconnect forfeits, duel rankings and solo/duel
statistics isolation.

### Repository warning

The live `main` branch contains the deployed Phase 4 frontend, but its README
still describes the original static Phase 1 game. At this planning date,
`main` also does not contain the Phase 4 SQL migrations, question source data,
build scripts or automated tests that produced the deployed backend.

The complete Phase 4 archive is therefore the recoverable backend source of
truth, while GitHub is only a partial representation of production. Before
Phase 5 implementation begins, the complete Phase 4 source should be committed
to a protected development branch and reviewed into `main`. Otherwise a fresh
clone cannot reproduce, test or safely migrate the live system.

## 3. Features available today

### 3.1 Solo gameplay

- One 60-second Rush mode.
- Mixed-category or single-category play.
- Exactly three answers per question.
- Tap/click controls and keyboard shortcuts: `1`, `2`, `3`, `P` and `V`.
- Passing is allowed and counts as incorrect.
- An 850 ms feedback interval follows every submitted answer.
- Server-measured response time.
- Server-calculated score and streak multiplier.
- Correct-answer feedback after submission.
- Retry-safe answer requests using client-generated request IDs.
- Server finalisation and exactly one canonical completed session.
- Loading, gameplay, result, save-error and retry states.
- Optional sound effects.
- Optional spoken host using browser speech synthesis.
- Optional voice answers when browser speech recognition is available.
- Responsive phone and desktop layouts.

### 3.2 Scoring

The server awards points only for correct answers:

- Base value: 100 points.
- Speed bonus: up to 100 additional points, decreasing with server-measured
  response time.
- Streak multiplier: starts at `1.0x`, rises by `0.5x` every three consecutive
  correct answers and is capped at `3.0x`.
- Maximum: 600 points per question.
- An incorrect answer or pass resets the current streak and awards zero points.

Solo and duel modes use the same authoritative scoring formula.

### 3.3 Question bank

Trivia Rush currently has 700 active, sourced questions:

| Category | Questions | Easy | Medium | Hard |
| --- | ---: | ---: | ---: | ---: |
| Science | 100 | 40 | 40 | 20 |
| History | 100 | 40 | 40 | 20 |
| Geography | 100 | 40 | 40 | 20 |
| Entertainment | 100 | 40 | 40 | 20 |
| Sport | 100 | 40 | 40 | 20 |
| Technology | 100 | 40 | 40 | 20 |
| Gaming | 100 | 40 | 40 | 20 |
| **Total** | **700** | **280** | **280** | **140** |

Every record has:

- a stable question key;
- one controlled category ID;
- a difficulty value;
- three unique answers;
- a server-private correct answer index;
- a source name and HTTPS source URL;
- a verification date;
- active/inactive lifecycle state.

Correct-answer positions are balanced `234 / 233 / 233`. Normalised question
text is unique. The browser receives questions through controlled RPCs and
never reads the question table or answer keys directly.

### 3.4 Accounts and identity

- A visitor can start as a Supabase anonymous user.
- A profile has a unique display name and permanent numeric account number.
- An anonymous identity can be upgraded into a permanent email/password
  account without changing its player ID.
- Email verification, password setup and password recovery are implemented.
- Permanent players can update their display name and password.
- Signing out creates a fresh guest session for continued solo play.
- Permanent accounts are required for friends and duels.

### 3.5 Friends and challenges

- Find an eligible permanent player by exact account number.
- Send a friend request.
- Accept or decline an incoming request.
- View outgoing requests.
- View a friends list.
- Remove a friend.
- Challenge a friend directly.
- Challenge any eligible player by account number without first becoming
  friends.
- Create an open duel and share an eight-character room code or link.
- Join an open duel by code or link.
- View and accept direct invitations.

The database prevents self-friending and duplicate relationship pairs.

### 3.6 Live one-versus-one duels

- Real simultaneous play.
- Host chooses Mixed or one of the seven categories.
- Host chooses 30, 60 or 90 seconds.
- Both players receive the same questions in the same order.
- Each player answers independently and can pass.
- Timing, correctness, score, streak and final result are server-owned.
- The opponent sees only score and questions answered during play.
- Individual answer choices, correctness, response time and streak are not
  broadcast.
- Equal scores produce a draw.
- The higher score wins otherwise.
- A player absent during the final heartbeat window can forfeit if the opponent
  stayed connected.
- Refresh/reconnect restores an active match.
- A rematch action preserves the previous match settings.
- Every completed duel creates two canonical `game_sessions` rows, one per
  player.
- Duel sessions do not modify established solo lifetime statistics.

### 3.7 Match history

- Private completed-duel history for the signed-in player.
- Opponent display name and account number.
- Win, loss, draw or forfeit outcome.
- Both final scores.
- Category and duration.
- Optional filtering by an opponent's exact account number.
- Current frontend loads the most recent 30 matching records.

### 3.8 Leaderboards

Solo leaderboard:

- All time, This week and Today.
- Overall, Mixed and every controlled category.
- Top 20.
- Ranking by high score, then accuracy, then best streak.
- Current-player highlighting and a separate “Your rank” card.
- Solo modes only.

Duel leaderboard:

- Separate from solo.
- Wins, draws, losses and matches played.
- Win rate after five completed matches; earlier players are provisional.
- Total duel score.
- Ranking by wins, non-provisional status, win rate and total duel score.
- Top 20 in the current interface.

## 4. Current architecture

### 4.1 Technology

- Static HTML, CSS and JavaScript frontend.
- GitHub Pages hosting.
- Supabase Auth.
- Supabase PostgreSQL.
- Supabase Realtime for duel match and safe progress updates.
- No frontend framework and no production bundler.
- Node-based local audit and smoke tests using JSDOM and PGlite.

### 4.2 Data ownership

| Concern | Source of truth |
| --- | --- |
| Public identity | `profiles` |
| Registered modes | `game_modes` |
| Completed per-player games | `game_sessions` |
| Trigger-maintained solo lifetime totals | `player_stats` |
| Controlled category taxonomy | `question_categories` |
| Question content and private answer keys | `trivia_questions` |
| Active solo state | `game_runs` and run child tables |
| Friend requests and accepted friendships | `friendships` |
| Duel room and result | `duel_matches` |
| Private per-player duel state | `duel_players` |
| Safe opponent Realtime projection | `duel_live_progress` |
| Shared duel order and answer records | duel question/answer child tables |

`game_sessions` remains the canonical completed-game summary history. The
solo and duel operational tables provide the detailed server state needed to
validate play; they are not alternative public score-history tables.

### 4.3 Controlled browser API

Question and solo RPCs:

- `get_question_categories`
- `start_solo_game`
- `get_current_solo_question`
- `submit_solo_answer`
- `finish_solo_game`

Solo ranking RPCs:

- `get_leaderboard_v2`
- `get_my_leaderboard_rank_v2`

Social and duel RPCs:

- `lookup_duel_player`
- `send_friend_request`
- `respond_friend_request`
- `remove_friend`
- `get_social_dashboard`
- `create_duel`
- `join_duel`
- `cancel_duel`
- `get_duel_state`
- `submit_duel_answer`
- `get_duel_invitations`
- `get_duel_match_history`
- `get_duel_leaderboard`
- `get_my_duel_rank`

The old `submit_game_result` function remains installed for reversible
rollback, but browser execution has been revoked.

## 5. Security and integrity posture

The current design has several important strengths:

- The server chooses question order.
- The browser cannot read answer keys in advance.
- The server measures timing and validates answers.
- Browser roles cannot insert or update game-state tables directly.
- Public mutations use narrow `security definer` RPCs with an empty
  `search_path`.
- RPCs bind ownership to `auth.uid()` rather than accepting a player ID.
- Answer request IDs make network retries idempotent.
- Row-level security limits friendship and duel reads to participants.
- Only duel match state and the deliberately minimal live-progress table are
  in the Realtime publication.
- Opponent correctness is not present in the live projection.
- Database constraints reconcile answer totals, score ranges, streaks,
  durations and mode families.
- Solo aggregate statistics ignore duel sessions.

This is a suitable foundation for progression because XP can be awarded from
the same trusted answer transaction. Category levels must never be computed or
submitted by the browser.

## 6. Current constraints and risks

### 6.1 Repository completeness — immediate priority

The deployed backend source and tests are not yet represented on `main`. This
is the highest operational risk because future migrations could be written
against an incomplete repository snapshot.

### 6.2 Frontend size

`app.js` is now approximately 4,100 lines in a single IIFE, with an 800-line
HTML document and roughly 2,000 lines of CSS. It works, but progression,
profiles, collections and matchmaking would make the single module difficult
to change safely. Native ES modules can be used on GitHub Pages without adding
a framework.

### 6.3 Question depth

One hundred questions per category was a strong launch milestone, but is not
enough for a long-term category-mastery game. A regular player can encounter
noticeable repetition after only a handful of focused sessions. Progression
will increase repeat play, so content depth and quality tooling become product
infrastructure rather than optional content work.

A sensible next content target is at least 300–500 reviewed questions per broad
category, followed by deeper topic packs for popular categories. Question
quality should take priority over reaching a headline number.

### 6.4 No question operations interface

Questions currently move through source JSON and generated SQL. There is no
internal review queue, question editor, player report action, retirement
workflow, exposure count or difficulty calibration based on real answer data.

### 6.5 Ranking scalability

All-time leaderboards aggregate completed records at request time. This is
acceptable at the present scale, but should eventually move to maintained
aggregates or cached ranking snapshots before the history tables become large.

### 6.6 No continuous integration

The automated tests exist and pass locally, but they are not currently enforced
by a GitHub Actions workflow. A broken frontend or migration can therefore be
committed without a required test gate.

### 6.7 Social safety is intentionally minimal

Friends and direct challenges exist, but blocking, reporting, moderation and
rate-limited unsolicited requests do not. Those controls are required before
public player discovery or random matchmaking is promoted.

### 6.8 Anonymous account lifecycle

Guest-first play is useful, and upgrading preserves identity, but repeated
visits and sign-outs create anonymous Auth users. There is no documented stale
anonymous-user cleanup policy.

### 6.9 Product analytics and operations

There is no documented product dashboard for completion rate, answer latency,
category retention, question failure rate, matchmaking health or RPC errors.
Growth decisions would otherwise rely on anecdote.

## 7. Product assessment

Trivia Rush already has the difficult part of a credible competitive trivia
product: trusted real-time gameplay. It is no longer merely a quiz page.

Its clearest differentiators are:

- short sessions with very little setup;
- speed and streak scoring rather than simple right/wrong totals;
- the same rules in solo and live duel play;
- guest-friendly solo onboarding;
- privacy-conscious live opponent progress;
- exact account-number identity that works without exposing email addresses.

The current weakness is not the game mechanic. It is the lack of a long-term
identity and mastery loop. Scores answer “How well did I do this run?” but the
product cannot yet answer “What kind of player am I?”, “What am I becoming
good at?” or “What should I do next?” Category progression is the right next
major feature because it answers all three without changing the core game.

Historically, QuizUp paired fast multiplayer with a very large topic catalog;
Sporcle demonstrates the retention value of collectible achievements; and
current quiz platforms continue to expand through multiple play formats. The
useful lesson is the combination of topic identity, competition and visible
long-term progress—not copying another product's branding or exact rules.

## 8. Recommended Phase 5 theme: Category Mastery

Phase 5 should be positioned as **Category Mastery and Player Identity**.

Each player would have an independent progression track for Science, History,
Geography, Entertainment, Sport, Technology and Gaming. Playing trusted
questions earns category XP. Reaching milestone levels unlocks permanent
category badges and titles. A player can showcase a selected title while a
profile presents their complete knowledge shape.

### 8.1 Separate four concepts

These should not be merged into one number:

| Concept | Meaning | Behaviour |
| --- | --- | --- |
| Category XP/level | Long-term participation and mastery | Never decreases |
| Competitive rating | Estimated head-to-head skill | Can rise or fall; later phase |
| Badge | Permanent collectible milestone or feat | Earned once |
| Title | Cosmetic identity text selected by the player | Unlocked, then equipped |

A high category level should mean “experienced in this category.” It should not
pretend to be a precise competitive skill rating. A later category-specific
rating can support fair matchmaking and seasonal ladders.

### 8.2 Recommended XP principles

The final values require product decisions and testing, but the system should:

- award XP only from server-accepted answers;
- derive the category and difficulty from the actual question record;
- award Mixed-game XP to each question's real category, never to a fake
  “Mixed level”;
- use the same XP rule in solo and duel play;
- never use browser-submitted totals;
- never award the same answer twice after a retry;
- avoid tying permanent XP directly to score, because score is strongly
  affected by speed, streak and selected duration;
- avoid a duel-win XP multiplier, because competitive outcome belongs in
  rating and leaderboard systems;
- treat a pass consistently and explicitly.

A reasonable starting model for testing is:

| Accepted result | Easy | Medium | Hard |
| --- | ---: | ---: | ---: |
| Correct | 10 XP | 15 XP | 25 XP |
| Incorrect | 0 XP | 0 XP | 0 XP |
| Pass | 0 XP | 0 XP | 0 XP |

This makes category level primarily evidence of correct knowledge rather than
speed-clicking. If zero XP on mistakes feels too punishing, a small completed-
game bonus is safer than awarding XP per incorrect answer.

### 8.3 Recommended level curve for testing

Keep thresholds data-driven so balancing does not require rewriting history.
A clear first curve is:

`XP needed for the next level = current level × 100`

That produces these cumulative thresholds:

| Level reached | Cumulative XP |
| ---: | ---: |
| 2 | 100 |
| 5 | 1,000 |
| 10 | 4,500 |
| 15 | 10,500 |
| 20 | 19,000 |
| 25 | 30,000 |
| 50 | 122,500 |

The curve provides quick early rewards and increasingly meaningful long-term
levels. Launching with rewards through level 25 would be enough; the schema can
support later tiers without imposing a hard cap.

### 8.4 Milestone rewards

Every five levels is a good visible rhythm:

- Level 5: first category badge and introductory title.
- Level 10: upgraded badge tier and specialist title.
- Level 15: advanced badge tier and expert title.
- Level 20: master badge tier and master title.
- Level 25: prestige badge tier and elite title.

Rather than commissioning dozens of unrelated illustrations, use a scalable
badge system: one icon and colour identity per category combined with shared
tier frames. Titles can carry more category personality. This keeps seven
categories visually distinct without creating an unmanageable art pipeline.

Examples are deliberately not final names:

- Science: Researcher, Scientist, Theorist.
- History: Archivist, Historian, Chronicler.
- Geography: Explorer, Cartographer, Pathfinder.
- Entertainment: Critic, Aficionado, Tastemaker.
- Sport: Contender, Analyst, Champion.
- Technology: Tinkerer, Engineer, Architect.
- Gaming: Player, Strategist, Game Master.

### 8.5 Player-facing surfaces

Phase 5 should add:

- category cards on the home/profile surface with level and XP progress;
- an end-of-game XP summary broken down by category;
- a level-up celebration that does not block the results screen;
- a badge cabinet;
- a title collection and one equipped title;
- a public-safe player profile showing selected title, badges, category levels
  and existing duel record;
- a compact category-mastery mark beside players in social and leaderboard
  views where useful.

A seven-segment “knowledge wheel” could become the most recognisable profile
visual: each segment represents one category and fills according to level.

## 9. Progression data design — conceptual, not yet approved

The minimum durable model is likely:

- `category_level_thresholds` — level and cumulative XP threshold.
- `player_category_progress` — one aggregate row per player/category.
- `progression_rewards` — data-driven badges and titles with milestone rules.
- `player_rewards` — immutable record of unlocked rewards.
- one equipped-title reference associated with the player's profile.

The progression aggregate should track enough trusted facts to render and
audit the system, such as XP, current level, correct answers, questions
answered and update time.

Awarding should happen inside the same transaction that accepts an answer, or
through a private trigger on the authoritative answer tables. The existing
unique answer constraints and request IDs must guarantee that a retry cannot
award XP twice. The frontend should only render the server result.

No second completed-game history table is needed. `game_sessions` remains the
canonical completed-game history, while progression tables are aggregates and
reward ownership.

### Historical backfill problem

This decision must be made explicitly:

- New authoritative answer rows can be assigned accurately by question
  category and difficulty.
- Older category-specific `game_sessions` can support an approximate legacy
  grant based on correct-answer totals, but not difficulty.
- Older Mixed sessions cannot be accurately divided among categories from
  their session summary alone.

Recommended policy:

1. Backfill exact post-Phase-4 authoritative answers where available.
2. Give a conservative, documented legacy grant for older single-category
   sessions.
3. Do not invent category allocations for old Mixed sessions.
4. Give existing permanent players a “Founding Player” badge so early support
   is recognised independently of imperfect historical attribution.
5. Make the backfill idempotent and record its progression version.

## 10. Recommended Phase 5 delivery order

### Phase 5.0 — Reproducible baseline

- Put the complete deployed Phase 4 source, SQL, question data and tests in
  GitHub.
- Replace the obsolete repository README.
- Add a GitHub Actions workflow for the existing `npm test` suite.
- Tag the verified production baseline.
- Document production/staging Supabase ownership and migration history.

Exit criterion: a fresh clone contains everything needed to audit and test the
deployed version.

### Phase 5.1 — Progression backend

- Decide XP scope, guest behaviour, backfill and visibility.
- Add additive progression, threshold and reward tables.
- Add server-owned, idempotent XP awarding for solo and duel answers.
- Add controlled progress/profile RPCs.
- Backfill according to the approved legacy policy.
- Add database tests for retries, concurrency, Mixed games and every milestone
  boundary.

Exit criterion: trusted answer activity updates exactly one correct category
track and unlocks every reward once.

### Phase 5.2 — Mastery and profile UI

- Split the frontend into native ES modules before adding several new screens.
- Add category progress cards.
- Add post-game XP breakdown and non-blocking level-up presentation.
- Add badge cabinet and title selector.
- Add public-safe player profiles.
- Add loading, empty and error states to every new surface.

Exit criterion: a player understands what XP was earned, what unlocked and what
to do next without inspecting a leaderboard.

### Phase 5.3 — Retention and content quality

- Add daily and weekly goals based on normal play.
- Add question reporting.
- Add internal question performance metrics.
- Expand the reviewed question bank.
- Add basic product and error observability.

Exit criterion: progression drives return play without sacrificing content
quality or operational visibility.

## 11. Recommended growth roadmap after Phase 5

### Highest-value next directions

1. **Random category matchmaking and category rating.** Attempt a live match
   first. At low concurrency, offer an asynchronous recorded challenge rather
   than leaving players in an empty queue.
2. **Daily challenge.** One shared, server-seeded run per day with a dedicated
   daily leaderboard gives every player a common conversation.
3. **Achievements beyond levels.** Examples: accuracy feats, streak feats,
   balanced play across all categories, comeback wins and friendly rivalries.
4. **Subcategories and topic packs.** Broad categories are good onboarding;
   deeper interests create the QuizUp-style identity layer.
5. **Seasonal ranked play.** Keep permanent levels, but reset competitive
   seasonal ratings and award cosmetic season rewards.
6. **Asynchronous challenges.** Let a friend complete the identical server-
   owned question set later. Keep this visibly separate from live duels.
7. **Question feedback and calibration.** Measure exposure, correct rate,
   skips, response time and reports to identify ambiguous or mislabelled items.
8. **Installable PWA and notifications.** Useful for direct challenge alerts,
   daily goals and returning to an active match.

### Valuable, but later

- Tournament brackets and scheduled events.
- Clubs or teams.
- Cosmetic avatars, profile frames and seasonal themes.
- Spectator mode with delayed/private-safe state.
- Localised question banks and languages.
- Creator tools for trusted editors.

### Features to delay deliberately

- **Open chat:** creates a moderation and safeguarding obligation immediately.
  Use predefined emotes first if match reactions are wanted.
- **Unreviewed user-generated questions:** content scale is attractive, but
  sourcing, duplication, abuse and answer disputes need a real moderation
  workflow.
- **Paid competitive power-ups:** they would undermine the trusted scoring
  foundation. If casual power-ups are ever added, isolate them from ranked
  modes and leaderboards.
- **Too many game modes at once:** deepen the core loop and population before
  splitting players across queues.

## 12. Phase 5 decisions that must not be guessed

Before schema or interface design begins, the owner should decide:

1. Do both solo and duel answers earn the same category XP?
2. Can anonymous guests earn and retain category levels before upgrading?
3. Should old activity receive the recommended partial backfill, or should all
   levels begin at zero on the Phase 5 launch date?
4. Does a player equip one global title, or one title per category/mode?
5. Are category levels public by default, private, or controlled by a profile
   visibility setting?
6. Should progression launch with rewards through level 25, level 50 or no
   visible cap?
7. Should incorrect answers give zero XP, a token participation amount, or
   contribute only through a completed-game bonus?
8. Should the first Phase 5 profile be viewable only from friends/history, or
   should exact account-number lookup open it too?
9. Is the priority after progression random matchmaking, daily challenges or
   deeper question categories?

## 13. Recommended engineering rules for Phase 5

1. Progression is awarded only by server-authoritative answer acceptance.
2. Retries and concurrency must never duplicate XP or rewards.
3. Mixed sessions credit the actual question category.
4. Levels, badges and titles are data-driven rather than hard-coded across the
   frontend and SQL.
5. Category XP is permanent progression; skill rating is a separate future
   system.
6. `game_sessions` remains the only canonical completed-game history.
7. `player_stats` remains trigger-owned and solo-only unless a deliberate
   versioned migration changes its definition.
8. Browser roles do not receive direct write privileges on progression tables.
9. Every migration is additive, checked and independently verifiable before
   any cleanup.
10. Every new public screen has loading, empty, error and mobile states.
11. Public profile RPCs return an explicit safe projection, never internal
    answer or account data.
12. The existing test suite becomes a required CI gate before Phase 5 grows the
    codebase.

## 14. Overall recommendation

Proceed with category progression as Phase 5, but begin with repository
reproducibility and frontend modularisation. The progression system should
reward trusted correct answers, allocate Mixed play by real question category,
unlock scalable badge/title tiers every five levels and remain distinct from a
future competitive rating.

The most credible path toward a modern QuizUp-style product is:

**trusted fast play → visible category identity → deeper content → reliable
matchmaking → seasons and events.**

Trivia Rush has completed the first part. Phase 5 should make the second part
feel unmistakably its own.
