# Cloudflare distribution output

This directory is reserved for the allowlisted static files deployed to Cloudflare.

The production Worker still serves assets from the repository root until the build script and `wrangler.jsonc` are updated together. Do not point Cloudflare at `./dist` until that build step exists and has been verified.
