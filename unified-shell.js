(() => {
  "use strict";

  const PAGE_SCREENS = new Set([
    "startScreen",
    "socialScreen",
    "leaderboardScreen"
  ]);

  const GAME_SCREENS = new Set([
    "gameScreen",
    "duelGameScreen"
  ]);

  const FOCUS_SCREENS = new Set([
    "countdownScreen",
    "resultsScreen",
    "duelWaitingScreen",
    "duelResultsScreen"
  ]);

  let observer = null;

  function initialise() {
    const screens = [...document.querySelectorAll(".screen")];
    if (screens.length === 0) return;

    const sync = () => {
      const activeScreen = screens.find((screen) => screen.classList.contains("active"));
      const activeId = activeScreen?.id || "";
      const body = document.body;

      if (!body.classList.contains("trivia-shell-ready")) {
        body.classList.add("trivia-shell-ready");
      }

      if (body.dataset.activeScreen !== activeId) {
        body.dataset.activeScreen = activeId;
      }

      const pageActive = PAGE_SCREENS.has(activeId);
      const gameActive = GAME_SCREENS.has(activeId);
      const focusActive = FOCUS_SCREENS.has(activeId);

      if (body.classList.contains("trivia-page-active") !== pageActive) {
        body.classList.toggle("trivia-page-active", pageActive);
      }

      if (body.classList.contains("trivia-game-active") !== gameActive) {
        body.classList.toggle("trivia-game-active", gameActive);
      }

      if (body.classList.contains("trivia-focus-active") !== focusActive) {
        body.classList.toggle("trivia-focus-active", focusActive);
      }
    };

    observer = new MutationObserver(sync);
    screens.forEach((screen) => {
      observer.observe(screen, {
        attributes: true,
        attributeFilter: ["class"]
      });
    });

    sync();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialise, { once: true });
  } else {
    initialise();
  }
})();
