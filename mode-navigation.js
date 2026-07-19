(() => {
  "use strict";

  const SOLO_SCREENS = new Set([
    "startScreen",
    "countdownScreen",
    "gameScreen",
    "resultsScreen"
  ]);

  const ONLINE_SCREENS = new Set([
    "socialScreen",
    "duelWaitingScreen",
    "duelGameScreen",
    "duelResultsScreen"
  ]);

  const LOCKED_SCREENS = new Set([
    "countdownScreen",
    "gameScreen",
    "duelWaitingScreen",
    "duelGameScreen"
  ]);

  const state = {
    selectedMode: "solo",
    observer: null,
    screens: [],
    soloButton: null,
    onlineButton: null,
    topbar: null,
    headerActions: null,
    mobileQuery: null
  };

  function getActiveScreen() {
    return state.screens.find((screen) => screen.classList.contains("active")) || null;
  }

  function setSelectedMode(mode) {
    if (mode !== "solo" && mode !== "online") return;
    state.selectedMode = mode;
    syncControls();
  }

  function syncControls() {
    const activeScreen = getActiveScreen();
    const activeId = activeScreen?.id || "";

    if (SOLO_SCREENS.has(activeId)) {
      state.selectedMode = "solo";
    } else if (ONLINE_SCREENS.has(activeId)) {
      state.selectedMode = "online";
    }

    const locked = LOCKED_SCREENS.has(activeId);

    [
      [state.soloButton, "solo"],
      [state.onlineButton, "online"]
    ].forEach(([button, mode]) => {
      if (!button) return;
      const selected = state.selectedMode === mode;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
      if (selected) {
        button.setAttribute("aria-current", "page");
      } else {
        button.removeAttribute("aria-current");
      }
    });

    if (state.soloButton) {
      state.soloButton.disabled = locked;
    }
  }

  function clickAndWait(button, callback) {
    button?.click();
    window.setTimeout(callback, 0);
  }

  function navigateToSolo() {
    const activeScreen = getActiveScreen();
    const activeId = activeScreen?.id || "";

    if (LOCKED_SCREENS.has(activeId)) return;

    if (activeId === "startScreen") {
      setSelectedMode("solo");
      return;
    }

    if (activeId === "resultsScreen") {
      clickAndWait(document.querySelector("#homeButton"), syncControls);
      return;
    }

    if (activeId === "socialScreen") {
      clickAndWait(document.querySelector("#closeSocialButton"), syncControls);
      return;
    }

    if (activeId === "duelResultsScreen") {
      clickAndWait(document.querySelector("#duelResultsHomeButton"), () => {
        clickAndWait(document.querySelector("#closeSocialButton"), syncControls);
      });
      return;
    }

    if (activeId === "leaderboardScreen") {
      clickAndWait(document.querySelector("#closeLeaderboardButton"), () => {
        if (getActiveScreen()?.id === "socialScreen") {
          clickAndWait(document.querySelector("#closeSocialButton"), syncControls);
        } else {
          syncControls();
        }
      });
      return;
    }

    setSelectedMode("solo");
  }

  function createSoloButton() {
    const button = document.createElement("button");
    button.id = "soloModeButton";
    button.className = "mode-nav-button solo-mode-button";
    button.type = "button";
    button.setAttribute("aria-label", "Open Solo mode");
    button.setAttribute("aria-pressed", "true");
    button.innerHTML = `
      <span class="mode-nav-icon" aria-hidden="true">⚡</span>
      <span>Solo</span>
    `;
    button.addEventListener("click", navigateToSolo);
    return button;
  }

  function configureOnlineButton(button) {
    button.classList.add("mode-nav-button", "online-mode-button");
    button.style.setProperty("--mode-accent", "#25e7d1");
    button.setAttribute("aria-label", "Open Online mode");
    button.setAttribute("aria-pressed", "false");

    const icon = button.querySelector("span:first-child");
    if (icon) {
      icon.classList.add("mode-nav-icon");
      icon.textContent = "◉";
    }

    const label = document.querySelector("#duelButtonText");
    if (label) label.textContent = "Online";
  }

  function configureUtility(button, label) {
    if (!button) return;
    button.classList.add("mobile-utility-button");
    button.dataset.mobileLabel = label;
  }

  function placeUtilityDock() {
    if (!state.topbar || !state.headerActions || !state.mobileQuery) return;

    if (state.mobileQuery.matches) {
      if (state.headerActions.parentElement !== document.body) {
        document.body.appendChild(state.headerActions);
      }
    } else if (state.headerActions.parentElement !== state.topbar) {
      state.topbar.appendChild(state.headerActions);
    }
  }

  function initialise() {
    const topbar = document.querySelector(".topbar");
    const brand = topbar?.querySelector(".brand");
    const headerActions = topbar?.querySelector(".header-actions");
    const onlineButton = document.querySelector("#duelButton");

    if (!topbar || !brand || !headerActions || !onlineButton || document.querySelector("#modeNavigation")) {
      return;
    }

    state.screens = [...document.querySelectorAll(".screen")];
    state.soloButton = createSoloButton();
    state.onlineButton = onlineButton;
    state.topbar = topbar;
    state.headerActions = headerActions;
    state.mobileQuery = window.matchMedia?.("(max-width: 700px)") || {
      matches: false,
      addEventListener() {}
    };

    configureOnlineButton(onlineButton);

    const navigation = document.createElement("nav");
    navigation.id = "modeNavigation";
    navigation.className = "mode-navigation";
    navigation.setAttribute("aria-label", "Game modes");
    navigation.append(state.soloButton, onlineButton);
    topbar.insertBefore(navigation, headerActions);

    configureUtility(document.querySelector("#notificationButton"), "Alerts");
    configureUtility(document.querySelector("#leaderboardButton"), "Rankings");
    configureUtility(document.querySelector("#accountButton"), "Account");
    configureUtility(document.querySelector("#soundToggle"), "Sound");
    state.mobileQuery.addEventListener?.("change", placeUtilityDock);
    state.mobileQuery.addListener?.(placeUtilityDock);

    state.observer = new MutationObserver(syncControls);
    state.screens.forEach((screen) => {
      state.observer.observe(screen, {
        attributes: true,
        attributeFilter: ["class"]
      });
    });

    document.body.classList.add("shared-mode-navigation-ready");
    placeUtilityDock();
    syncControls();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialise, { once: true });
  } else {
    initialise();
  }
})();
