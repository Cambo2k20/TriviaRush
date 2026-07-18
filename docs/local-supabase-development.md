# Local Supabase development

The repository contains a schema-only baseline and a sanitized content seed so
the category system can be rebuilt without copying production users, sessions,
gameplay history or progression.

## Prerequisites

- A Docker-compatible runtime running locally.
- The Supabase CLI, invoked as `npx supabase` when it is not installed globally.

The local stack is for development only. Do not expose its ports to the public
internet.

## Rebuild locally

```powershell
npx supabase start
npx supabase db reset
npm run test:baseline
```

The reset applies `supabase/migrations/` in order and then runs
`supabase/seed.sql`. The seed contains only game-mode and level reference rows,
the 14 category rows, and the 1,400-question bank.

Regenerate question SQL and the local seed after editing the manifest or a
category JSON file:

```powershell
npm run build:questions
```

## Production guardrail

The baseline was catalogued read-only from project `kgdnuzasbeavpqharbpf` on
2026-07-18 because the older schema predates an ordered migration history.
Five earlier no-op files mirror versions already recorded by the remote; their
resulting objects are contained in the later schema baseline.
Before the first future `supabase db push`, authenticate the CLI, run
`supabase db pull`, review the diff, and reconcile or mark this baseline as
already applied. Never run `supabase db reset --linked` against production.
