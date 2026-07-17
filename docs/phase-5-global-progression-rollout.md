# Global XP progression foundation rollout

**Code status:** prepared for review  
**Production status:** not deployed until the SQL steps below are completed  
**Gameplay status:** foundation only; games do not award XP until the later solo and multiplayer integration checkpoints

## What this checkpoint adds

- Global level thresholds from level 1 through level 50.
- A trusted per-player global XP aggregate.
- An immutable per-session XP award ledger.
- Server-owned helpers for base XP, speed, streak, score and result multipliers.
- A 150% per-game XP cap.
- An idempotent private award writer for later game-finalisation integration.
- `get_my_global_progression()` for the signed-in player's safe progression view.

## Approved calculation

### Per correct answer

| Difficulty | Base XP |
| --- | ---: |
| Easy | 10 |
| Medium | 15 |
| Hard | 25 |

Incorrect answers and passes award zero XP.

Speed multiplier:

| Response time | Multiplier |
| --- | ---: |
| Up to 1.5 seconds | 1.25 |
| Up to 3 seconds | 1.15 |
| Up to 5 seconds | 1.05 |
| Over 5 seconds | 1.00 |

Streak multiplier:

| Current streak | Multiplier |
| --- | ---: |
| 1–2 | 1.00 |
| 3–4 | 1.05 |
| 5–9 | 1.10 |
| 10+ | 1.15 |

Each correct answer is rounded once after applying speed and streak.

### Completed game

Score efficiency is the final score divided by the maximum possible score for
the number of answered questions.

| Score efficiency | Multiplier |
| --- | ---: |
| Below 50% | 1.00 |
| 50–69% | 1.03 |
| 70–84% | 1.06 |
| 85%+ | 1.10 |

Multiplayer result multiplier:

| Result | Multiplier |
| --- | ---: |
| Score win | 1.10 |
| Forfeit win | 1.05 |
| Draw | 1.05 |
| Loss or forfeit loss | 1.00 |
| Solo | 1.00 |

Final XP is capped at 150% of the unmodified difficulty-based base XP.

## Level curve

The XP cost from level `L` to `L + 1` is:

```text
L × 100 XP
```

The cumulative threshold for level `L` is:

```text
50 × (L - 1) × L
```

The first seed includes levels 1–50.

## Deployment order

### 1. Run the foundation migration

In Supabase SQL Editor, run the complete contents of:

```text
supabase/sql/phase-5-global-progression-foundation.sql
```

This is additive. It does not alter current scoring, game completion or the
frontend.

### 2. Run read-only verification

In a new SQL Editor query, run:

```text
supabase/sql/phase-5-global-progression-verification.sql
```

Confirm:

- `verification_status = PASS`;
- all three progression tables report `rls_enabled = true`;
- the browser table-privilege query returns no rows;
- `authenticated` can call `get_my_global_progression`;
- browser roles cannot call the private award writer;
- the base XP and multiplier examples match the approved tables;
- the capped game example reports 300 XP;
- level 25 reports 30,000 cumulative XP and level 50 reports 122,500.

### 3. Do not expect XP to change yet

This checkpoint deliberately does not modify:

- `submit_solo_answer`;
- `finish_solo_game`;
- live-duel finalisation;
- turn-based finalisation;
- the frontend.

The next checkpoint will connect authoritative solo answers and completed solo
sessions to the private award writer. Multiplayer integration follows after
solo is verified.
