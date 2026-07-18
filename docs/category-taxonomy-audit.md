# Phase 5 Category Taxonomy Audit

**Status:** 14-category contract; four live-only banks under repository review
**Invariant:** a moved question keeps its existing `question_key`

## Category boundaries

| Category | Includes | Excludes |
| --- | --- | --- |
| Science | Physics, chemistry, astronomy, human biology, cellular biology and Earth science | General animal facts, ecosystems and natural-history identification |
| Nature & Animals | Zoology, botany, habitats, ecology, species traits and natural-history facts | Fictional animals and technical cellular biology |
| Entertainment | Film, television, music, theatre and popular screen characters | Novels, poetry, authors and visual art |
| Art & Literature | Painting, sculpture, architecture as art, novels, poetry, plays and authors | Film adaptations and music performance |
| Food & Drink | Ingredients, cuisines, cooking methods, food science in culinary context and non-alcoholic or alcoholic drinks | Pure chemistry questions that merely mention an edible compound |
| Game of Thrones (`game_of_thrones`) | Facts specific to the HBO series and its A Song of Ice and Fire setting, characters, houses, locations and events | General television craft, unrelated fantasy, and author facts that test literature rather than the franchise |
| Mythology (`mythology`) | Named myths, deities, heroes, creatures and traditions from documented world cultures | Modern fictional universes, unsupported folklore claims and questions that flatten disputed traditions into a single universal account |
| Harry Potter (`harry_potter`) | Facts specific to the seven core novels and their authorised screen adaptations, characters, places, objects and events | General author biography, unrelated Wizarding World franchises, and literary facts already tested by Art & Literature |
| Marvel Cinematic Universe (`marvel_cinematic_universe`) | On-screen MCU films and series, their characters, events, locations and production facts | Marvel comics continuity, non-MCU adaptations and generic film questions that do not test MCU knowledge |

Ambiguous questions follow what they actually test and the authority used to
verify them. For example, a question about the yellow brick road sourced to a
film authority stays in Entertainment; a question asking who wrote a novel
moves to Art & Literature.

Franchise categories take precedence when the tested fact requires knowledge of
that franchise's continuity. General creator, publisher, studio and adaptation
questions remain in Art & Literature or Entertainment unless the franchise
context is essential. The same tested fact must not appear in both a franchise
bank and a general bank, including inverse question/answer pairs.

## Difficulty contract

The manifest is authoritative. Its `default_target` is 40 Easy, 40 Medium and
20 Hard for new categories. The four preserved live banks explicitly retain
their current 35 Easy, 45 Medium and 20 Hard targets during review. Changing a
category target requires a reviewed manifest change; verification must never
hard-code one distribution for every category.

## Stable key contract

New keys use `<category_id>-<three-or-more-digit-number>`. The 400 deployed
`got_001`-`got_100`, `myth_001`-`myth_100`, `hp_001`-`hp_100` and
`mcu_001`-`mcu_100` keys are valid legacy IDs and must not be renamed or reused.
Their bounded ranges are declared in `data/questions.json`; new questions in
those categories use the canonical hyphen convention.

## Existing-question moves

The audit moves 30 of the 700 existing questions while preserving every key.

### Entertainment → Art & Literature (29)

- Easy: `entertainment-006`, `007`, `009`–`020` (14)
- Medium: `entertainment-041`–`050` (10)
- Hard: `entertainment-081`–`085` (5)

### Science → Nature & Animals (1)

- Easy: `science-039`

No existing record is moved into Food & Drink. The table-salt question remains
Science because it tests the chemical name of sodium chloride, not cuisine.

## Replenishment calculation

Every active category must ship with exactly 40 Easy, 40 Medium and 20 Hard
questions. The final ten-category bank therefore contains 1,000 questions.

| Destination | Existing after moves | New Easy | New Medium | New Hard | Final |
| --- | ---: | ---: | ---: | ---: | ---: |
| Science | 99 | 1 | 0 | 0 | 100 |
| Entertainment | 71 | 14 | 10 | 5 | 100 |
| Food & Drink | 0 | 40 | 40 | 20 | 100 |
| Nature & Animals | 1 | 39 | 40 | 20 | 100 |
| Art & Literature | 29 | 26 | 30 | 15 | 100 |
| Other five categories | 500 | 0 | 0 | 0 | 500 |
| **Total** | **700** | **120** | **120** | **60** | **1,000** |

The exact addition is 300 independently written and sourced questions. New
category manifest entries remain `planned` until the complete 1,000-question
bank passes the compiler and database tests.

## Activation gate

The new categories must not be inserted into production until:

1. all five affected category files meet their exact difficulty targets;
2. every new question has an authoritative source key;
3. normalised prompt, answer and stable-key audits pass;
4. the generated SQL upserts all moved keys rather than inserting replacements;
5. the category migration and 1,000-question seed run in one documented rollout;
6. solo and duel tests prove the same server-authoritative behaviour across all
   ten categories.
