(() => {
  "use strict";

  if (!window.supabase?.createClient || window.__triviaRushSocialRpcBridgeInstalled) {
    return;
  }

  window.__triviaRushSocialRpcBridgeInstalled = true;
  window.triviaRushSocialRpcCache = window.triviaRushSocialRpcCache || new Map();

  const bridgeAssetUrl = document.currentScript?.src
    ? new URL(document.currentScript.src, document.baseURI)
    : new URL("social-rpc-bridge.js", document.baseURI);
  const guardStylesheet = document.createElement("link");
  guardStylesheet.rel = "stylesheet";
  guardStylesheet.href = new URL("social-auth-guard.css?v=1", bridgeAssetUrl).href;
  guardStylesheet.dataset.socialAuthGuard = "true";
  document.head.appendChild(guardStylesheet);

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

  function installSocialAccountGuard() {
    const socialScreen = document.querySelector("#socialScreen");
    const socialContent = document.querySelector("#socialContent");
    const accountGate = document.querySelector("#duelAccountGate");
    const accountButton = document.querySelector("#openAccountForDuelButton");

    if (!socialScreen || !socialContent || !accountGate || !accountButton) {
      return;
    }

    const promptDialog = document.createElement("dialog");
    promptDialog.id = "socialAccountPromptDialog";
    promptDialog.className = "social-config-dialog social-account-prompt-dialog";
    promptDialog.setAttribute("aria-labelledby", "socialAccountPromptTitle");

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "dialog-close";
    closeButton.setAttribute("aria-label", "Close account prompt");
    closeButton.textContent = "×";
    closeButton.addEventListener("click", () => promptDialog.close());

    const heading = accountGate.querySelector("h2");
    const copy = accountGate.querySelector("p");
    if (heading) {
      heading.id = "socialAccountPromptTitle";
      heading.textContent = "Sign in to play with friends";
    }
    if (copy) {
      copy.textContent = "Create or sign in to a permanent account to host, join or challenge players.";
    }
    accountButton.textContent = "Create or sign in";
    accountGate.classList.add("social-account-prompt");

    promptDialog.append(closeButton, accountGate);
    document.body.appendChild(promptDialog);

    let restricted = !accountGate.hidden || socialContent.hidden;

    const syncSocialState = () => {
      restricted = !accountGate.hidden || socialContent.hidden;
      if (socialContent.hidden) {
        socialContent.hidden = false;
      }
      if (!restricted && promptDialog.open) {
        promptDialog.close();
      }
      document.body.classList.toggle(
        "social-page-open",
        socialScreen.classList.contains("active")
      );
    };

    const showPrompt = () => {
      if (!promptDialog.open) {
        promptDialog.showModal();
      }
      window.setTimeout(() => accountButton.focus(), 0);
    };

    document.addEventListener("click", (event) => {
      const action = event.target.closest([
        "#openDuelConfigButton",
        "#joinDuelButton",
        "#addFriendButton",
        "#createDuelButton",
        "[data-proxy-id]"
      ].join(","));

      if (!action || action.closest("#socialAccountPromptDialog") || !restricted) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      showPrompt();
    }, true);

    promptDialog.addEventListener("click", (event) => {
      if (event.target === promptDialog) {
        promptDialog.close();
      }
    });

    const observer = new MutationObserver(syncSocialState);
    observer.observe(socialScreen, { attributes: true, attributeFilter: ["class"] });
    observer.observe(accountGate, { attributes: true, attributeFilter: ["hidden"] });
    observer.observe(socialContent, { attributes: true, attributeFilter: ["hidden"] });
    syncSocialState();
  }

  document.addEventListener("DOMContentLoaded", () => {
    window.setTimeout(installSocialAccountGuard, 0);
  }, { once: true });
})();
