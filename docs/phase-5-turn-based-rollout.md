# Phase 5 turn-based challenges and notifications

This checkpoint adds asynchronous 1v1 play without creating a second game
history. Both players receive the same questions in the same order, each gets
their own server-owned 30, 60 or 90 second clock, and the target score remains
hidden until both rounds finish.

## Product rules

- Permanent accounts only; friendship is optional.
- The challenger plays first.
- The invited player has 72 hours from the end of the challenger's round to
  start.
- A started round cannot be paused. Reopening the site reconnects to the same
  server deadline.
- Passes count as incorrect.
- Correct answers use the established speed and streak scoring formula.
- Equal scores are a draw.
- Declined, cancelled and expired challenges do not award a win/loss and do
  not create multiplayer leaderboard sessions.
- A player may have at most five outgoing unresolved turn-based challenges and
  only one unresolved challenge with the same opponent.
- Multiplayer history and rankings can be filtered by All, Live or Turn-based.

## Safe deployment order

### 1. Deploy the additive database migration

In Supabase SQL Editor, run the complete contents of:

```text
supabase/sql/phase-5-turn-based-challenges.sql
```

The deployed Phase 4 frontend remains compatible while this runs. The
migration extends `duel_matches` and `duel_players`, reuses
`duel_match_questions` and `duel_answers`, and continues to create exactly two
canonical `game_sessions` rows only when a challenge is resolved.

### 2. Run production verification

Run:

```text
supabase/sql/phase-5-turn-based-verification.sql
```

The first result must report `verification_status = PASS`. In particular:

- `leaked_turn_progress_rows` is zero;
- `completed_matches_without_two_sessions` is zero;
- `players_over_outgoing_limit` is zero;
- `duplicate_open_pairs` is zero;
- `browser_private_table_privileges` and `browser_write_privileges` are zero;
- `private_realtime_tables` is zero;
- `notification_realtime_entries` is one.

The privilege result must show:

- `authenticated` can create a turn challenge but cannot claim deliveries;
- `anon` cannot do either;
- only `service_role` can claim or complete notification deliveries.

### 3. Configure and deploy phone push

Push uses standard Web Push and VAPID. Never commit the generated private key.

From a trusted terminal or GitHub Codespace:

```bash
npm run generate:vapid
```

Copy the two generated values into Supabase Edge Function secrets:

```text
VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
```

Add these secrets too:

```text
VAPID_SUBJECT=mailto:YOUR_ACCOUNT_EMAIL
SITE_URL=https://cambo2k20.github.io/TriviaRush/
NOTIFICATION_DISPATCH_SECRET=A_LONG_RANDOM_SECRET
```

Then deploy the function:

```bash
npx supabase login
npx supabase link --project-ref kgdnuzasbeavpqharbpf
npx supabase functions deploy dispatch-notifications --no-verify-jwt
```

#### iPhone-friendly GitHub Actions option

The repository also includes **Actions → Deploy notification function** so the
private VAPID key never has to be displayed or copied on the phone.

Before running it, add these GitHub repository Actions secrets:

```text
SUPABASE_ACCESS_TOKEN
NOTIFICATION_DISPATCH_SECRET
```

Run the workflow with **initialise_vapid** enabled only the first time and enter
the contact email. Later deployments must leave it disabled; generating a new
VAPID pair would invalidate existing device subscriptions.

`verify_jwt` is intentionally disabled at the platform gateway because the
function supports both user-triggered immediate dispatch and scheduled
service-to-service dispatch. The function itself validates either a real
Supabase user token or `NOTIFICATION_DISPATCH_SECRET`; it never accepts a
notification payload from the caller.

### 4. Schedule reliable delivery and reminders

In Supabase Dashboard open **Integrations → Cron → Create job**.

Configure an HTTP POST once per minute to:

```text
https://kgdnuzasbeavpqharbpf.supabase.co/functions/v1/dispatch-notifications
```

Include headers:

```text
Content-Type: application/json
x-dispatch-secret: THE_SAME_NOTIFICATION_DISPATCH_SECRET
```

Use an empty JSON body:

```json
{}
```

The browser also requests immediate dispatch after creating an invitation or
result. Cron provides the offline guarantee, retries, 24-hour expiry reminders
and cleanup when neither player has the site open.

### 5. Optional verified-email fallback

Email delivery is off by default. To offer it, configure a verified sender in
Resend and add:

```text
RESEND_API_KEY
NOTIFICATION_FROM_EMAIL=Trivia Rush <notifications@YOUR_VERIFIED_DOMAIN>
```

Only players who explicitly enable Email fallback receive email. The worker
looks up the permanent account's verified Supabase email; email addresses are
never copied into public profile or notification tables.

### 6. Deploy the frontend and PWA files together

Deploy all repository files from the merged commit, including:

```text
index.html
app.js
styles.css
manifest.webmanifest
sw.js
icons/trivia-rush-192.png
icons/trivia-rush-512.png
```

The HTML version query strings are already advanced so GitHub Pages visitors
receive the new JavaScript and CSS.

## Two-account production test

1. Use two different permanent Trivia Rush accounts.
2. On the invited account, open Notifications and enable Phone push.
3. On iPhone or iPad, first add Trivia Rush to the Home Screen, open that Home
   Screen app and enable push from there.
4. On the challenger account, choose Turn-based, an exact opponent account
   number, category and duration.
5. Complete the challenger's round and close the invited player's app.
6. Confirm an in-app item and phone push arrive without revealing a score.
7. Open the notification and confirm it deep-links to the correct challenge.
8. Confirm the challenger score and progress remain hidden before Start and
   throughout the invited player's round.
9. Confirm the invited player receives the same first questions in the same
   order.
10. Complete the second round and confirm both scores and the winner/draw are
    revealed.
11. Confirm one history row labelled Turn-based appears for both players.
12. Confirm exactly two `game_sessions` rows share the challenge's
    `duel_match_id`.
13. Confirm the All and Turn-based multiplayer rankings include the result and
    the Live filter does not.
14. Create another challenge, decline it, and confirm it appears as Declined
    activity without changing win/loss records.

## Notification privacy and failure behaviour

- In-app notification rows are readable only by their recipient.
- Push subscriptions, encryption keys, email delivery state and errors are not
  browser-readable.
- Lock-screen and email content contains no answer correctness or scores.
- Invalid push endpoints are disabled after a permanent 404/410 response.
- Temporary delivery failures retry with bounded exponential backoff.
- A notification has a deduplication key, so polling or retries cannot send a
  second competitive event.
