import { readFileSync, writeFileSync } from "node:fs";

const path = "social-redesign.js";
const source = readFileSync(path, "utf8");

const unsafeBlock = `    const activeObserver = new MutationObserver(() => {
      if (refs.socialScreen.classList.contains("active")) {
        refs.socialScreen.classList.add("social-page-active");
        setActiveTab(readTabFromUrl() || viewState.activeTab || "play", false);
      } else {
        refs.socialScreen.classList.remove("social-page-active");
      }
    });`;

const safeBlock = `    const activeObserver = new MutationObserver(() => {
      const isActive = refs.socialScreen.classList.contains("active");
      const hasActiveClass = refs.socialScreen.classList.contains("social-page-active");

      // This observer watches the class attribute. Only write back when the
      // derived class actually needs to change, otherwise the observer can
      // continuously trigger itself when the social screen opens.
      if (isActive !== hasActiveClass) {
        refs.socialScreen.classList.toggle("social-page-active", isActive);
      }

      if (isActive) {
        setActiveTab(readTabFromUrl() || viewState.activeTab || "play", false);
      }
    });`;

if (source.includes(unsafeBlock)) {
  writeFileSync(path, source.replace(unsafeBlock, safeBlock));
} else if (!source.includes("const hasActiveClass = refs.socialScreen.classList.contains(\"social-page-active\")")) {
  throw new Error("The social screen observer block could not be located.");
}
