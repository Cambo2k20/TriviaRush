# Play with friends implementation audit

This audit records the existing frontend and Supabase contracts that the tabbed redesign must preserve.

## Authentication and access

- The application restores an existing Supabase session or creates an anonymous session with `signInAnonymously()`.
- A player profile is loaded from `public.profiles` by authenticated user ID.
- Multiplayer access remains restricted to a non-anonymous user with a loaded profile.
- The existing `duelAccountGate` and `openAccountForDuelButton` remain the source of truth for permanent-account prompting.
- Authentication state is refreshed through `supabase.auth.onAuthStateChange` for sign-in, sign-out, password recovery, user updates and token refreshes.

## Social data reads

The existing social refresh performs the following RPC calls in parallel:

1. `get_social_dashboard()`
2. `get_duel_invitations()`
3. `get_turn_challenges(p_limit => 30)`
4. `get_duel_match_history_v2(p_opponent_account_number, p_match_format => 'all', p_limit => 30)`
5. `get_duel_leaderboard_v2(p_match_format, p_limit => 20)`
6. `get_notifications(p_limit => 30)`
7. `get_notification_preferences()`

The redesign observes and caches these existing successful responses for presentation. Switching between Play, Friends and History does not issue duplicate RPC requests.

## Existing mutations and actions

The original handlers remain responsible for all writes and validation:

- `send_friend_request`
- `respond_friend_request`
- `remove_friend`
- `create_duel`
- `create_turn_challenge`
- `join_duel`
- `start_turn_challenge`
- `decline_turn_challenge`
- `cancel_turn_challenge`
- notification read-state updates
- notification preference updates
- push-subscription registration and removal

Visible redesigned controls either retain the original DOM control or proxy its existing click handler. The redesign does not reproduce mutation logic or change request payloads.

## Duel state and realtime behaviour

The existing application state remains authoritative for:

- active duel ID, room code and match format
- current duel state and current question
- answer locking and server-time offset
- duel polling timer and animation frame
- pending realtime refresh state
- rematch configuration
- active turn-based challenge state

Live duel updates continue to use the existing Supabase realtime subscriptions for:

- `public.duel_matches`
- `public.duel_live_progress`

The existing one-second duel polling fallback remains unchanged.

## Notification realtime behaviour

Notification delivery continues to use the existing filtered Supabase realtime subscription on `public.notifications` for the authenticated recipient. The notification list and settings controls are moved into a focused dialog without replacing their handlers or data source.

## UI relocation map

- Create-duel settings move into the Create game dialog.
- Join-room controls remain on the Play tab.
- Direct invitations and active turn-based challenges are combined into Active challenges.
- Friend requests and friends move to the Friends tab.
- Match history moves to the History tab with client-side incremental rendering of the existing fetched rows.
- Duel rankings move to the main Leaderboard screen.
- Notification history and settings move to the notification dialog.
- Account management remains in the existing account dialog.

## Constraints

- No database schema changes.
- No RPC signature changes.
- No new multiplayer write path.
- No replacement of authentication, polling or realtime logic.
