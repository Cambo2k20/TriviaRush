(() => {
  "use strict";

  const root = document.documentElement;
  const isDiscordActivity = window.location.hostname.endsWith(".discordsays.com");
  let sdkPollTimer = null;

  function getViewportSize() {
    return {
      width: window.visualViewport?.width ?? window.innerWidth,
      height: window.visualViewport?.height ?? window.innerHeight
    };
  }

  function updateViewportDensity() {
    const { width, height } = getViewportSize();
    let density = "full";

    if (width < 760) {
      density = "mobile";
    } else if (width < 980 || height < 620) {
      density = "tight";
    } else if (width < 1280 || height < 760) {
      density = "compact";
    }

    root.dataset.viewportDensity = density;
    root.dataset.screenOrientation = width >= height ? "landscape" : "portrait";
  }

  function convertLayoutModeToName(layoutMode) {
    const modes = window.DiscordEmbeddedApp?.Common?.LayoutModeTypeObject ?? {
      FOCUSED: 0,
      PIP: 1,
      GRID: 2
    };

    if (layoutMode === modes.PIP) return "pip";
    if (layoutMode === modes.GRID) return "grid";
    return "focused";
  }

  function handleLayoutModeUpdate(update) {
    root.dataset.discordLayout = convertLayoutModeToName(update?.layout_mode);
  }

  async function subscribeToLayoutModeUpdatesCompat(sdk) {
    if (typeof sdk.subscribeToLayoutModeUpdatesCompat === "function") {
      await sdk.subscribeToLayoutModeUpdatesCompat(handleLayoutModeUpdate);
      return;
    }

    const layoutEvent = window.DiscordEmbeddedApp?.Events?.ACTIVITY_LAYOUT_MODE_UPDATE
      ?? "ACTIVITY_LAYOUT_MODE_UPDATE";
    await sdk.subscribe(layoutEvent, handleLayoutModeUpdate);
  }

  async function connectDiscordLayout() {
    if (!isDiscordActivity) return;

    const sdk = window.__discordSdk;
    if (!sdk) {
      sdkPollTimer = window.setTimeout(connectDiscordLayout, 50);
      return;
    }

    try {
      await subscribeToLayoutModeUpdatesCompat(sdk);
      await sdk.commands?.setConfig?.({ use_interactive_pip: true });
      root.dataset.discordSdk = "ready";
    } catch (error) {
      root.dataset.discordSdk = "unavailable";
      console.warn("Discord layout updates unavailable:", error);
    }
  }

  root.dataset.discordHost = isDiscordActivity ? "activity" : "browser";
  root.dataset.discordLayout = "focused";
  updateViewportDensity();

  window.addEventListener("resize", updateViewportDensity, { passive: true });
  window.visualViewport?.addEventListener("resize", updateViewportDensity, { passive: true });
  window.addEventListener("pagehide", () => {
    if (sdkPollTimer !== null) window.clearTimeout(sdkPollTimer);
  }, { once: true });

  void connectDiscordLayout();
})();
