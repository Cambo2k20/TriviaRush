// Regenerates the home layout without viewport-specific pixel offsets.
import { readFileSync, writeFileSync } from "node:fs";

const cssPath = "home-redesign.css";
const indexPath = "index.html";
const testPath = "home-redesign-smoke-test.mjs";

let css = readFileSync(cssPath, "utf8");

const oldDesktopLayout = `#startScreen.home-screen-v2 {
  min-height: calc(100vh - 150px);
  padding: 54px 0 26px;
  grid-template-columns: minmax(0, 0.94fr) minmax(540px, 1.06fr);
  grid-template-rows: minmax(0, 1fr) auto;
  gap: 42px 72px;
  align-items: stretch;
}`;

const newDesktopLayout = `#startScreen.home-screen-v2 {
  min-height: calc(100dvh - 90px);
  padding: clamp(24px, 5dvh, 54px) 0 clamp(20px, 3dvh, 32px);
  grid-template-columns: minmax(0, 0.94fr) minmax(540px, 1.06fr);
  grid-template-rows: minmax(0, 1fr) auto;
  column-gap: clamp(32px, 4.7vw, 72px);
  row-gap: clamp(24px, 4dvh, 42px);
  align-items: center;
}`;

if (!css.includes(oldDesktopLayout) && !css.includes(newDesktopLayout)) {
  throw new Error("Could not find the desktop home layout block.");
}
css = css.replace(oldDesktopLayout, newDesktopLayout);

const oldCategoryPanel = `.home-category-browser {
  min-height: 600px;
  max-height: 660px;
  padding: 28px 30px 22px;
  display: flex;
  flex-direction: column;`;

const newCategoryPanel = `.home-category-browser {
  width: 100%;
  height: clamp(500px, calc(100dvh - 270px), 660px);
  min-height: 0;
  max-height: none;
  padding: 28px 30px 22px;
  display: flex;
  flex-direction: column;
  align-self: center;`;

if (!css.includes(oldCategoryPanel) && !css.includes(newCategoryPanel)) {
  throw new Error("Could not find the category panel block.");
}
css = css.replace(oldCategoryPanel, newCategoryPanel);

const oldTabletPanel = `  .home-category-browser {
    min-height: 560px;
    max-height: 620px;
  }`;

const newTabletPanel = `  .home-category-browser {
    height: clamp(520px, 70dvh, 620px);
    min-height: 0;
    max-height: none;
    align-self: stretch;
  }`;

if (!css.includes(oldTabletPanel) && !css.includes(newTabletPanel)) {
  throw new Error("Could not find the tablet category panel block.");
}
css = css.replace(oldTabletPanel, newTabletPanel);

const oldMobilePanel = `  .home-category-browser {
    min-height: 0;
    max-height: none;
    padding: 22px 18px;
  }`;

const newMobilePanel = `  .home-category-browser {
    width: 100%;
    height: auto;
    min-height: 0;
    max-height: none;
    padding: 22px 18px;
    align-self: stretch;
  }`;

if (!css.includes(oldMobilePanel) && !css.includes(newMobilePanel)) {
  throw new Error("Could not find the mobile category panel block.");
}
css = css.replace(oldMobilePanel, newMobilePanel);

css = css.replace(
  /\n@media \(min-width: 921px\) \{\n  \.home-category-browser \{\n    align-self: center;\n(?:    transform: translateY\([^\n]+\);\n)?  \}\n\}\n/g,
  "\n"
);

const fallback = `
@supports not (height: 100dvh) {
  #startScreen.home-screen-v2 {
    min-height: calc(100vh - 90px);
  }

  .home-category-browser {
    height: clamp(500px, calc(100vh - 270px), 660px);
  }

  @media (max-width: 920px) {
    .home-category-browser {
      height: clamp(520px, 70vh, 620px);
    }
  }

  @media (max-width: 640px) {
    .home-category-browser {
      height: auto;
    }
  }
}
`;

if (!css.includes("@supports not (height: 100dvh)")) {
  const reducedMotionMarker = "@media (prefers-reduced-motion: reduce)";
  if (!css.includes(reducedMotionMarker)) {
    throw new Error("Could not find the reduced-motion block.");
  }
  css = css.replace(reducedMotionMarker, `${fallback}\n${reducedMotionMarker}`);
}

writeFileSync(cssPath, css);

let html = readFileSync(indexPath, "utf8");
html = html.replace('href="home-redesign.css?v=1"', 'href="home-redesign.css?v=2"');
writeFileSync(indexPath, html);

let test = readFileSync(testPath, "utf8");
test = test.replace(
  `assert("redesign stylesheet linked", html.includes('href="home-redesign.css?v=1"'));`,
  `assert("redesign stylesheet linked", html.includes('href="home-redesign.css?v=2"'));`
);

if (!test.includes('assert("dynamic desktop alignment used"')) {
  test = test.replace(
    'assert("responsive rules included", styles.includes("@media (max-width: 640px)"));',
    'assert("responsive rules included", styles.includes("@media (max-width: 640px)"));\nassert("dynamic desktop alignment used", styles.includes("align-items: center") && styles.includes("100dvh"));\nassert("fixed category translation removed", !styles.includes("translateY(35px)"));'
  );
}
writeFileSync(testPath, test);
