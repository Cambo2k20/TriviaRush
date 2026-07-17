import { readFileSync, writeFileSync } from "node:fs";

const cssPath = "home-redesign.css";
const indexPath = "index.html";
const testPath = "home-redesign-smoke-test.mjs";

const marker = "/* viewport-height-fit:start */";
const responsiveBlock = `
/* viewport-height-fit:start */
@media (min-width: 921px) {
  body.home-redesign-active {
    --home-header-height: clamp(68px, 9.5dvh, 90px);
    --home-footer-height: clamp(48px, 7dvh, 66px);
    --home-main-height: calc(100dvh - var(--home-header-height) - var(--home-footer-height));
  }

  body.home-redesign-active .topbar {
    min-height: var(--home-header-height);
  }

  body.home-redesign-active footer {
    min-height: var(--home-footer-height);
  }

  #startScreen.home-screen-v2 {
    min-height: var(--home-main-height);
    padding-top: clamp(12px, 2.4dvh, 32px);
    padding-bottom: clamp(8px, 1.4dvh, 20px);
    row-gap: clamp(10px, 1.7dvh, 24px);
  }

  .home-hero-v2 {
    padding-block: clamp(4px, 1dvh, 14px);
  }

  .home-hero-v2 .eyebrow {
    margin-bottom: clamp(10px, 1.8dvh, 20px);
  }

  .home-hero-v2 h1 {
    font-size: clamp(3.4rem, min(6.7vw, 10.5dvh), 7.3rem);
  }

  .home-hero-copy {
    margin: clamp(12px, 2dvh, 28px) 0 clamp(14px, 2.4dvh, 34px);
    font-size: clamp(0.92rem, 1.2vw, 1.18rem);
    line-height: 1.55;
  }

  .home-selection-row {
    margin-bottom: clamp(12px, 2dvh, 28px);
  }

  .home-start-button {
    min-height: clamp(52px, 7dvh, 70px);
  }

  .home-start-status {
    margin-top: clamp(6px, 1dvh, 12px);
  }

  .home-stats-v2 {
    margin-top: clamp(12px, 2dvh, 28px);
  }

  .home-stat-v2 {
    min-height: clamp(48px, 6.5dvh, 68px);
  }

  .home-controls-hint {
    margin-top: clamp(8px, 1.5dvh, 24px);
  }

  .home-category-browser {
    height: clamp(420px, calc(100dvh - 300px), 660px);
  }

  .home-category-heading {
    margin-bottom: clamp(10px, 1.8dvh, 20px);
  }

  .home-category-card {
    min-height: clamp(84px, 12dvh, 116px);
    padding-block: clamp(12px, 1.8dvh, 18px);
  }

  .home-quick-actions {
    min-height: clamp(54px, 7.5dvh, 88px);
  }

  .home-quick-action {
    padding-block: clamp(12px, 2dvh, 24px);
  }
}

@media (min-width: 921px) and (max-height: 760px) {
  .home-controls-hint {
    display: none;
  }

  .home-category-mark {
    width: 44px;
    height: 44px;
    font-size: 1.65rem;
  }

  .home-category-heading h2 {
    font-size: 1.5rem;
  }

  .home-category-icon {
    width: 44px;
    height: 44px;
  }

  .home-category-icon svg {
    width: 39px;
    height: 39px;
  }
}

@supports not (height: 100dvh) {
  @media (min-width: 921px) {
    body.home-redesign-active {
      --home-header-height: clamp(68px, 9.5vh, 90px);
      --home-footer-height: clamp(48px, 7vh, 66px);
      --home-main-height: calc(100vh - var(--home-header-height) - var(--home-footer-height));
    }

    .home-hero-v2 h1 {
      font-size: clamp(3.4rem, min(6.7vw, 10.5vh), 7.3rem);
    }

    .home-category-browser {
      height: clamp(420px, calc(100vh - 300px), 660px);
    }
  }
}
/* viewport-height-fit:end */
`;

let css = readFileSync(cssPath, "utf8");
if (!css.includes(marker)) {
  const reducedMotionMarker = "@media (prefers-reduced-motion: reduce)";
  if (!css.includes(reducedMotionMarker)) {
    throw new Error("Could not find reduced-motion block in home-redesign.css");
  }
  css = css.replace(reducedMotionMarker, `${responsiveBlock}\n${reducedMotionMarker}`);
  writeFileSync(cssPath, css);
}

let html = readFileSync(indexPath, "utf8");
html = html.replace('href="home-redesign.css?v=2"', 'href="home-redesign.css?v=3"');
writeFileSync(indexPath, html);

let test = readFileSync(testPath, "utf8");
test = test.replace(
  `assert("redesign stylesheet linked", html.includes('href="home-redesign.css?v=2"'));`,
  `assert("redesign stylesheet linked", html.includes('href="home-redesign.css?v=3"'));`
);

if (!test.includes('assert("footer height reserved"')) {
  test = test.replace(
    'assert("fixed category translation removed", !styles.includes("translateY(35px)"));',
    'assert("fixed category translation removed", !styles.includes("translateY(35px)"));\nassert("footer height reserved", styles.includes("--home-footer-height") && styles.includes("--home-main-height"));\nassert("short viewport compaction included", styles.includes("max-height: 760px") && styles.includes("7.5dvh"));'
  );
}
writeFileSync(testPath, test);
