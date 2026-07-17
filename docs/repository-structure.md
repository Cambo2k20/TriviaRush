# Repository structure

The root is reserved for files that directly run or configure the web application.

## Directories

- `data/` — controlled trivia source registry and category question records.
- `docs/` — product designs, architecture notes and deployment guides.
- `icons/` — PWA icons.
- `scripts/` — generators and automated verification.
- `supabase/functions/` — deployable Edge Functions.
- `supabase/sql/` — all database migrations, verification queries and rollback scripts.

## Rules

1. New database scripts go in `supabase/sql/`, not the repository root.
2. Keep historical phase names in SQL filenames so rollout documentation remains traceable.
3. Keep GitHub Pages entry files (`index.html`, `app.js`, `styles.css`, `sw.js` and `manifest.webmanifest`) at the root.
4. Development branches should be deleted after their pull request is merged.
5. Database files are never executed merely by committing or moving them in GitHub.
