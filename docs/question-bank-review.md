# Question bank review record

**Review date:** 2026-07-18
**Scope:** 1,400 active questions across 14 categories
**Outcome:** automated blockers cleared; stable live keys preserved

## Checks completed

- exact and normalised prompt uniqueness;
- semantic same-answer candidates and inverse fact pairs;
- category scope and dedicated-franchise overlap screening;
- ambiguity and sensitivity term screening;
- source-key existence, HTTPS URL format and broad-URL reporting;
- 40/40/20 difficulty totals for every category;
- frozen hashes for all 400 underscore-style live keys;
- clean schema replay and sanitized seed verification.

The ambiguity and sensitivity lists emitted by `npm run test:content` are
review aids, not assertions that a question is defective. The screening is
deliberately broad so terms such as "first", "god" or "battle" stay visible to
editors. Blocking duplicate and inverse-pair findings fail the command.

## Source review

Every record resolves to a named HTTPS source in `data/questions.json`. Direct
fact or collection URLs are preferred. The audit continues to report homepage
sources because the original banks grouped many facts under institutional or
franchise registries. Those reports are retained as visible legacy source debt;
they must not be copied as the pattern for new questions.

When any legacy question is corrected, its source must be narrowed to the
official article, episode guide, book catalogue entry, governing rule or
editorially controlled reference that supports that individual fact. Fan wikis
remain review leads only when an official or controlled source is unavailable.

## Content corrections

| Key | Disposition |
| --- | --- |
| `got_001` | Preserved key; rewrote the prompt to remove stacked qualifiers |
| `entertainment-108` | Preserved key; replaced an MCU-overlap fact with a directly sourced Entertainment fact |
| Harry Potter duplicate | Preserved the stronger question and retired the duplicate tested fact |
| Iron Man inverse pair | Removed one direction of the duplicated relationship |

## Reproduction

```powershell
npm.cmd run test:questions
npm.cmd run test:content
npm.cmd run test:baseline
```

`test:baseline` must report 14 categories, 1,400 questions, 400 legacy keys and
zero users, sessions or progression rows.
