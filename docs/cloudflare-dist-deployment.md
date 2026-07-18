# Cloudflare `dist/` deployment

Trivia Rush builds an allowlisted static distribution before Wrangler deploys it.

## Repository commands

```bash
npm run build:cloudflare
npm run test:cloudflare
```

The build recreates `dist/` from explicit production entrypoints, referenced local assets, and the allowlisted `icons/` and `vendor/` directories. Generated output is ignored by Git.

## Cloudflare build settings

After this change is merged into `main`, configure Cloudflare Builds as follows:

```text
Build command:   npm run build:cloudflare
Deploy command:  npx wrangler deploy
Version command: npx wrangler versions upload
Root directory:  /
```

Do not switch the Cloudflare build command before the merge because the current production branch does not yet contain `build:cloudflare`.

## Deployment boundary

`wrangler.jsonc` serves only `./dist`. The verification test rejects development and private repository content, including Git metadata, dependencies, scripts, tests, documentation, Supabase SQL, package metadata, Wrangler files, and environment files.
