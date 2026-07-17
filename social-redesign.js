(() => {
  "use strict";

  const HISTORY_PAGE_SIZE = 5;
  const VALID_TABS = new Set(["play", "friends", "history"]);
  const VALID_HISTORY_FORMATS = new Set(["all", "live", "turn_based"]);

  const viewState = {
    activeTab: "play",
    historyFormat: "all",
    historyVisible: HISTORY_PAGE_SIZE,
    challengesExpanded: false,
    renderQueued: false,
    notificationReturnScreen: null
  };

  const refs = {};

  function init() {
    refs.socialScreen = document.querySelector("#socialScreen");
    refs.socialShell = refs.socialScreen?.querySelector(".social-shell");
    refs.socialHeader = refs.socialScreen?.querySelector(".social-header");
    refs.socialContent = document.querySelector("#socialContent");
    refs.socialStatus = document.querySelector("#socialStatus");
    refs.accountGate = document.querySelector("#duelAccountGate");
    refs.closeSocialButton = document.querySelector("#closeSocialButton");

    if (!refs.socialScreen || !refs.socialShell || !refs.socialHeader || !refs.socialContent) {
      return;
    }

    refs.createCard = document.querySelector("#createDuelButton")?.closest(".social-card");
    refs.joinCard = document.querySelector("#joinDuelButton")?.closest(".social-card");
    refs.turnCard = document.querySelector("#turnChallenges")?.closest(".social-card");
    refs.friendsCard = document.querySelector("#friendsList")?.closest(".social-card");
    refs.historyCard = document.querySelector("#duelHistory")?.closest(".social-card");
    refs.duelLeaderboardCard = document.querySelector("#duelLeaderboard")?.closest(".social-card");
    refs.notificationCard = document.querySelector("#notificationCard");

    refs.duelInvitations = document.querySelector("#duelInvitations");
    refs.turnChallenges = document.querySelector("#turnChallenges");
    refs.turnChallengeActivity = document.querySelector("#turnChallengeActivity");
    refs.friendsList = document.querySelector("#friendsList");
    refs.friendRequests = document.querySelector("#friendRequests");
    refs.duelHistory = document.querySelector("#duelHistory");
    refs.historyOpponentFilter = document.querySelector("#historyOpponentFilter");
    refs.duelRoomCode = document.querySelector("#duelRoomCode");
    refs.joinDuelButton = document.querySelector("#joinDuelButton");
    refs.friendAccountNumber = document.querySelector("#friendAccountNumber");
    refs.addFriendButton = document.querySelector("#addFriendButton");

    buildPageStructure();
    bindPageEvents();
    observeExistingRuntime();
    applyInitialTab();
    scheduleRender();
  }

  function buildPageStructure() {
    refs.socialScreen.classList.add("social-tabs-redesign");
    document.body.classList.add("social-redesign-ready");

    const eyebrow = refs.socialHeader.querySelector(".eyebrow");
    eyebrow?.remove();

    const headingGroup = refs.socialHeader.querySelector("div");
    const heading = headingGroup?.querySelector("h1");
    const description = headingGroup?.querySelector("p");
    if (heading) heading.textContent = "Play with friends";
    if (description) description.textContent = "Challenge a friend or join a game.";
    headingGroup?.classList.add("social-page-heading");
    refs.closeSocialButton?.classList.add("social-back-button");

    refs.tabList = document.createElement("div");
    refs.tabList.className = "social-tabs";
    refs.tabList.setAttribute("role", "tablist");
    refs.tabList.setAttribute("aria-label", "Play with friends sections");

    refs.panels = {};
    refs.tabButtons = {};
    [
      ["play", "Play"],
      ["friends", "Friends"],
      ["history", "History"]
    ].forEach(([id, label]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "social-tab";
      button.id = `socialTab-${id}`;
      button.dataset.socialTab = id;
      button.setAttribute("role", "tab");
      button.setAttribute("aria-controls", `socialPanel-${id}`);
      button.setAttribute("aria-selected", "false");
      button.tabIndex = -1;
      button.textContent = label;
      refs.tabButtons[id] = button;
      refs.tabList.appendChild(button);

      const panel = document.createElement("section");
      panel.className = "social-tab-panel";
      panel.id = `socialPanel-${id}`;
      panel.dataset.socialPanel = id;
      panel.setAttribute("role", "tabpanel");
      panel.setAttribute("aria-labelledby", button.id);
      panel.hidden = true;
      refs.panels[id] = panel;
    });

    refs.socialHeader.insertAdjacentElement("afterend", refs.tabList);

    refs.legacyDepot = document.createElement("div");
    refs.legacyDepot.className = "social-legacy-depot";
    refs.legacyDepot.hidden = true;

    buildPlayPanel();
    buildFriendsPanel();
    buildHistoryPanel();
    buildDuelConfigurationDialog();
    moveDuelLeaderboardToMainLeaderboard();
    buildNotificationDialog();
    buildHistoryDetailsDialog();

    refs.socialContent.replaceChildren(
      refs.socialStatus,
      refs.panels.play,
      refs.panels.friends,
      refs.panels.history,
      refs.legacyDepot
    );
  }

  function buildPlayPanel() {
    const panel = refs.panels.play;

    const actions = document.createElement("div");
    actions.className = "social-play-actions";

    const host = document.createElement("section");
    host.className = "social-play-action social-host-action";
    host.innerHTML = `
      <span class="social-action-icon social-action-icon-yellow" aria-hidden="true">♙+</span>
      <h2>Host a game</h2>
      <p>Create a room and invite a friend.</p>
    `;
    refs.openDuelConfigButton = document.createElement("button");
    refs.openDuelConfigButton.id = "openDuelConfigButton";
    refs.openDuelConfigButton.type = "button";
    refs.openDuelConfigButton.className = "primary-button social-primary-action";
    refs.openDuelConfigButton.textContent = "Create room";
    host.appendChild(refs.openDuelConfigButton);

    const join = document.createElement("section");
    join.className = "social-play-action social-join-action";
    join.innerHTML = `
      <span class="social-action-icon social-action-icon-teal" aria-hidden="true">↪</span>
      <h2>Join with code</h2>
    `;
    if (refs.duelRoomCode) {
      refs.duelRoomCode.placeholder = "Enter room code";
      refs.duelRoomCode.setAttribute("aria-label", "Room code");
      join.appendChild(refs.duelRoomCode);
    }
    if (refs.joinDuelButton) {
      refs.joinDuelButton.textContent = "Join game";
      refs.joinDuelButton.classList.remove("primary-button");
      refs.joinDuelButton.classList.add("social-outline-action");
      join.appendChild(refs.joinDuelButton);
    }

    actions.append(host, join);

    const activeSection = document.createElement("section");
    activeSection.className = "social-active-section";
    const activeHeading = document.createElement("div");
    activeHeading.className = "social-section-heading";
    activeHeading.innerHTML = "<h2>Active challenges</h2>";
    refs.viewAllChallengesButton = document.createElement("button");
    refs.viewAllChallengesButton.type = "button";
    refs.viewAllChallengesButton.className = "social-text-action";
    refs.viewAllChallengesButton.textContent = "View all challenges ›";
    refs.viewAllChallengesButton.hidden = true;
    activeHeading.appendChild(refs.viewAllChallengesButton);

    refs.activeChallengeView = document.createElement("div");
    refs.activeChallengeView.id = "activeChallengesList";
    refs.activeChallengeView.className = "social-compact-list";
    refs.activeChallengeView.setAttribute("aria-live", "polite");
    activeSection.append(activeHeading, refs.activeChallengeView);

    panel.append(actions, activeSection);

    [refs.joinCard, refs.turnCard].forEach((card) => {
      if (card) refs.legacyDepot.appendChild(card);
    });
  }

  function buildFriendsPanel() {
    const panel = refs.panels.friends;
    const layout = document.createElement("div");
    layout.className = "social-friends-layout";

    const friendsColumn = document.createElement("section");
    friendsColumn.className = "social-friends-column";
    const heading = document.createElement("div");
    heading.className = "social-section-heading social-friend-heading";
    heading.innerHTML = "<h2>Your friends</h2>";
    refs.friendCount = document.createElement("span");
    refs.friendCount.className = "social-count-badge";
    refs.friendCount.textContent = "0";
    heading.appendChild(refs.friendCount);
    refs.friendView = document.createElement("div");
    refs.friendView.id = "friendsCompactList";
    refs.friendView.className = "social-compact-list social-friend-list";
    friendsColumn.append(heading, refs.friendView);

    const requestColumn = document.createElement("aside");
    requestColumn.className = "social-request-column";
    const addSection = document.createElement("section");
    addSection.className = "social-add-friend";
    addSection.innerHTML = "<h2>Add a friend</h2>";
    if (refs.friendAccountNumber) {
      refs.friendAccountNumber.placeholder = "Enter account number";
      refs.friendAccountNumber.setAttribute("aria-label", "Friend account number");
      addSection.appendChild(refs.friendAccountNumber);
    }
    if (refs.addFriendButton) {
      refs.addFriendButton.textContent = "Send request";
      refs.addFriendButton.classList.remove("secondary-button");
      refs.addFriendButton.classList.add("social-outline-action");
      addSection.appendChild(refs.addFriendButton);
    }

    const requestSection = document.createElement("section");
    requestSection.className = "social-request-section";
    requestSection.innerHTML = "<h2>Requests</h2>";
    refs.requestView = document.createElement("div");
    refs.requestView.id = "friendRequestsCompactList";
    refs.requestView.className = "social-compact-list social-request-list";
    requestSection.appendChild(refs.requestView);
    requestColumn.append(addSection, requestSection);

    layout.append(friendsColumn, requestColumn);
    panel.appendChild(layout);

    if (refs.friendsCard) refs.legacyDepot.appendChild(refs.friendsCard);
  }

  function buildHistoryPanel() {
    const panel = refs.panels.history;

    refs.historySummary = document.createElement("div");
    refs.historySummary.className = "social-history-summary";
    refs.historySummary.innerHTML = `
      <div><strong id="socialTotalMatches">0</strong><span>matches</span></div>
      <div><strong id="socialTotalWins">0</strong><span>wins</span></div>
      <div><strong id="socialWinRate">0%</strong><span>win rate</span></div>
    `;

    const controls = document.createElement("div");
    controls.className = "social-history-controls";
    refs.historyFormatGroup = document.createElement("div");
    refs.historyFormatGroup.className = "social-segmented-control";
    refs.historyFormatGroup.setAttribute("role", "group");
    refs.historyFormatGroup.setAttribute("aria-label", "Match history format");
    [["all", "All"], ["live", "Live"], ["turn_based", "Turn-based"]].forEach(([value, label]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.historyFormat = value;
      button.setAttribute("aria-pressed", value === "all" ? "true" : "false");
      button.className = value === "all" ? "active" : "";
      button.textContent = label;
      refs.historyFormatGroup.appendChild(button);
    });

    if (refs.historyOpponentFilter) {
      refs.historyOpponentFilter.classList.add("social-opponent-filter");
      refs.historyOpponentFilter.placeholder = "Opponent ID";
      refs.historyOpponentFilter.setAttribute("aria-label", "Filter history by opponent account number");
      controls.append(refs.historyFormatGroup, refs.historyOpponentFilter);
    } else {
      controls.appendChild(refs.historyFormatGroup);
    }

    const recentHeading = document.createElement("h2");
    recentHeading.className = "social-history-heading";
    recentHeading.textContent = "Recent matches";

    refs.historyView = document.createElement("div");
    refs.historyView.id = "recentMatchesList";
    refs.historyView.className = "social-compact-list social-history-list";

    refs.loadOlderHistoryButton = document.createElement("button");
    refs.loadOlderHistoryButton.type = "button";
    refs.loadOlderHistoryButton.className = "social-text-action social-load-older";
    refs.loadOlderHistoryButton.textContent = "Load older matches⌄";
    refs.loadOlderHistoryButton.hidden = true;

    panel.append(refs.historySummary, controls, recentHeading, refs.historyView, refs.loadOlderHistoryButton);

    if (refs.historyCard) refs.legacyDepot.appendChild(refs.historyCard);
  }

  function buildDuelConfigurationDialog() {
    refs.duelConfigDialog = document.createElement("dialog");
    refs.duelConfigDialog.id = "duelConfigDialog";
    refs.duelConfigDialog.className = "social-config-dialog";
    refs.duelConfigDialog.setAttribute("aria-labelledby", "duelConfigTitle");

    const close = document.createElement("button");
    close.type = "button";
    close.className = "dialog-close";
    close.setAttribute("aria-label", "Close game configuration");
    close.textContent = "×";
    close.addEventListener("click", () => refs.duelConfigDialog.close());

    const heading = document.createElement("div");
    heading.className = "social-dialog-heading";
    heading.innerHTML = `
      <h2 id="duelConfigTitle">Create a game</h2>
      <p>Choose the format, category and round length.</p>
    `;

    refs.duelConfigDialog.append(close, heading);
    if (refs.createCard) {
      refs.createCard.classList.add("social-config-form");
      const title = refs.createCard.querySelector("h2");
      title?.remove();
      refs.duelConfigDialog.appendChild(refs.createCard);
    }
    document.body.appendChild(refs.duelConfigDialog);
  }

  function moveDuelLeaderboardToMainLeaderboard() {
    const leaderboardCard = document.querySelector("#leaderboardScreen .leaderboard-card");
    if (!leaderboardCard || !refs.duelLeaderboardCard) return;

    refs.duelLeaderboardCard.classList.add("main-duel-leaderboard");
    const title = refs.duelLeaderboardCard.querySelector("h2");
    if (title) title.textContent = "Multiplayer rankings";
    const note = refs.duelLeaderboardCard.querySelector(".card-note");
    if (note) note.textContent = "Ranked by wins, then win rate after five matches, then total duel score.";
    leaderboardCard.appendChild(refs.duelLeaderboardCard);
  }

  function buildNotificationDialog() {
    if (!refs.notificationCard) return;

    refs.notificationDialog = document.createElement("dialog");
    refs.notificationDialog.id = "notificationDialog";
    refs.notificationDialog.className = "social-notification-dialog";
    refs.notificationDialog.setAttribute("aria-labelledby", "notificationDialogTitle");

    const close = document.createElement("button");
    close.type = "button";
    close.className = "dialog-close";
    close.setAttribute("aria-label", "Close notifications");
    close.textContent = "×";
    close.addEventListener("click", closeNotificationDialog);

    const cardTitle = refs.notificationCard.querySelector("h2");
    if (cardTitle) cardTitle.id = "notificationDialogTitle";
    refs.notificationCard.classList.add("notification-settings-panel");
    refs.notificationDialog.append(close, refs.notificationCard);
    document.body.appendChild(refs.notificationDialog);
  }

  function buildHistoryDetailsDialog() {
    refs.historyDialog = document.createElement("dialog");
    refs.historyDialog.id = "historyMatchDialog";
    refs.historyDialog.className = "social-history-dialog";
    refs.historyDialog.innerHTML = `
      <button type="button" class="dialog-close" aria-label="Close match details">×</button>
      <div id="historyMatchDetails"></div>
    `;
    refs.historyDialog.querySelector(".dialog-close")?.addEventListener("click", () => refs.historyDialog.close());
    document.body.appendChild(refs.historyDialog);
  }

  function bindPageEvents() {
    Object.values(refs.tabButtons).forEach((button) => {
      button.addEventListener("click", () => setActiveTab(button.dataset.socialTab, true));
      button.addEventListener("keydown", handleTabKeydown);
    });

    refs.openDuelConfigButton?.addEventListener("click", () => openDuelConfiguration());
    refs.viewAllChallengesButton?.addEventListener("click", () => {
      viewState.challengesExpanded = !viewState.challengesExpanded;
      renderActiveChallenges();
    });
    refs.loadOlderHistoryButton?.addEventListener("click", () => {
      viewState.historyVisible += HISTORY_PAGE_SIZE;
      renderHistory();
    });
    refs.historyFormatGroup?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-history-format]");
      if (!button) return;
      setHistoryFormat(button.dataset.historyFormat);
    });

    document.querySelector("#duelButton")?.addEventListener("click", () => {
      window.setTimeout(() => {
        if (refs.socialScreen.classList.contains("active")) {
          setActiveTab(readTabFromUrl() || viewState.activeTab || "play", false);
        }
      }, 0);
    });

    refs.closeSocialButton?.addEventListener("click", () => {
      const url = new URL(window.location.href);
      url.searchParams.delete("social");
      window.history.replaceState({}, "", url);
    });

    const notificationButton = document.querySelector("#notificationButton");
    notificationButton?.addEventListener("click", () => {
      refs.notificationReturnScreen = [...document.querySelectorAll(".screen")]
        .find((screen) => screen.classList.contains("active") && screen !== refs.socialScreen) || null;
      window.setTimeout(() => {
        if (refs.notificationDialog && !refs.notificationDialog.open) {
          refs.notificationDialog.showModal();
        }
      }, 0);
    }, true);

    refs.notificationDialog?.addEventListener("click", (event) => {
      if (event.target === refs.notificationDialog) closeNotificationDialog();
    });

    refs.duelConfigDialog?.addEventListener("click", (event) => {
      if (event.target === refs.duelConfigDialog) refs.duelConfigDialog.close();
    });

    refs.historyDialog?.addEventListener("click", (event) => {
      if (event.target === refs.historyDialog) refs.historyDialog.close();
    });

    refs.friendView?.addEventListener("click", handleProxyAction);
    refs.requestView?.addEventListener("click", handleProxyAction);
    refs.activeChallengeView?.addEventListener("click", handleProxyAction);

    refs.friendView?.addEventListener("toggle", (event) => {
      if (event.target.matches("details[open]")) {
        refs.friendView.querySelectorAll("details[open]").forEach((details) => {
          if (details !== event.target) details.open = false;
        });
      }
    }, true);

    document.querySelector("#leaderboardButton")?.addEventListener("click", refreshDuelLeaderboardOnMainPage);
    document.querySelector("#resultsLeaderboardButton")?.addEventListener("click", refreshDuelLeaderboardOnMainPage);

    document.querySelector("#notificationList")?.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (button?.textContent.trim() === "View") {
        closeNotificationDialog(false);
        setActiveTab("friends", true);
      }
    });
  }

  function observeExistingRuntime() {
    const observer = new MutationObserver(scheduleRender);
    [
      refs.duelInvitations,
      refs.turnChallenges,
      refs.turnChallengeActivity,
      refs.friendsList,
      refs.friendRequests,
      refs.duelHistory
    ].forEach((container) => {
      if (container) observer.observe(container, { childList: true, subtree: true, characterData: true });
    });

    window.addEventListener("trivia-rush:social-rpc", scheduleRender);

    const activeObserver = new MutationObserver(() => {
      if (refs.socialScreen.classList.contains("active")) {
        refs.socialScreen.classList.add("social-page-active");
        setActiveTab(readTabFromUrl() || viewState.activeTab || "play", false);
      } else {
        refs.socialScreen.classList.remove("social-page-active");
      }
    });
    activeObserver.observe(refs.socialScreen, { attributes: true, attributeFilter: ["class"] });
  }

  function scheduleRender() {
    if (viewState.renderQueued) return;
    viewState.renderQueued = true;
    window.requestAnimationFrame(() => {
      viewState.renderQueued = false;
      renderActiveChallenges();
      renderFriends();
      renderRequests();
      renderHistory();
    });
  }

  function applyInitialTab() {
    setActiveTab(readTabFromUrl() || "play", false);
  }

  function readTabFromUrl() {
    const value = new URL(window.location.href).searchParams.get("social");
    return VALID_TABS.has(value) ? value : null;
  }

  function setActiveTab(tab, updateUrl) {
    const nextTab = VALID_TABS.has(tab) ? tab : "play";
    viewState.activeTab = nextTab;

    Object.entries(refs.tabButtons).forEach(([id, button]) => {
      const active = id === nextTab;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
      button.tabIndex = active ? 0 : -1;
    });
    Object.entries(refs.panels).forEach(([id, panel]) => {
      panel.hidden = id !== nextTab;
    });

    if (updateUrl) {
      const url = new URL(window.location.href);
      url.searchParams.set("social", nextTab);
      window.history.replaceState({}, "", url);
    }
  }

  function handleTabKeydown(event) {
    const order = ["play", "friends", "history"];
    const currentIndex = order.indexOf(event.currentTarget.dataset.socialTab);
    let nextIndex = null;
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % order.length;
    if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + order.length) % order.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = order.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    const next = order[nextIndex];
    setActiveTab(next, true);
    refs.tabButtons[next].focus();
  }

  function getLatestRpc(functionName, predicate = null) {
    const values = [...(window.triviaRushSocialRpcCache?.values?.() || [])]
      .filter((entry) => entry.functionName === functionName)
      .filter((entry) => !predicate || predicate(entry))
      .sort((left, right) => right.receivedAt - left.receivedAt);
    return values[0]?.data ?? null;
  }

  function getLegacyRows(container) {
    return container ? [...container.querySelectorAll(":scope > .social-row")] : [];
  }

  function getRowText(row) {
    return {
      primary: row?.querySelector(".social-row-copy strong")?.textContent?.trim() || "",
      secondary: row?.querySelector(".social-row-copy small")?.textContent?.trim() || ""
    };
  }

  function findLegacyRow(container, displayName, accountNumber) {
    const name = String(displayName || "").trim().toLowerCase();
    const account = accountNumber == null ? "" : String(accountNumber);
    return getLegacyRows(container).find((row) => {
      const copy = getRowText(row);
      return copy.primary.toLowerCase().includes(name)
        && (!account || copy.secondary.includes(account));
    }) || null;
  }

  function createAvatar(name, accentIndex = 0) {
    const avatar = document.createElement("span");
    avatar.className = `social-avatar social-avatar-${accentIndex % 4}`;
    avatar.textContent = String(name || "?").trim().charAt(0).toUpperCase() || "?";
    avatar.setAttribute("aria-hidden", "true");
    return avatar;
  }

  function createCompactRow({ name, status, statusClass, actionLabel, actionClass, proxyButton, menuItems = [], accentIndex = 0 }) {
    const row = document.createElement("article");
    row.className = "social-compact-row";
    row.appendChild(createAvatar(name, accentIndex));

    const nameBlock = document.createElement("div");
    nameBlock.className = "social-compact-copy";
    const strong = document.createElement("strong");
    strong.textContent = name || "Unknown player";
    const small = document.createElement("small");
    small.className = statusClass ? `social-status-copy ${statusClass}` : "social-status-copy";
    small.textContent = status || "";
    nameBlock.append(strong, small);
    row.appendChild(nameBlock);

    const controls = document.createElement("div");
    controls.className = "social-compact-controls";
    if (actionLabel) {
      const action = document.createElement("button");
      action.type = "button";
      action.className = actionClass || "social-row-button";
      action.textContent = actionLabel;
      action.disabled = !proxyButton;
      if (proxyButton) action.dataset.proxyId = ensureProxyId(proxyButton);
      controls.appendChild(action);
    }

    if (menuItems.length) {
      const details = document.createElement("details");
      details.className = "social-more-menu";
      const summary = document.createElement("summary");
      summary.setAttribute("aria-label", `More actions for ${name}`);
      summary.textContent = "•••";
      details.appendChild(summary);
      const menu = document.createElement("div");
      menu.className = "social-more-menu-popover";
      menuItems.forEach(({ label, proxyButton: menuProxy, destructive }) => {
        if (!menuProxy) return;
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.dataset.proxyId = ensureProxyId(menuProxy);
        if (destructive) button.classList.add("destructive");
        menu.appendChild(button);
      });
      details.appendChild(menu);
      controls.appendChild(details);
    }

    row.appendChild(controls);
    return row;
  }

  let proxyCounter = 0;
  function ensureProxyId(button) {
    if (!button.dataset.socialProxyId) {
      proxyCounter += 1;
      button.dataset.socialProxyId = `socialProxy-${proxyCounter}`;
    }
    return button.dataset.socialProxyId;
  }

  function findProxyButton(proxyId) {
    return proxyId
      ? document.querySelector(`[data-social-proxy-id="${CSS.escape(proxyId)}"]`)
      : null;
  }

  function handleProxyAction(event) {
    const target = event.target.closest("[data-proxy-id]");
    if (!target) return;
    const proxy = findProxyButton(target.dataset.proxyId);
    if (!proxy) return;
    const opensConfiguration = ["Live", "Take turns"].includes(proxy.textContent.trim());
    proxy.click();
    if (opensConfiguration) {
      window.setTimeout(() => openDuelConfiguration(), 0);
    }
    target.closest("details")?.removeAttribute("open");
  }

  function openDuelConfiguration() {
    if (refs.duelConfigDialog && !refs.duelConfigDialog.open) {
      refs.duelConfigDialog.showModal();
    }
  }

  function renderActiveChallenges() {
    if (!refs.activeChallengeView) return;
    const invitations = asArray(getLatestRpc("get_duel_invitations"));
    const turnData = getLatestRpc("get_turn_challenges") || {};
    const active = asArray(turnData.active);
    const recentClosed = asArray(turnData.recent_closed);
    const rows = [];

    invitations.forEach((invite, index) => {
      const legacy = findLegacyRow(refs.duelInvitations, invite.host_display_name, invite.host_account_number);
      rows.push(createCompactRow({
        name: invite.host_display_name,
        status: "Live room",
        statusClass: "status-live",
        actionLabel: "Join",
        actionClass: "social-row-button outline-teal",
        proxyButton: findAction(legacy, ["Accept", "Join"]),
        accentIndex: index
      }));
    });

    active.forEach((challenge, index) => {
      const legacy = findLegacyRow(refs.turnChallenges, challenge.opponent_display_name, challenge.opponent_account_number);
      const action = findAction(legacy, ["Play", "Resume", "View"]);
      const menuItems = [
        { label: "Decline", proxyButton: findAction(legacy, ["Decline"]), destructive: true },
        { label: "Cancel", proxyButton: findAction(legacy, ["Cancel"]), destructive: true }
      ];
      const isYourTurn = challenge.can_start
        || (["host_turn", "guest_turn"].includes(challenge.status) && challenge.self_round_status !== "completed");
      const status = isYourTurn ? "Your turn" : "Waiting for opponent";
      rows.push(createCompactRow({
        name: challenge.opponent_display_name,
        status,
        statusClass: isYourTurn ? "status-turn" : "status-waiting",
        actionLabel: action?.textContent?.trim() || "View",
        actionClass: isYourTurn ? "social-row-button primary-small" : "social-row-button outline-violet",
        proxyButton: action,
        menuItems,
        accentIndex: invitations.length + index
      }));
    });

    const savedDuel = readSavedDuel();
    if (savedDuel && savedDuel.matchFormat === "live" && invitations.length === 0) {
      const resume = document.createElement("button");
      resume.type = "button";
      resume.hidden = true;
      resume.addEventListener("click", () => window.location.reload());
      refs.legacyDepot.appendChild(resume);
      rows.push(createCompactRow({
        name: "Current live room",
        status: "Live room",
        statusClass: "status-live",
        actionLabel: "View",
        actionClass: "social-row-button outline-teal",
        proxyButton: resume,
        accentIndex: rows.length
      }));
    }

    if (viewState.challengesExpanded) {
      recentClosed.forEach((challenge, index) => {
        rows.push(createCompactRow({
          name: challenge.opponent_display_name,
          status: formatClosedStatus(challenge),
          statusClass: "status-cancelled",
          accentIndex: rows.length + index
        }));
      });
    }

    refs.activeChallengeView.replaceChildren();
    const visibleRows = viewState.challengesExpanded ? rows : rows.slice(0, 3);
    if (!visibleRows.length) {
      refs.activeChallengeView.appendChild(createEmptyState("No active challenges."));
    } else {
      refs.activeChallengeView.append(...visibleRows);
    }

    const hasMore = rows.length > 3 || recentClosed.length > 0;
    refs.viewAllChallengesButton.hidden = !hasMore;
    refs.viewAllChallengesButton.textContent = viewState.challengesExpanded
      ? "Show active only⌃"
      : "View all challenges ›";
  }

  function renderFriends() {
    if (!refs.friendView) return;
    const dashboard = getLatestRpc("get_social_dashboard") || {};
    const friends = asArray(dashboard.friends);
    const activeNames = new Set([
      ...asArray(getLatestRpc("get_turn_challenges")?.active).map((item) => String(item.opponent_display_name || "").toLowerCase()),
      ...asArray(getLatestRpc("get_duel_invitations")).map((item) => String(item.host_display_name || "").toLowerCase())
    ]);

    refs.friendCount.textContent = String(friends.length);
    refs.friendView.replaceChildren();
    if (!friends.length) {
      refs.friendView.appendChild(createEmptyState("Add a friend by their account number."));
      return;
    }

    friends.forEach((friend, index) => {
      const legacy = findLegacyRow(refs.friendsList, friend.display_name, friend.account_number);
      const liveButton = findAction(legacy, ["Live"]);
      const turnsButton = findAction(legacy, ["Take turns"]);
      const removeButton = findAction(legacy, ["Remove"]);
      const presence = getFriendPresence(friend, activeNames.has(String(friend.display_name || "").toLowerCase()));
      refs.friendView.appendChild(createCompactRow({
        name: friend.display_name,
        status: presence.label,
        statusClass: presence.className,
        actionLabel: "Challenge",
        actionClass: "social-row-button primary-small",
        proxyButton: liveButton,
        menuItems: [
          { label: "Live duel", proxyButton: liveButton },
          { label: "Take turns", proxyButton: turnsButton },
          { label: "Remove friend", proxyButton: removeButton, destructive: true }
        ],
        accentIndex: index
      }));
    });
  }

  function renderRequests() {
    if (!refs.requestView) return;
    const dashboard = getLatestRpc("get_social_dashboard") || {};
    const incoming = asArray(dashboard.incoming);
    const outgoing = asArray(dashboard.outgoing);
    refs.requestView.replaceChildren();

    incoming.forEach((request, index) => {
      const legacy = findLegacyRow(refs.friendRequests, request.display_name, request.account_number);
      const row = createCompactRow({
        name: request.display_name,
        status: `Account #${request.account_number}`,
        statusClass: "status-neutral",
        accentIndex: index
      });
      const controls = row.querySelector(".social-compact-controls");
      const accept = createIconProxyButton("✓", `Accept request from ${request.display_name}`, findAction(legacy, ["Accept"]), "accept");
      const decline = createIconProxyButton("×", `Decline request from ${request.display_name}`, findAction(legacy, ["Decline"]), "decline");
      controls.append(accept, decline);
      refs.requestView.appendChild(row);
    });

    outgoing.forEach((request, index) => {
      refs.requestView.appendChild(createCompactRow({
        name: request.display_name,
        status: "Request sent",
        statusClass: "status-waiting",
        accentIndex: incoming.length + index
      }));
    });

    if (!incoming.length && !outgoing.length) {
      refs.requestView.appendChild(createEmptyState("No pending requests."));
    }
  }

  function createIconProxyButton(symbol, label, proxy, variant) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `social-icon-action ${variant}`;
    button.textContent = symbol;
    button.setAttribute("aria-label", label);
    button.disabled = !proxy;
    if (proxy) button.dataset.proxyId = ensureProxyId(proxy);
    return button;
  }

  function setHistoryFormat(format) {
    viewState.historyFormat = VALID_HISTORY_FORMATS.has(format) ? format : "all";
    viewState.historyVisible = HISTORY_PAGE_SIZE;
    refs.historyFormatGroup.querySelectorAll("[data-history-format]").forEach((button) => {
      const active = button.dataset.historyFormat === viewState.historyFormat;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    renderHistory();
  }

  function renderHistory() {
    if (!refs.historyView) return;
    const rows = asArray(getLatestRpc("get_duel_match_history_v2", (entry) => {
      return String(entry.parameters?.p_match_format || "all") === "all";
    }));

    const wins = rows.filter((match) => normaliseOutcome(match) === "win").length;
    const completed = rows.filter((match) => !["cancelled", "canceled"].includes(normaliseOutcome(match))).length;
    const winRate = completed ? Math.round((wins / completed) * 100) : 0;
    document.querySelector("#socialTotalMatches")?.replaceChildren(document.createTextNode(String(rows.length)));
    document.querySelector("#socialTotalWins")?.replaceChildren(document.createTextNode(String(wins)));
    document.querySelector("#socialWinRate")?.replaceChildren(document.createTextNode(`${winRate}%`));

    const filtered = rows.filter((match) => {
      return viewState.historyFormat === "all" || String(match.match_format || "live") === viewState.historyFormat;
    });
    const visible = filtered.slice(0, viewState.historyVisible);
    refs.historyView.replaceChildren();

    if (!visible.length) {
      const legacyRows = getLegacyRows(refs.duelHistory);
      if (!rows.length && legacyRows.length) {
        legacyRows.slice(0, viewState.historyVisible).forEach((legacy) => refs.historyView.appendChild(createFallbackHistoryRow(legacy)));
      } else {
        refs.historyView.appendChild(createEmptyState("No completed matches for this filter."));
      }
    } else {
      visible.forEach((match) => refs.historyView.appendChild(createHistoryRow(match)));
    }

    refs.loadOlderHistoryButton.hidden = filtered.length <= viewState.historyVisible;
  }

  function createHistoryRow(match) {
    const outcome = normaliseOutcome(match);
    const row = document.createElement("article");
    row.className = "social-history-row";

    const result = document.createElement("strong");
    result.className = `social-match-result result-${outcome}`;
    result.textContent = formatOutcome(outcome);

    const copy = document.createElement("div");
    copy.className = "social-history-copy";
    const name = document.createElement("strong");
    name.textContent = match.opponent_display_name || "Unknown player";
    const details = document.createElement("small");
    const score = formatMatchScore(match);
    const type = match.match_format === "turn_based" ? "Turn-based" : "Live";
    const date = formatMatchDate(match.completed_at || match.closed_at || match.updated_at || match.created_at);
    details.textContent = [score, type, date].filter(Boolean).join(" · ");
    copy.append(name, details);

    const view = document.createElement("button");
    view.type = "button";
    view.className = "social-row-button outline-violet";
    view.textContent = "View";
    view.addEventListener("click", () => openHistoryDetails(match));

    row.append(result, copy, view);
    return row;
  }

  function createFallbackHistoryRow(legacy) {
    const copyText = getRowText(legacy);
    const outcome = copyText.primary.split(" ")[0].toLowerCase();
    const name = copyText.primary.replace(/^\S+\s+vs\s+/i, "") || "Opponent";
    return createHistoryRow({
      outcome,
      opponent_display_name: name,
      match_format: /turn-based/i.test(copyText.secondary) ? "turn_based" : "live",
      fallback_details: copyText.secondary
    });
  }

  function openHistoryDetails(match) {
    const container = refs.historyDialog.querySelector("#historyMatchDetails");
    const outcome = formatOutcome(normaliseOutcome(match));
    const score = formatMatchScore(match);
    const type = match.match_format === "turn_based" ? "Turn-based" : "Live";
    const date = formatMatchDate(match.completed_at || match.closed_at || match.updated_at || match.created_at);
    const category = match.category_id ? formatCategoryLabel(match.category_id) : "";
    const duration = Number(match.duration_seconds) ? `${Number(match.duration_seconds)} seconds` : "";
    container.replaceChildren();
    const title = document.createElement("h2");
    title.textContent = `${outcome} against ${match.opponent_display_name || "opponent"}`;
    const list = document.createElement("dl");
    [
      ["Score", score],
      ["Format", type],
      ["Date", date],
      ["Category", category],
      ["Round", duration]
    ].filter(([, value]) => value).forEach(([label, value]) => {
      const dt = document.createElement("dt");
      dt.textContent = label;
      const dd = document.createElement("dd");
      dd.textContent = value;
      list.append(dt, dd);
    });
    container.append(title, list);
    if (!refs.historyDialog.open) refs.historyDialog.showModal();
  }

  function refreshDuelLeaderboardOnMainPage() {
    window.setTimeout(() => {
      const active = document.querySelector("[data-duel-leaderboard-format].active")
        || document.querySelector("[data-duel-leaderboard-format='all']");
      active?.click();
    }, 0);
  }

  function closeNotificationDialog(returnToPrevious = true) {
    if (refs.notificationDialog?.open) refs.notificationDialog.close();
    if (returnToPrevious && refs.socialScreen.classList.contains("active") && refs.notificationReturnScreen) {
      refs.closeSocialButton?.click();
    }
    refs.notificationReturnScreen = null;
  }

  function findAction(row, labels) {
    if (!row) return null;
    return [...row.querySelectorAll("button")].find((button) => labels.includes(button.textContent.trim())) || null;
  }

  function getFriendPresence(friend, inGame) {
    if (inGame) return { label: "In a game", className: "status-turn" };
    if (friend.presence_status) {
      const value = String(friend.presence_status).toLowerCase();
      return { label: friend.presence_status, className: value === "online" ? "status-online" : "status-neutral" };
    }
    if (friend.is_online === true) return { label: "Online", className: "status-online" };
    return { label: `Friend · #${friend.account_number}`, className: "status-neutral" };
  }

  function normaliseOutcome(match) {
    const raw = String(match.outcome || match.result || match.status || "").toLowerCase();
    if (["win", "won", "victory"].includes(raw)) return "win";
    if (["loss", "lost", "defeat"].includes(raw)) return "loss";
    if (["cancelled", "canceled", "declined", "expired"].includes(raw)) return "cancelled";
    if (raw === "forfeit") {
      return Number(match.player_score || 0) >= Number(match.opponent_score || 0) ? "win" : "loss";
    }
    if (raw === "draw") return "draw";
    return raw || "cancelled";
  }

  function formatOutcome(outcome) {
    return outcome.charAt(0).toUpperCase() + outcome.slice(1);
  }

  function formatMatchScore(match) {
    if (match.fallback_details) return match.fallback_details;
    const player = Number(match.player_score);
    const opponent = Number(match.opponent_score);
    return Number.isFinite(player) && Number.isFinite(opponent) ? `${player}–${opponent}` : "";
  }

  function formatMatchDate(value) {
    const date = new Date(value);
    if (!value || Number.isNaN(date.getTime())) return "";
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" }).format(date);
  }

  function formatCategoryLabel(value) {
    return String(value)
      .replaceAll("_", " ")
      .replace(/\b\w/g, (character) => character.toUpperCase());
  }

  function formatClosedStatus(challenge) {
    const reason = String(challenge.closed_reason || "cancelled").toLowerCase();
    return reason.charAt(0).toUpperCase() + reason.slice(1);
  }

  function createEmptyState(message) {
    const empty = document.createElement("p");
    empty.className = "social-empty social-redesign-empty";
    empty.textContent = message;
    return empty;
  }

  function readSavedDuel() {
    try {
      const value = JSON.parse(localStorage.getItem("triviaRushActiveDuel") || "null");
      return value?.matchId ? value : null;
    } catch {
      return null;
    }
  }

  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
