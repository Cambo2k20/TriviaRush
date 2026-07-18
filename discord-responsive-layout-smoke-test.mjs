import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const html = readFileSync("./index.html", "utf8");
const styles = readFileSync("./discord-responsive.css", "utf8");
const homeStyles = readFileSync("./home-redesign.css", "utf8");
const script = readFileSync("./discord-layout.js", "utf8");

const results = [];
const assert = (name, condition) => {
  results.push(`${condition ? "PASS" : "FAIL"}  ${name}`);
  if (!condition) process.exitCode = 1;
};

const cssLinks = [...html.matchAll(/<link[^>]+href="([^"]+\.css[^\"]*)"/g)]
  .map((match) => match[1]);
const responsiveIndex = cssLinks.findIndex((href) => href.startsWith("discord-responsive.css"));
const modeIndex = cssLinks.findIndex((href) => href.startsWith("mode-navigation.css"));

assert("responsive stylesheet exists and is linked", styles.length > 0 && responsiveIndex >= 0);
assert("responsive stylesheet loads after mode navigation", responsiveIndex > modeIndex);
assert("responsive stylesheet is the final CSS layer", responsiveIndex === cssLinks.length - 1);
assert("Discord layout runtime is loaded", html.includes('src="discord-layout.js?v=1"'));
assert("desktop Home layout only displays while active", /#startScreen\.home-screen-v2\.active\s*\{[^}]*display:\s*grid/s.test(styles));
assert("mobile Home layout only displays while active", /max-width:\s*759px[\s\S]*?#startScreen\.home-screen-v2\.active\s*\{[^}]*display:\s*flex/s.test(styles));
assert("inactive Home screen is never forced visible", !/#startScreen\.home-screen-v2(?!\.active)[^{]*\{[^}]*display:/s.test(styles));
assert("hero title can wrap", /\.home-hero-v2 h1\s*\{[^}]*white-space:\s*normal/s.test(homeStyles));
assert("rigid 540px home column minimum is removed", !homeStyles.includes("minmax(540px"));
assert("compact width breakpoint exists", styles.includes("max-width: 1279px"));
assert("short-height breakpoint exists", styles.includes("max-height: 619px"));
assert("category panel uses min-height zero", /\.home-category-browser\s*\{[^}]*min-height:\s*0/s.test(styles));
assert("header actions never wrap", /\.header-actions\s*\{[^}]*flex-wrap:\s*nowrap/s.test(styles));
assert("grid layout selector exists", styles.includes('data-discord-layout="grid"'));
assert("PIP layout selector exists", styles.includes('data-discord-layout="pip"'));
assert("Discord safe-area variables exist", styles.includes("--discord-safe-area-inset-bottom"));
assert("short focused layout hides the footer", /max-height:\s*620px[\s\S]*?footer\s*\{\s*display:\s*none/s.test(styles));
assert("very short landscape compacts the header", /max-height:\s*440px[\s\S]*?\.topbar\s*\{[^}]*padding-block:\s*0/s.test(styles));
assert("very short landscape removes the optional voice toggle", /max-height:\s*440px[\s\S]*?\.home-host-toggle\s*\{\s*display:\s*none/s.test(styles));
assert("mobile removes the nested category scrollbar", /max-width:\s*759px[\s\S]*?\.home-category-grid\s*\{[^}]*overflow:\s*visible/s.test(styles));
assert("game answer grid uses two columns", /\.answer-grid\s*\{[^}]*repeat\(2,/s.test(styles));
assert("narrow answer grid uses one column", /max-width:\s*620px[\s\S]*?\.answer-grid\s*\{[^}]*grid-template-columns:\s*1fr/s.test(styles));
assert("post-match summary has a dedicated overview", html.includes('class="result-overview"'));
assert("post-match card uses the wider dashboard width", /#resultsScreen \.result-card\s*\{[^}]*width:\s*min\(1080px,/s.test(styles));
assert("post-match progression uses two dashboard columns", /#resultsScreen \.result-card\s*\{[^}]*grid-template-columns:\s*repeat\(2,/s.test(styles));
assert("post-match actions remain a full-width row", /#resultsScreen \.result-actions\s*\{[^}]*grid-column:\s*1 \/ -1/s.test(styles));
assert("mobile post-match removes the nested scrollbar", /max-width:\s*759px[\s\S]*?#resultsScreen \.result-card\s*\{[^}]*max-height:\s*none;[^}]*overflow:\s*visible/s.test(styles));

const dom = new JSDOM(html, {
  url: "https://triviarush.discordsays.com/?frame_id=test&instance_id=test&platform=desktop",
  runScripts: "outside-only",
  pretendToBeVisual: true
});
const { window } = dom;
const visualViewport = new window.EventTarget();
visualViewport.width = 1024;
visualViewport.height = 600;
window.visualViewport = visualViewport;

let layoutHandler = null;
let interactivePipEnabled = false;
window.DiscordEmbeddedApp = {
  Common: {
    LayoutModeTypeObject: { FOCUSED: 0, PIP: 1, GRID: 2 }
  },
  Events: {
    ACTIVITY_LAYOUT_MODE_UPDATE: "ACTIVITY_LAYOUT_MODE_UPDATE"
  }
};
window.__discordSdk = {
  async subscribeToLayoutModeUpdatesCompat(handler) {
    layoutHandler = handler;
  },
  commands: {
    async setConfig(config) {
      interactivePipEnabled = config.use_interactive_pip === true;
    }
  }
};

window.eval(script);
await new Promise((resolve) => window.setTimeout(resolve, 0));

const root = window.document.documentElement;
assert("viewport density initialises from actual dimensions", root.dataset.viewportDensity === "tight");
assert("screen orientation is exposed", root.dataset.screenOrientation === "landscape");
assert("Discord host is detected", root.dataset.discordHost === "activity");
assert("layout compatibility subscription is registered", typeof layoutHandler === "function");
assert("interactive PIP is enabled", interactivePipEnabled);

layoutHandler?.({ layout_mode: 2 });
assert("grid layout updates the root attribute", root.dataset.discordLayout === "grid");
layoutHandler?.({ layout_mode: 1 });
assert("PIP layout updates the root attribute", root.dataset.discordLayout === "pip");

visualViewport.width = 390;
visualViewport.height = 844;
visualViewport.dispatchEvent(new window.Event("resize"));
assert("visual viewport resize updates density", root.dataset.viewportDensity === "mobile");
assert("visual viewport resize updates orientation", root.dataset.screenOrientation === "portrait");
assert("window resize listener exists", script.includes('window.addEventListener("resize"'));
assert("layout mode updates are integrated", script.includes("subscribeToLayoutModeUpdatesCompat"));

console.log(results.join("\n"));
window.close();
