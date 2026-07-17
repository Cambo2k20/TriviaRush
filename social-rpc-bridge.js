(() => {
  "use strict";

  if (!window.supabase?.createClient || window.__triviaRushSocialRpcBridgeInstalled) {
    return;
  }

  window.__triviaRushSocialRpcBridgeInstalled = true;
  window.triviaRushSocialRpcCache = window.triviaRushSocialRpcCache || new Map();

  const watchedRpcNames = new Set([
    "get_social_dashboard",
    "get_duel_invitations",
    "get_turn_challenges",
    "get_duel_match_history_v2",
    "get_duel_leaderboard_v2",
    "get_notifications",
    "get_notification_preferences"
  ]);

  const originalCreateClient = window.supabase.createClient.bind(window.supabase);

  window.supabase.createClient = (...argumentsList) => {
    const client = originalCreateClient(...argumentsList);
    window.triviaRushSupabaseClient = client;

    if (typeof client.rpc === "function" && !client.__triviaRushRpcWrapped) {
      const originalRpc = client.rpc.bind(client);
      client.rpc = async (functionName, parameters, options) => {
        const response = await originalRpc(functionName, parameters, options);

        if (watchedRpcNames.has(functionName) && !response?.error) {
          const cacheKey = `${functionName}:${JSON.stringify(parameters || {})}`;
          const detail = {
            functionName,
            parameters: parameters || {},
            data: response?.data ?? null,
            cacheKey,
            receivedAt: Date.now()
          };

          window.triviaRushSocialRpcCache.set(cacheKey, detail);
          window.dispatchEvent(new CustomEvent("trivia-rush:social-rpc", { detail }));
        }

        return response;
      };
      client.__triviaRushRpcWrapped = true;
    }

    return client;
  };
})();
