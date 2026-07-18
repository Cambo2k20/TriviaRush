# Trivia Rush Question Intake and Expansion Policy

**Applies from:** Phase 5  
**Current bank:** 1,400 questions across 14 active categories
**Approved taxonomy:** ten general categories and four category-specific banks
under repository and source review

## 1. Objective

Progression will increase focused repeat play. Trivia Rush therefore needs a
larger, well-maintained question bank without sacrificing accuracy, source
quality, answer privacy or the manifest-defined difficulty contract.

The next content milestone should be a reviewed expansion, not a bulk scrape.

## 2. External collections are candidate indexes, not source authorities

Pages such as Brightful's general trivia collection can identify interesting
facts and topic gaps. They are not automatically acceptable as Trivia Rush
question records.

The reviewed Brightful page:

- is labelled as a Summer 2023 collection;
- includes broad categories relevant to Trivia Rush;
- contains repeated questions;
- mixes true/false, open-answer and incomplete multiple-choice entries;
- contains typos and malformed lines;
- includes time-sensitive claims;
- contains folklore, novelty-law and other claims requiring stronger evidence;
- does not provide a primary citation for each individual fact.

Therefore:

- do not copy its wording in bulk;
- do not treat its answer as verified merely because it appears on the page;
- use a promising fact only as a candidate topic;
- independently verify the fact against an authoritative source;
- write a new Trivia Rush question and two plausible distractors;
- store the authoritative verification URL, not the candidate-list URL, as
  the question source.

## 3. Required record format

Each source JSON category record uses:

```json
[
  "stable-question-key",
  "difficulty",
  "Independently written question text?",
  "Correct answer",
  "Plausible distractor one",
  "Plausible distractor two",
  "source_key"
]
```

The registry in `data/questions.json` is also the category manifest and maps
`source_key` to a source name and HTTPS URL. Question keys are written once and
never derived from their current category or array position. This allows a
taxonomy cleanup to move a question without breaking historical references or
progression backfill. The build script validates the key, record, manifest,
difficulty targets and correct-answer position balance.

## 4. Intake workflow

1. **Capture a fact idea.** Record only a short topic note and candidate URL.
2. **Choose the controlled category.** Science, History, Geography,
   Entertainment, Sport, Technology, Gaming, Food & Drink, Nature & Animals,
   or Art & Literature.
3. **Find an authoritative source.** Prefer official institutions, primary
   documentation, museums, libraries, governing bodies and original records.
4. **Check stability.** Reject or date-bound facts likely to change.
5. **Write independently.** Do not retain distinctive wording from a candidate
   collection.
6. **Create two plausible distractors.** Same semantic type, no trick wording.
7. **Assign difficulty.** Use the rubric below.
8. **Run duplicate checks.** Exact, normalised and semantic/topic review.
9. **Peer review.** Confirm wording, source support, answer and distractors.
10. **Build and test.** Regenerate the idempotent seed and run `npm test`.

## 5. Source hierarchy

Preferred order:

1. Official government, standards body, sports governing body or product
   documentation.
2. Museum, national library, university or recognised research institution.
3. Original publisher, developer, studio, league or creator page.
4. High-quality reference work when primary material is unsuitable.

For franchise content, acceptable primary sources include the official
publisher's book catalogue, the creator's official companion material, the
studio or network's series and episode guides, and the franchise owner's
official character or film pages. A reputable secondary reference may be used
when primary material is unavailable, but the URL must identify the supporting
article or entry rather than only the site's homepage. Fan wikis are legacy
review leads, not approved final sources when an official or editorially
controlled source can support the fact.

Avoid as the stored verification source:

- scraped trivia lists;
- unsourced listicles;
- social-media posts;
- fan wikis when an official source exists;
- search-result snippets;
- AI-generated citations;
- pages that merely repeat the candidate claim.

## 6. Difficulty rubric

### Easy

- broadly taught or culturally prominent;
- recognisable without specialist knowledge;
- distractors are clearly distinguishable to a general player.

### Medium

- requires regular interest in the category;
- may involve a less famous person, term, date or detail;
- distractors are plausible to a casual player.

### Hard

- specialist, technical or fine-grained knowledge;
- still answerable from a clear, authoritative fact;
- not hard merely because wording is obscure or misleading.

Each completed category batch keeps the established target:

- 40% Easy;
- 40% Medium;
- 20% Hard.

## 7. Writing rules

- One unambiguous fact per question.
- Between 10 and 240 trimmed characters.
- Exactly three concise, unique answer choices.
- All choices use the same grammatical and semantic form.
- Do not reveal the answer through length, grammar or repeated wording.
- Avoid “all of the above” and “none of the above”.
- Avoid true/false; convert the fact into three-answer multiple choice.
- Include a date or edition when a fact can change.
- Use neutral international wording where possible.
- Avoid disputed claims unless the question explicitly names the authority.
- Avoid sensitive tragedy as casual novelty trivia.
- Do not quote song lyrics, film dialogue or long literary text.
- Do not use a trademark merely to make a generic question harder.

## 8. Reject or repair examples

Reject without strong verification:

- strange-law lists;
- “on average” claims with no methodology;
- superlatives that change over time;
- folklore presented as fact;
- claims about animal anatomy stated too broadly;
- product, sports or political facts without a date.

Repairable candidate patterns:

- Open answer → add two same-type plausible distractors.
- True/false → ask which of three statements/names/places is correct.
- Misspelling → independently rewrite and verify.
- Duplicated fact → keep the strongest version only.
- Time-sensitive fact → add a clear reference year or reject.

## 9. Duplicate control

The build rejects normalised duplicate question text and audits answer/question
inverse pairs. Expansion also needs topic-level review because differently
worded questions can test the same fact.

For each candidate, compare:

- subject entity;
- tested property;
- correct answer;
- existing category records.

Do not add two questions that merely reverse the same relationship, for
example asking both “Who created X?” and “What did Y create?” in the same
bank unless they test materially different knowledge.

## 10. Current taxonomy and expansion

Freeze these stable database IDs before progression backfill:

| ID | Label | Phase 5 target |
| --- | --- | ---: |
| `science` | Science | 100 |
| `history` | History | 100 |
| `geography` | Geography | 100 |
| `entertainment` | Entertainment | 100 |
| `sport` | Sport | 100 |
| `technology` | Technology | 100 |
| `gaming` | Gaming | 100 |
| `food_drink` | Food & Drink | 100 |
| `nature_animals` | Nature & Animals | 100 |
| `art_literature` | Art & Literature | 100 |
| `game_of_thrones` | Game of Thrones | 100 |
| `mythology` | Mythology | 100 |
| `harry_potter` | Harry Potter | 100 |
| `marvel_cinematic_universe` | Marvel Cinematic Universe | 100 |
| **Total** |  | **1,400** |

The original ten-category expansion preserved moved keys and restored every
category to 100 questions. The four later live banks also contain 100 questions
each. Their 400 deployed underscore keys are frozen while their taxonomy,
sources and automated coverage are brought under this same contract.

The manifest's default distribution is 40 Easy, 40 Medium and 20 Hard. A
category-specific target is allowed only when recorded in the manifest and
explained in the taxonomy contract. Verification derives both totals and
difficulty counts from that manifest.

All 14 manifest entries describe currently active production categories.
Subsequent batches should move each category toward 300–500
active questions, informed by real play and report data.

## 11. Content audit requirements

The expansion cannot ship unless automated and manual review confirm:

- exact target count per category and difficulty;
- three unique non-empty answers;
- balanced correct-answer positions;
- unique stable keys and normalised text;
- no duplicated tested facts in the review sheet;
- one valid authoritative source key per record;
- source URLs use HTTPS and resolve;
- no browser-readable answer keys;
- no regressions in solo or duel database tests.

## 12. Question lifecycle after launch

Phase 5 should prepare, and a later content-operations phase should implement:

- player “Report question” action;
- reason codes: incorrect answer, ambiguous wording, outdated, duplicate,
  typo/grammar, other;
- exposure count;
- correct/incorrect/pass rate;
- median response time;
- review status and reviewer notes;
- safe question retirement through `is_active = false`;
- versioned corrections without altering historical XP already awarded.

Question performance data is an editorial signal, not proof that a difficult
question is wrong.

## 13. Copyright and attribution rule

Facts themselves can be researched and tested, but a collection's selection
and wording should not be bulk-copied. Trivia Rush questions must be written
independently, and every accepted answer must be supported by the stored
verification source.

Candidate-list URLs may be kept in a private editorial note for provenance, but
they do not replace the authoritative `source_url` shipped with the record.
