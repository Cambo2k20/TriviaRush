# Trivia Rush category taxonomy contract

**Reviewed:** 2026-07-18
**Contract:** 14 active categories, 100 questions per category
**Difficulty target:** 40 Easy, 40 Medium and 20 Hard per category

## Stable identifiers

Category and question identifiers are historical database keys. They are never
renamed to make source files look more uniform. The 400 underscore-style keys
in the four franchise banks are valid legacy IDs and are protected by frozen
key hashes in `data/questions.json`.

New question keys use `<category-id>-<three-digit-sequence>`. This convention
applies only to new records; it does not migrate or invalidate existing keys.

## Controlled categories

| ID | Label | Included scope | Key exclusions |
| --- | --- | --- | --- |
| `science` | Science | Physics, chemistry, biology, astronomy and earth science | Product engineering and computing belong in Technology |
| `history` | History | Documented people, periods, events and civilisations | Fictional chronology and undated current affairs |
| `geography` | Geography | Countries, capitals, landforms, maps and population geography | Travel recommendations and unstable rankings |
| `entertainment` | Entertainment | Film, television, music, theatre and general popular culture | Dedicated Game of Thrones, Harry Potter and MCU facts |
| `sport` | Sport | Rules, competitions, athletes and governing bodies | Video games and fictional sports |
| `technology` | Technology | Computing, standards, devices, software and engineering history | General scientific principles without a technology focus |
| `gaming` | Gaming | Video games, platforms, developers and gaming history | Tabletop-only facts and screen adaptations without a game focus |
| `food_drink` | Food & Drink | Ingredients, dishes, techniques and culinary heritage | Health claims and unstable commercial rankings |
| `nature_animals` | Nature & Animals | Species, habitats, ecology and plants | Human anatomy and laboratory science |
| `art_literature` | Art & Literature | Visual art, artists, books, authors and literary forms | Screen-only adaptations and dedicated franchise lore |
| `game_of_thrones` | Game of Thrones | HBO series characters, places, houses, events and production | Unadapted book-only lore unless the question names the books |
| `mythology` | Mythology | Named mythic traditions, figures, stories and symbols | Claims presented as religious truth or modern franchise versions |
| `harry_potter` | Harry Potter | The seven novels and their official screen adaptations | Fan theories and unrelated Wizarding World properties unless named |
| `marvel_cinematic_universe` | Marvel Cinematic Universe | MCU films and series, characters, events and production | Comics-only continuity and non-MCU Marvel adaptations |

## Overlap rules

1. A dedicated category wins when the tested fact depends on its canon. An Iron
   Man identity question belongs in MCU, not Entertainment.
2. General categories retain facts about the medium or creator when the answer
   does not require franchise lore. A question about an Academy Award ceremony
   remains Entertainment even if a franchise film was nominated.
3. Mythology retains historical mythic figures. MCU versions of Thor, Loki or
   Asgard belong in MCU when the prompt names that continuity.
4. Art & Literature retains author, genre and publication facts. Harry Potter
   plot, character and adaptation facts belong in Harry Potter.
5. Game of Thrones prompts must distinguish the television series from the
   source novels whenever their facts differ.

## Review result

The compiler and content audit cover all 1,400 records. They enforce stable
keys, exact category and difficulty totals, unique choices, source-key
resolution, normalised duplicate detection, semantic duplicate candidates,
inverse-pair detection and dedicated-category overlap screening.

The 2026-07-18 review preserved all live keys and repaired the actionable
findings:

- `got_001` was rewritten to remove competing "most" and "primarily"
  qualifiers while retaining its answer and key.
- `entertainment-108` no longer tests an MCU identity in Entertainment; the key
  now tests a directly sourced Academy Awards fact.
- one duplicate Harry Potter authorship fact and one Iron Man inverse pair were
  removed in the preceding normalization change.

Term-based ambiguity and sensitivity matches remain visible in the audit as
screening information. They are not failures by themselves: words such as
"first", "war", "god" and "battle" can be necessary, precise parts of history
or mythology questions. Any semantic duplicate, inverse pair, broken frozen
hash or unresolved overlap remains a blocking failure.
