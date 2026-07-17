(() => {
  "use strict";

  const MODE_QUERY = "(max-width: 700px)";
  const ICONS = {
    solo: `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="m27 4-15 23h11l-2 17 15-24H25l2-16Z"/></svg>`,
    friends: `<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="18" cy="17" r="7"/><path d="M5 39c1-9 6-13 13-13s12 4 13 13M31 11a6 6 0 0 1 0 12M34 28c5 1 8 5 9 11"/></svg>`,
    practice: `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M9 9h30v30H9zM16 17h16M16 24h10M16 31h13"/><path d="m33 29 4 4-8 8-5 1 1-5 8-8Z"/></svg>`,
    daily: `<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="7" y="10" width="34" height="31" rx="4"/><path d="M15 5v10M33 5v10M7 19h34M15 27h6M27 27h6M15 34h6"/></svg>`
  };

  const state = {
    startScreen: null,
    menu: null,
    soloButton: null,
    friendsButton: null,
    backButton: null,
    mediaQuery: null,
    progressObserver: null
  };

  function buildModeCard({ id, className = "", icon, title, description, disabled = false, badge = "" }) {
    const button = document.createElement("button");
    button.id = id;
    button.type = "button";
    button.className = `mobile-mode-card ${className}`.trim();
    button.disabled = disabled;
    if (disabled) button.setAttribute("aria-disabled", "true");

    const iconElement = document.createElement("span");
    iconElement.className = "mobile-mode-icon";
    iconElement.innerHTML = ICONS[icon];

    const copy = document.createElement("span");
    copy.className = "mobile-mode-copy";

    const titleElement = document.createElement("strong");
    titleElement.textContent = title;
    const descriptionElement = document.createElement("span");
    descriptionElement.textContent = description;
    copy.append(titleElement, descriptionElement);

    button.append(iconElement, copy);

    if (badge) {
      const badgeElement = document.createElement("span");
      badgeElement.className = "mobile-mode-coming-soon";
      badgeElement.textContent = badge;
      copy.appendChild(badgeElement);
    } else {
      const arrow = document.createElement("span");
      arrow.className = "mobile-mode-arrow";
      arrow.setAttribute("aria-hidden", "true");
      arrow.textContent = "›";
      button.appendChild(arrow);
    }

    return button;
  }

  function buildModeMenu() {
    const menu = document.createElement("section");
    menu.id = "mobileModeMenu";
    menu.className = "mobile-mode-menu";
    menu.setAttribute("aria-labelledby", "mobileModeTitle");

    const heading = document.createElement("header");
    heading.className = "mobile-mode-heading";
    heading.innerHTML = `
      <span class="mobile-mode-eyebrow">Choose your challenge</span>
      <h1 id="mobileModeTitle">How do you want to <span>play?</span></h1>
      <p>Pick a mode first. You can choose a category and settings on the next screen.</p>
    `;

    const list = document.createElement("div");
    list.className = "mobile-mode-list";

    const solo = buildModeCard({
      id: "mobileSoloMode",
      className: "featured",
      icon: "solo",
      title: "Solo Rush",
      description: "Race the 60-second clock, build a high score and earn global XP."
    });

    const friends = buildModeCard({
      id: "mobileFriendsMode",
      className: "friends",
      icon: "friends",
      title: "Play with friends",
      description: "Create a live room or continue a turn-based challenge."
    });

    const secondaryGrid = document.createElement("div");
    secondaryGrid.className = "mobile-mode-secondary-grid";
    secondaryGrid.append(
      buildModeCard({
        id: "mobilePracticeMode",
        className: "compact practice",
        icon: "practice",
        title: "Practice",
        description: "Learn without score pressure.",
        disabled: true,
        badge: "Coming soon"
      }),
      buildModeCard({
        id: "mobileDailyMode",
        className: "compact daily",
        icon: "daily",
        title: "Daily Challenge",
        description: "A fresh shared challenge each day.",
        disabled: true,
        badge: "Coming soon"
      })
    );

    list.append(solo, friends, secondaryGrid);

    const progress = document.createElement("div");
    progress.className = "mobile-mode-progress";
    progress.setAttribute("aria-label", "Player progress");
    progress.innerHTML = `
      <div><span>High score</span><strong id="mobileModeHighScore">0</strong></div>
      <div><span>Best streak</span><strong id="mobileModeBestStreak">0</strong></div>
      <div><span>Global level</span><strong>LV <span id="mobileModeLevel">1</span></strong></div>
    `;

    menu.append(heading, list, progress);
    state.soloButton = solo;
    state.friendsButton = friends;
    return menu;
  }

  function buildBackButton() {
    const button = document.createElement("button");
    button.id = "mobileSoloBack";
    button.className = "mobile-solo-back";
    button.type = "button";
    button.innerHTML = `<span aria-hidden="true">‹</span><span>Game modes</span>`;
    return button;
  }

  function setStage(stage, focusTarget = null) {
    if (!state.startScreen || !["modes", "solo"].includes(stage)) return;
    state.startScreen.dataset.mobileHomeStage = stage;

    if (state.mediaQuery?.matches) {
      try {
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch {
        window.scrollTo?.(0, 0);
      }
      window.setTimeout(() => focusTarget?.focus(), 0);
    }
  }

  function syncProgress() {
    const mappings = [
      ["startHighScore", "mobileModeHighScore"],
      ["startBestStreak", "mobileModeBestStreak"],
      ["homeGlobalLevel", "mobileModeLevel"]
    ];

    mappings.forEach(([sourceId, targetId]) => {
      const source = document.getElementById(sourceId);
      const target = document.getElementById(targetId);
      if (source && target) target.textContent = source.textContent?.trim() || "0";
    });
  }

  function observeProgress() {
    const sources = ["startHighScore", "startBestStreak", "homeGlobalLevel"]
      .map((id) => document.getElementById(id))
      .filter(Boolean);

    if (sources.length === 0) return;
    state.progressObserver = new MutationObserver(syncProgress);
    sources.forEach((source) => {
      state.progressObserver.observe(source, {
        childList: true,
        characterData: true,
        subtree: true
      });
    });
    syncProgress();
  }

  function initialise() {
    state.startScreen = document.getElementById("startScreen");
    const hero = state.startScreen?.querySelector(".home-hero-v2");
    if (!state.startScreen || !hero || document.getElementById("mobileModeMenu")) return;

    state.mediaQuery = window.matchMedia?.(MODE_QUERY) || { matches: false };
    state.menu = buildModeMenu();
    state.backButton = buildBackButton();

    state.startScreen.dataset.mobileHomeStage = "modes";
    state.startScreen.prepend(state.menu);
    hero.prepend(state.backButton);

    state.soloButton.addEventListener("click", () => setStage("solo", state.backButton));
    state.backButton.addEventListener("click", () => setStage("modes", state.soloButton));
    state.friendsButton.addEventListener("click", () => {
      document.getElementById("duelButton")?.click();
    });

    document.getElementById("homeButton")?.addEventListener("click", () => {
      setStage("solo");
    });

    observeProgress();
    document.body.classList.add("mobile-mode-menu-ready");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialise, { once: true });
  } else {
    initialise();
  }
})();
