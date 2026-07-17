(() => {
  "use strict";

  const state = {
    client: null,
    progression: null,
    refreshSequence: 0,
    retryTimer: null,
    retryCount: 0,
    awardRequests: new Map()
  };

  const elements = {};

  function initialise() {
    injectProgressionUI();
    patchSupabaseClientFactory();
  }

  function patchSupabaseClientFactory() {
    const supabase = window.supabase;
    if (!supabase || typeof supabase.createClient !== "function") {
      window.setTimeout(patchSupabaseClientFactory, 25);
      return;
    }

    if (supabase.createClient.__triviaRushProgressionPatched) {
      return;
    }

    const originalCreateClient = supabase.createClient.bind(supabase);
    const patchedCreateClient = (...args) => {
      const client = originalCreateClient(...args);
      captureClient(client);
      return client;
    };

    patchedCreateClient.__triviaRushProgressionPatched = true;
    supabase.createClient = patchedCreateClient;
  }

  function captureClient(client) {
    if (!client || state.client === client) {
      return;
    }

    state.client = client;
    instrumentRpc(client);

    client.auth?.onAuthStateChange?.(() => {
      clearProgressionRetry();
      state.retryCount = 0;
      window.setTimeout(() => {
        void refreshProgression({ retry: true });
      }, 250);
    });

    window.setTimeout(() => {
      void refreshProgression({ retry: true });
    }, 150);
  }

  function instrumentRpc(client) {
    if (typeof client.rpc !== "function" || client.rpc.__triviaRushProgressionPatched) {
      return;
    }

    const originalRpc = client.rpc.bind(client);
    const patchedRpc = async (name, parameters, options) => {
      const response = await originalRpc(name, parameters, options);
      handleRpcResponse(name, parameters, response);
      return response;
    };

    patchedRpc.__triviaRushProgressionPatched = true;
    client.rpc = patchedRpc;
  }

  function handleRpcResponse(name, parameters, response) {
    if (response?.error) {
      return;
    }

    if (name === "finish_solo_game" && parameters?.p_run_id && response?.data) {
      void loadAwardSummary("solo", parameters.p_run_id);
      return;
    }

    if (
      (name === "get_duel_state" || name === "get_turn_challenge_state") &&
      parameters?.p_match_id &&
      response?.data?.status === "completed"
    ) {
      const sourceKind = response.data.match_format === "turn_based"
        ? "turn_based"
        : "live_duel";
      void loadAwardSummary(sourceKind, parameters.p_match_id);
    }
  }

  function injectProgressionUI() {
    if (document.querySelector("#globalProgressionChip")) {
      cacheElements();
      return;
    }

    const headerActions = document.querySelector(".header-actions");
    const accountButton = document.querySelector("#accountButton");
    if (headerActions) {
      const chip = document.createElement("button");
      chip.id = "globalProgressionChip";
      chip.className = "global-progression-chip";
      chip.type = "button";
      chip.hidden = true;
      chip.setAttribute("aria-label", "Open global progression");
      chip.innerHTML = `
        <span class="global-progression-chip-level">LV <strong id="globalProgressionChipLevel">1</strong></span>
        <span id="globalProgressionChipXp" class="global-progression-chip-xp">0 XP</span>
      `;
      chip.addEventListener("click", () => accountButton?.click());
      headerActions.insertBefore(chip, accountButton || headerActions.firstChild);
    }

    const accountPlayer = document.querySelector(".account-player");
    if (accountPlayer) {
      const panel = document.createElement("section");
      panel.id = "accountProgressionPanel";
      panel.className = "progression-panel progression-account-panel";
      panel.hidden = true;
      panel.setAttribute("aria-labelledby", "accountProgressionTitle");
      panel.innerHTML = `
        <div class="progression-panel-heading">
          <div>
            <span class="progression-kicker">GLOBAL PROGRESSION</span>
            <h3 id="accountProgressionTitle">Level <span id="accountProgressionLevel">1</span></h3>
          </div>
          <strong id="accountProgressionTotal">0 XP</strong>
        </div>
        <div class="progression-track" aria-hidden="true">
          <span id="accountProgressionFill"></span>
        </div>
        <div class="progression-panel-meta">
          <span id="accountProgressionDetail">0 XP earned</span>
          <span id="accountProgressionNext">100 XP to Level 2</span>
        </div>
      `;
      accountPlayer.insertAdjacentElement("afterend", panel);
    }

    injectResultPanel(
      document.querySelector("#resultsScreen .result-card"),
      "soloProgressionResult",
      "XP EARNED"
    );
    injectResultPanel(
      document.querySelector("#duelResultsScreen .result-card"),
      "duelProgressionResult",
      "MATCH XP"
    );

    cacheElements();
  }

  function injectResultPanel(card, id, kicker) {
    if (!card || document.querySelector(`#${id}`)) {
      return;
    }

    const panel = document.createElement("section");
    panel.id = id;
    panel.className = "progression-panel progression-result-panel";
    panel.hidden = true;
    panel.setAttribute("aria-live", "polite");
    panel.innerHTML = `
      <div class="progression-result-award">
        <span class="progression-kicker">${kicker}</span>
        <strong data-progression-award>+0 XP</strong>
      </div>
      <div class="progression-result-level">
        <div>
          <span>Global level</span>
          <strong data-progression-level>Level 1</strong>
        </div>
        <span data-progression-total>0 total XP</span>
      </div>
      <div class="progression-track" aria-hidden="true">
        <span data-progression-fill></span>
      </div>
      <div class="progression-panel-meta">
        <span data-progression-breakdown>Server-validated XP</span>
        <span data-progression-next>100 XP to Level 2</span>
      </div>
    `;

    const actions = card.querySelector(".result-actions");
    card.insertBefore(panel, actions || null);
  }

  function cacheElements() {
    elements.chip = document.querySelector("#globalProgressionChip");
    elements.chipLevel = document.querySelector("#globalProgressionChipLevel");
    elements.chipXp = document.querySelector("#globalProgressionChipXp");
    elements.accountPanel = document.querySelector("#accountProgressionPanel");
    elements.accountLevel = document.querySelector("#accountProgressionLevel");
    elements.accountTotal = document.querySelector("#accountProgressionTotal");
    elements.accountFill = document.querySelector("#accountProgressionFill");
    elements.accountDetail = document.querySelector("#accountProgressionDetail");
    elements.accountNext = document.querySelector("#accountProgressionNext");
    elements.soloResult = document.querySelector("#soloProgressionResult");
    elements.duelResult = document.querySelector("#duelProgressionResult");
  }

  async function refreshProgression({ retry = false } = {}) {
    if (!state.client) {
      return null;
    }

    const sequence = state.refreshSequence + 1;
    state.refreshSequence = sequence;

    const { data, error } = await state.client.rpc("get_my_global_progression");
    if (sequence !== state.refreshSequence) {
      return null;
    }

    if (error || !data) {
      if (retry) {
        scheduleProgressionRetry();
      }
      return null;
    }

    clearProgressionRetry();
    state.retryCount = 0;
    state.progression = normaliseProgression(data);
    renderGlobalProgression(state.progression);
    return state.progression;
  }

  function scheduleProgressionRetry() {
    if (state.retryTimer !== null || state.retryCount >= 6) {
      return;
    }

    state.retryCount += 1;
    const delay = Math.min(5000, 450 * (2 ** (state.retryCount - 1)));
    state.retryTimer = window.setTimeout(() => {
      state.retryTimer = null;
      void refreshProgression({ retry: true });
    }, delay);
  }

  function clearProgressionRetry() {
    if (state.retryTimer !== null) {
      window.clearTimeout(state.retryTimer);
      state.retryTimer = null;
    }
  }

  function normaliseProgression(payload) {
    return {
      totalXp: safeInteger(payload.total_xp),
      level: Math.max(1, safeInteger(payload.level, 1)),
      creditedGames: safeInteger(payload.credited_games),
      nextLevel: payload.next_level == null ? null : safeInteger(payload.next_level),
      xpToNext: payload.xp_to_next_level == null ? null : safeInteger(payload.xp_to_next_level),
      progressPercent: clamp(Number(payload.progress_percent) || 0, 0, 100)
    };
  }

  function renderGlobalProgression(progression) {
    if (!progression) {
      return;
    }

    if (elements.chip) {
      elements.chip.hidden = false;
      elements.chip.setAttribute(
        "aria-label",
        `Global level ${progression.level}, ${formatNumber(progression.totalXp)} XP. Open account progression.`
      );
    }
    setText(elements.chipLevel, progression.level);
    setText(elements.chipXp, `${formatNumber(progression.totalXp)} XP`);

    if (elements.accountPanel) {
      elements.accountPanel.hidden = false;
    }
    setText(elements.accountLevel, progression.level);
    setText(elements.accountTotal, `${formatNumber(progression.totalXp)} XP`);
    setFill(elements.accountFill, progression.progressPercent);
    setText(
      elements.accountDetail,
      `${formatNumber(progression.creditedGames)} credited game${progression.creditedGames === 1 ? "" : "s"}`
    );
    setText(elements.accountNext, getNextLevelCopy(progression));
  }

  async function loadAwardSummary(sourceKind, sourceId) {
    if (!state.client || !sourceId) {
      return;
    }

    const key = `${sourceKind}:${sourceId}`;
    const existing = state.awardRequests.get(key);
    if (existing === "loading" || existing === "credited") {
      return;
    }

    state.awardRequests.set(key, "loading");
    const panel = sourceKind === "solo" ? elements.soloResult : elements.duelResult;
    renderAwardLoading(panel);

    const rpcName = sourceKind === "solo"
      ? "get_solo_global_xp_summary"
      : sourceKind === "turn_based"
        ? "get_turn_based_global_xp_summary"
        : "get_live_duel_global_xp_summary";
    const parameters = sourceKind === "solo"
      ? { p_run_id: sourceId }
      : { p_match_id: sourceId };

    let summary = null;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const { data, error } = await state.client.rpc(rpcName, parameters);
      if (!error && data?.status === "credited") {
        summary = data;
        break;
      }
      if (error || data?.status === "uncredited") {
        break;
      }
      await wait(180 * (attempt + 1));
    }

    if (!summary) {
      state.awardRequests.set(key, "failed");
      renderAwardUnavailable(panel);
      void refreshProgression({ retry: true });
      return;
    }

    state.awardRequests.set(key, "credited");
    const progression = await refreshProgression({ retry: true }) || normaliseProgression({
      total_xp: summary.total_xp,
      level: summary.level,
      credited_games: summary.credited_games,
      progress_percent: 0
    });
    renderAward(panel, summary, progression, sourceKind);
  }

  function renderAwardLoading(panel) {
    if (!panel) {
      return;
    }
    panel.hidden = false;
    panel.classList.add("loading");
    setPanelText(panel, "[data-progression-award]", "Calculating…");
    setPanelText(panel, "[data-progression-breakdown]", "Loading server-validated XP");
  }

  function renderAwardUnavailable(panel) {
    if (!panel) {
      return;
    }
    panel.hidden = false;
    panel.classList.remove("loading");
    setPanelText(panel, "[data-progression-award]", "XP pending");
    setPanelText(panel, "[data-progression-breakdown]", "Progression will refresh automatically");
  }

  function renderAward(panel, summary, progression, sourceKind) {
    if (!panel) {
      return;
    }

    panel.hidden = false;
    panel.classList.remove("loading");
    const xpAwarded = safeInteger(summary.xp_awarded);
    const answerXp = safeInteger(summary.answer_xp);
    const scoreMultiplier = safeMultiplier(summary.score_multiplier);
    const resultMultiplier = safeMultiplier(summary.result_multiplier);

    setPanelText(panel, "[data-progression-award]", `+${formatNumber(xpAwarded)} XP`);
    setPanelText(panel, "[data-progression-level]", `Level ${progression.level}`);
    setPanelText(panel, "[data-progression-total]", `${formatNumber(progression.totalXp)} total XP`);
    setPanelFill(panel, progression.progressPercent);

    const breakdown = sourceKind === "solo"
      ? `${formatNumber(answerXp)} answer XP · score ×${scoreMultiplier}`
      : `${formatNumber(answerXp)} answer XP · score ×${scoreMultiplier} · result ×${resultMultiplier}`;
    setPanelText(panel, "[data-progression-breakdown]", breakdown);
    setPanelText(panel, "[data-progression-next]", getNextLevelCopy(progression));
  }

  function getNextLevelCopy(progression) {
    if (progression.nextLevel == null || progression.xpToNext == null) {
      return "Maximum configured level reached";
    }
    return `${formatNumber(progression.xpToNext)} XP to Level ${progression.nextLevel}`;
  }

  function setPanelText(panel, selector, value) {
    setText(panel?.querySelector(selector), value);
  }

  function setPanelFill(panel, percentage) {
    setFill(panel?.querySelector("[data-progression-fill]"), percentage);
  }

  function setFill(element, percentage) {
    if (element) {
      element.style.width = `${clamp(Number(percentage) || 0, 0, 100)}%`;
    }
  }

  function setText(element, value) {
    if (element) {
      element.textContent = String(value);
    }
  }

  function safeInteger(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, Math.round(number)) : fallback;
  }

  function safeMultiplier(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number.toFixed(2) : "1.00";
  }

  function formatNumber(value) {
    return safeInteger(value).toLocaleString();
  }

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function wait(milliseconds) {
    return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
  }

  window.TriviaRushProgressionUI = Object.freeze({
    refresh: () => refreshProgression({ retry: true })
  });

  initialise();
})();
