(() => {
  "use strict";

  const CATEGORY_PROGRESSION_EVENT = "trivia-rush:category-progression";

  const state = {
    client: null,
    categories: [],
    categoryMap: new Map(),
    refreshSequence: 0,
    retryTimer: null,
    retryCount: 0,
    summaryRequests: new Map()
  };

  const elements = {};
  const iconMap = Object.freeze({
    flask: "⚗",
    landmark: "⌂",
    globe: "◎",
    film: "▶",
    trophy: "★",
    cpu: "⌘",
    gamepad: "◆",
    utensils: "◒",
    paw: "♣",
    palette_book: "✦",
    dragon: "♞",
    thunderbolt: "ϟ",
    wand: "✧",
    shield: "⬟"
  });

  function initialise() {
    injectCategoryProgressionUI();
    patchSupabaseClientFactory();
  }

  function patchSupabaseClientFactory() {
    const supabase = window.supabase;
    if (!supabase || typeof supabase.createClient !== "function") {
      window.setTimeout(patchSupabaseClientFactory, 25);
      return;
    }

    if (supabase.createClient.__triviaRushCategoryProgressionPatched) {
      return;
    }

    const originalCreateClient = supabase.createClient.bind(supabase);
    const patchedCreateClient = (...args) => {
      const client = originalCreateClient(...args);
      captureClient(client);
      return client;
    };

    patchedCreateClient.__triviaRushCategoryProgressionPatched = true;
    supabase.createClient = patchedCreateClient;
  }

  function captureClient(client) {
    if (!client || state.client === client) {
      return;
    }

    state.client = client;
    instrumentRpc(client);

    client.auth?.onAuthStateChange?.(() => {
      clearRetry();
      state.retryCount = 0;
      state.summaryRequests.clear();
      window.setTimeout(() => {
        void refreshCategoryProgression({ retry: true });
      }, 250);
    });

    window.setTimeout(() => {
      void refreshCategoryProgression({ retry: true });
    }, 170);
  }

  function instrumentRpc(client) {
    if (typeof client.rpc !== "function" || client.rpc.__triviaRushCategoryProgressionPatched) {
      return;
    }

    const originalRpc = client.rpc.bind(client);
    const patchedRpc = async (name, parameters, options) => {
      const response = await originalRpc(name, parameters, options);
      handleRpcResponse(name, parameters, response);
      return response;
    };

    patchedRpc.__triviaRushCategoryProgressionPatched = true;
    client.rpc = patchedRpc;
  }

  function handleRpcResponse(name, parameters, response) {
    if (response?.error) {
      return;
    }

    if (name === "finish_solo_game" && parameters?.p_run_id && response?.data) {
      void loadCategorySummary("solo", parameters.p_run_id);
      return;
    }

    if (
      (name === "get_duel_state" || name === "get_turn_challenge_state") &&
      parameters?.p_match_id &&
      response?.data?.status === "completed"
    ) {
      void loadCategorySummary("duel", parameters.p_match_id);
    }
  }

  function injectCategoryProgressionUI() {
    if (!document.querySelector("#accountCategoryMasteryPanel")) {
      const accountPanel = document.createElement("section");
      accountPanel.id = "accountCategoryMasteryPanel";
      accountPanel.className = "progression-panel category-mastery-panel";
      accountPanel.hidden = true;
      accountPanel.setAttribute("aria-labelledby", "accountCategoryMasteryTitle");
      accountPanel.innerHTML = `
        <div class="category-mastery-heading">
          <div>
            <span class="progression-kicker">CATEGORY MASTERY</span>
            <h3 id="accountCategoryMasteryTitle">Subject levels</h3>
          </div>
          <strong id="accountCategoryMasteryTotal" class="category-mastery-total">0 XP</strong>
        </div>
        <p class="category-mastery-copy">Correct answers build a separate level in each category.</p>
        <div id="accountCategoryMasteryGrid" class="category-mastery-grid"></div>
      `;

      const globalPanel = document.querySelector("#accountProgressionPanel");
      const accountPlayer = document.querySelector(".account-player");
      if (globalPanel) {
        globalPanel.insertAdjacentElement("afterend", accountPanel);
      } else if (accountPlayer) {
        accountPlayer.insertAdjacentElement("afterend", accountPanel);
      }
    }

    injectResultPanel(
      document.querySelector("#resultsScreen .result-card"),
      "soloCategoryProgressionResult"
    );
    injectResultPanel(
      document.querySelector("#duelResultsScreen .result-card"),
      "duelCategoryProgressionResult"
    );

    cacheElements();
  }

  function injectResultPanel(card, id) {
    if (!card || document.querySelector(`#${id}`)) {
      return;
    }

    const panel = document.createElement("section");
    panel.id = id;
    panel.className = "progression-panel category-result-panel";
    panel.hidden = true;
    panel.setAttribute("aria-live", "polite");
    panel.innerHTML = `
      <div class="category-result-heading">
        <div>
          <span class="progression-kicker">CATEGORY MASTERY</span>
          <h3>Mastery gained</h3>
        </div>
        <strong class="category-result-total" data-category-result-total>+0 XP</strong>
      </div>
      <div class="category-result-list" data-category-result-list></div>
    `;

    const globalResult = card.querySelector(".progression-result-panel");
    const actions = card.querySelector(".result-actions");
    if (globalResult) {
      globalResult.insertAdjacentElement("afterend", panel);
    } else {
      card.insertBefore(panel, actions || null);
    }
  }

  function cacheElements() {
    elements.accountPanel = document.querySelector("#accountCategoryMasteryPanel");
    elements.accountTotal = document.querySelector("#accountCategoryMasteryTotal");
    elements.accountGrid = document.querySelector("#accountCategoryMasteryGrid");
    elements.soloResult = document.querySelector("#soloCategoryProgressionResult");
    elements.duelResult = document.querySelector("#duelCategoryProgressionResult");
  }

  async function refreshCategoryProgression({ retry = false } = {}) {
    if (!state.client) {
      return null;
    }

    const sequence = state.refreshSequence + 1;
    state.refreshSequence = sequence;

    const { data, error } = await state.client.rpc("get_my_category_progression");
    if (sequence !== state.refreshSequence) {
      return null;
    }

    if (error || !data || !Array.isArray(data.categories)) {
      if (retry) {
        scheduleRetry();
      }
      return null;
    }

    clearRetry();
    state.retryCount = 0;
    state.categories = data.categories.map(normaliseCategory);
    state.categoryMap = new Map(state.categories.map((category) => [category.id, category]));
    renderAccountProgression(state.categories, safeInteger(data.total_xp));
    publishCategoryProgression(state.categories);
    return state.categories;
  }

  function scheduleRetry() {
    if (state.retryTimer !== null || state.retryCount >= 6) {
      return;
    }

    state.retryCount += 1;
    const delay = Math.min(5000, 450 * (2 ** (state.retryCount - 1)));
    state.retryTimer = window.setTimeout(() => {
      state.retryTimer = null;
      void refreshCategoryProgression({ retry: true });
    }, delay);
  }

  function clearRetry() {
    if (state.retryTimer !== null) {
      window.clearTimeout(state.retryTimer);
      state.retryTimer = null;
    }
  }

  function normaliseCategory(payload) {
    return {
      id: String(payload.category_id || ""),
      label: String(payload.label || payload.category_id || "Category"),
      iconKey: String(payload.icon_key || ""),
      color: safeColor(payload.color),
      xp: safeInteger(payload.xp),
      level: Math.max(1, safeInteger(payload.level, 1)),
      nextLevel: payload.next_level == null ? null : safeInteger(payload.next_level),
      xpToNext: payload.xp_to_next_level == null ? null : safeInteger(payload.xp_to_next_level),
      progressPercent: clamp(Number(payload.progress_percent) || 0, 0, 100),
      questionsAnswered: safeInteger(payload.questions_answered),
      correctAnswers: safeInteger(payload.correct_answers),
      accuracyPercent: clamp(Number(payload.accuracy_percent) || 0, 0, 100)
    };
  }

  function publishCategoryProgression(categories) {
    const detail = {
      categories: categories.map((category) => ({
        id: category.id,
        label: category.label,
        iconKey: category.iconKey,
        color: category.color,
        level: category.level,
        nextLevel: category.nextLevel,
        xpToNext: category.xpToNext,
        progressPercent: category.progressPercent
      }))
    };

    window.dispatchEvent(new CustomEvent(CATEGORY_PROGRESSION_EVENT, { detail }));
  }

  function renderAccountProgression(categories, totalXp) {
    if (!elements.accountPanel || !elements.accountGrid) {
      return;
    }

    elements.accountPanel.hidden = false;
    elements.accountTotal.textContent = `${formatNumber(totalXp)} XP`;
    elements.accountGrid.replaceChildren();

    for (const category of categories) {
      elements.accountGrid.appendChild(buildCategoryCard(category));
    }
  }

  function buildCategoryCard(category) {
    const card = document.createElement("article");
    card.className = "category-mastery-card";
    card.dataset.categoryId = category.id;
    card.style.setProperty("--category-accent", category.color);

    const heading = document.createElement("div");
    heading.className = "category-mastery-card-heading";

    const title = document.createElement("div");
    title.className = "category-mastery-card-title";

    const icon = document.createElement("span");
    icon.className = "category-mastery-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = iconMap[category.iconKey] || "?";

    const label = document.createElement("strong");
    label.textContent = category.label;

    const level = document.createElement("span");
    level.className = "category-mastery-level";
    level.textContent = `LV ${category.level}`;

    title.append(icon, label);
    heading.append(title, level);

    const track = document.createElement("div");
    track.className = "category-mastery-track";
    track.setAttribute("aria-hidden", "true");
    const fill = document.createElement("span");
    fill.style.width = `${category.progressPercent}%`;
    track.appendChild(fill);

    const meta = document.createElement("div");
    meta.className = "category-mastery-meta";
    const activity = document.createElement("span");
    activity.textContent = `${formatNumber(category.questionsAnswered)} answered · ${formatPercent(category.accuracyPercent)} accuracy`;
    const next = document.createElement("span");
    next.textContent = getNextLevelCopy(category);
    meta.append(activity, next);

    card.append(heading, track, meta);
    return card;
  }

  async function loadCategorySummary(kind, sourceId) {
    if (!state.client || !sourceId) {
      return;
    }

    const key = `${kind}:${sourceId}`;
    if (state.summaryRequests.get(key) === "loading" || state.summaryRequests.get(key) === "credited") {
      return;
    }

    state.summaryRequests.set(key, "loading");
    const panel = kind === "solo" ? elements.soloResult : elements.duelResult;
    renderSummaryLoading(panel);

    const rpcName = kind === "solo"
      ? "get_solo_category_xp_summary"
      : "get_duel_category_xp_summary";
    const parameters = kind === "solo"
      ? { p_run_id: sourceId }
      : { p_match_id: sourceId };

    let summary = null;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const { data, error } = await state.client.rpc(rpcName, parameters);
      if (!error && data?.status === "credited" && Array.isArray(data.categories)) {
        summary = data;
        break;
      }
      if (error) {
        break;
      }
      await wait(180 * (attempt + 1));
    }

    if (!summary) {
      state.summaryRequests.delete(key);
      renderSummaryUnavailable(panel);
      void refreshCategoryProgression({ retry: true });
      return;
    }

    state.summaryRequests.set(key, "credited");
    await refreshCategoryProgression({ retry: true });
    renderSummary(panel, summary);
  }

  function renderSummaryLoading(panel) {
    if (!panel) {
      return;
    }
    panel.hidden = false;
    panel.classList.add("loading");
    const total = panel.querySelector("[data-category-result-total]");
    const list = panel.querySelector("[data-category-result-list]");
    if (total) total.textContent = "Calculating…";
    if (list) list.replaceChildren();
  }

  function renderSummaryUnavailable(panel) {
    if (!panel) {
      return;
    }
    panel.hidden = false;
    panel.classList.remove("loading");
    const total = panel.querySelector("[data-category-result-total]");
    const list = panel.querySelector("[data-category-result-list]");
    if (total) total.textContent = "XP pending";
    if (list) {
      const copy = document.createElement("p");
      copy.className = "category-result-empty";
      copy.textContent = "Category progression will refresh automatically.";
      list.replaceChildren(copy);
    }
  }

  function renderSummary(panel, summary) {
    if (!panel) {
      return;
    }

    panel.hidden = false;
    panel.classList.remove("loading");
    const total = panel.querySelector("[data-category-result-total]");
    const list = panel.querySelector("[data-category-result-list]");
    const rows = summary.categories || [];

    if (total) {
      total.textContent = `+${formatNumber(summary.total_xp_awarded)} XP`;
    }
    if (!list) {
      return;
    }

    list.replaceChildren();
    for (const row of rows) {
      list.appendChild(buildSummaryRow(row));
    }

    if (rows.length === 0) {
      const copy = document.createElement("p");
      copy.className = "category-result-empty";
      copy.textContent = "No category activity was recorded for this game.";
      list.appendChild(copy);
    }
  }

  function buildSummaryRow(payload) {
    const categoryId = String(payload.category_id || "");
    const current = state.categoryMap.get(categoryId);
    const color = current?.color || safeColor(payload.color);
    const levelBefore = Math.max(1, safeInteger(payload.level_before, 1));
    const levelAfter = Math.max(levelBefore, safeInteger(payload.level_after, levelBefore));
    const xpAwarded = safeInteger(payload.xp_awarded);
    const answered = safeInteger(payload.questions_answered);
    const correct = safeInteger(payload.correct_answers);

    const row = document.createElement("article");
    row.className = `category-result-row${levelAfter > levelBefore ? " level-up" : ""}`;
    row.style.setProperty("--category-accent", color);

    const heading = document.createElement("div");
    heading.className = "category-result-row-heading";

    const title = document.createElement("div");
    title.className = "category-result-row-title";
    const label = document.createElement("strong");
    label.textContent = String(payload.label || current?.label || categoryId || "Category");
    const level = document.createElement("span");
    level.className = "category-result-level";
    level.textContent = levelAfter > levelBefore
      ? `LV ${levelBefore} → ${levelAfter}`
      : `LV ${levelAfter}`;
    title.append(label, level);

    const xp = document.createElement("span");
    xp.className = "category-result-xp";
    xp.textContent = `+${formatNumber(xpAwarded)} XP`;
    heading.append(title, xp);

    const track = document.createElement("div");
    track.className = "category-result-track";
    track.setAttribute("aria-hidden", "true");
    const fill = document.createElement("span");
    fill.style.width = `${current?.progressPercent ?? 0}%`;
    track.appendChild(fill);

    const meta = document.createElement("div");
    meta.className = "category-result-meta";
    const accuracy = document.createElement("span");
    accuracy.textContent = `${formatNumber(correct)} of ${formatNumber(answered)} correct`;
    const next = document.createElement("span");
    next.textContent = levelAfter > levelBefore
      ? `Level ${levelAfter} reached`
      : current
        ? getNextLevelCopy(current)
        : "Activity recorded";
    meta.append(accuracy, next);

    row.append(heading, track, meta);
    return row;
  }

  function getNextLevelCopy(category) {
    if (category.nextLevel == null || category.xpToNext == null) {
      return "Maximum level reached";
    }
    return `${formatNumber(category.xpToNext)} XP to LV ${category.nextLevel}`;
  }

  function safeInteger(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, Math.round(number)) : fallback;
  }

  function safeColor(value) {
    const color = String(value || "").toUpperCase();
    return /^#[0-9A-F]{6}$/.test(color) ? color : "#3EE7DB";
  }

  function formatNumber(value) {
    return safeInteger(value).toLocaleString();
  }

  function formatPercent(value) {
    const number = clamp(Number(value) || 0, 0, 100);
    return Number.isInteger(number) ? `${number}%` : `${number.toFixed(1)}%`;
  }

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function wait(milliseconds) {
    return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
  }

  window.TriviaRushCategoryProgressionUI = Object.freeze({
    refresh: () => refreshCategoryProgression({ retry: true })
  });

  initialise();
})();
