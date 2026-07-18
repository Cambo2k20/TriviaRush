(() => {
  "use strict";

  const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
  if (localHosts.has(window.location.hostname)) {
    window.TRIVIA_RUSH_CONFIG = Object.freeze({ environment: "local-unconfigured" });
    return;
  }

  window.TRIVIA_RUSH_CONFIG = Object.freeze({
    supabaseUrl: "https://kgdnuzasbeavpqharbpf.supabase.co",
    supabasePublishableKey: "sb_publishable_R-AJK-addd0bcjUtfzAOqQ_88GYxN_O",
    environment: "production"
  });
})();
