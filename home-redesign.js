(() => {
  "use strict";

  const CATEGORY_PROGRESSION_EVENT = "trivia-rush:category-progression";

  const ICONS = {
    brain: `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M20 9a6 6 0 0 0-10 4 6 6 0 0 0-2 11 6 6 0 0 0 4 10 6 6 0 0 0 8 5V9Z"/><path d="M28 9a6 6 0 0 1 10 4 6 6 0 0 1 2 11 6 6 0 0 1-4 10 6 6 0 0 1-8 5V9Z"/><path d="M20 17h-4a4 4 0 0 0-4 4M20 29h-4a4 4 0 0 1-4-4M28 17h4a4 4 0 0 1 4 4M28 29h4a4 4 0 0 0 4-4M20 23h8M24 9v30"/></svg>`,
    flask: `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M18 6h12M20 6v13L9 38a3 3 0 0 0 3 4h24a3 3 0 0 0 3-4L28 19V6"/><path d="M14 32h20M18 26h12"/></svg>`,
    landmark: `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="m7 17 17-9 17 9H7Z"/><path d="M10 21h28M12 39h24M8 43h32M14 21v18M22 21v18M30 21v18M38 21v18"/></svg>`,
    globe: `<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="22" r="16"/><path d="M8 22h32M24 6c5 5 7 10 7 16s-2 11-7 16c-5-5-7-10-7-16s2-11 7-16ZM12 12c4 3 8 4 12 4s8-1 12-4M12 32c4-3 8-4 12-4s8 1 12 4M16 43h16"/></svg>`,
    trophy: `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M15 7h18v8c0 9-4 14-9 14s-9-5-9-14V7Z"/><path d="M15 11H8v4c0 6 4 10 10 10M33 11h7v4c0 6-4 10-10 10M24 29v8M16 42h16M19 37h10"/></svg>`,
    film: `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M7 18h34v23H7zM7 18l2-9 33-6-2 10-33 5Z"/><path d="m16 8 4 7M27 6l4 7M37 4l4 7M20 27l10 6-10 6V27Z"/></svg>`,
    palette_book: `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 39c-4-5-10-7-17-5V9c7-2 13 0 17 5v25ZM24 39c4-5 10-7 17-5V9c-7-2-13 0-17 5v25Z"/><path d="M11 15c4-1 7 0 10 2M11 21c4-1 7 0 10 2M37 15c-4-1-7 0-10 2M37 21c-4-1-7 0-10 2"/></svg>`,
    cpu: `<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="12" y="12" width="24" height="24" rx="3"/><rect x="18" y="18" width="12" height="12" rx="1"/><path d="M18 4v8M24 4v8M30 4v8M18 36v8M24 36v8M30 36v8M4 18h8M4 24h8M4 30h8M36 18h8M36 24h8M36 30h8"/></svg>`,
    gamepad: `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M14 16h20c6 0 9 5 8 11l-2 9c-1 4-6 5-9 2l-4-4h-6l-4 4c-3 3-8 2-9-2l-2-9c-1-6 2-11 8-11Z"/><path d="M15 24v8M11 28h8M32 24h.01M36 29h.01M20 16l2-5h4l2 5"/></svg>`,
    utensils: `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M12 5v16M8 5v10c0 4 2 6 4 6s4-2 4-6V5M12 21v22M30 5v38M30 5c6 4 8 10 6 18h-6"/></svg>`,
    paw: `<svg viewBox="0 0 48 48" aria-hidden="true"><ellipse cx="24" cy="31" rx="11" ry="9"/><ellipse cx="11" cy="21" rx="4" ry="6"/><ellipse cx="20" cy="13" rx="4" ry="6"/><ellipse cx="37" cy="21" rx="4" ry="6"/><ellipse cx="28" cy="13" rx="4" ry="6"/></svg>`,
    dragon: `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M12 39c2-10 7-16 15-19-2-5 0-10 5-14l1 8 7-2-4 7c5 4 6 10 3 17-4-5-8-7-13-6-5 1-9 4-14 9Z"/><path d="M19 25c-5-1-9-4-12-9 7 0 12 2 15 6M31 21h.01"/></svg>`,
    thunderbolt: `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M28 4 10 27h13l-3 17 18-25H26l2-15Z"/></svg>`,
    wand: `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="m8 40 25-25M30 8l2 4 4 2-4 2-2 4-2-4-4-2 4-2 2-4ZM40 24l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3Z"/><path d="m11 35 3 3"/></svg>`,
    shield: `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 5 39 11v11c0 10-6 17-15 21C15 39 9 32 9 22V11l15-6Z"/><path d="m24 13 3 7h8l-6 5 2 8-7-4-7 4 2-8-6-5h8l3-7Z"/></svg>`
  };

  function presentationForOption(option) {
    return {
      accent: /^#[0-9A-F]{6}$/i.test(option?.dataset?.color || "")
        ? option.dataset.color
        : "#7C83FF",
      icon: option?.dataset?.iconKey || "brain",
      label: option?.textContent?.trim() || "Choose a category"
    };
  }

  const elements = {};
  const categoryProgression = new Map();
  let optionObserver = null;
  let screenObserver = null;
  let hostObserver = null;
  let levelObserver = null;

  function initialise() {
    elements.startScreen = document.querySelector("#startScreen");
    elements.categorySelect = document.querySelector("#categorySelect");
    elements.categoryGrid = document.querySelector("#categoryCardGrid");
    elements.selectedCategory = document.querySelector("#selectedCategoryLabel");
    elements.categoryBrowser = document.querySelector(".home-category-browser");
    elements.categoryHeadingTitle = document.querySelector("#homeCategoryTitle");
    elements.categoryHeadingLevel = document.querySelector("#homeCategoryLevel");
    elements.categoryHeadingMark = document.querySelector("#homeCategoryMark");
    elements.homeHostToggle = document.querySelector("#homeHostToggle");
    elements.hostToggle = document.querySelector("#hostToggle");
    elements.homeGlobalLevel = document.querySelector("#homeGlobalLevel");
    elements.progressionLevel = document.querySelector("#globalProgressionChipLevel");

    if (!elements.startScreen || !elements.categorySelect || !elements.categoryGrid) {
      return;
    }

    bindShortcuts();
    bindCategorySelect();
    bindCategoryProgression();
    bindHostToggle();
    observeActiveScreen();
    observeProgressionLevel();
    renderCategoryCards();
  }

  function bindCategorySelect() {
    elements.categorySelect.addEventListener("change", syncSelectedCategory);
    optionObserver = new MutationObserver(() => renderCategoryCards());
    optionObserver.observe(elements.categorySelect, { childList: true, subtree: true });
  }

  function renderCategoryCards() {
    const options = [...elements.categorySelect.options]
      .filter((option) => option.value && option.textContent.trim());

    if (options.length === 0) {
      return;
    }

    const fragment = document.createDocumentFragment();
    options.forEach((option) => {
      const presentation = presentationForOption(option);
      const button = document.createElement("button");
      const icon = document.createElement("span");
      const label = document.createElement("strong");

      button.type = "button";
      button.className = "home-category-card";
      button.dataset.categoryId = option.value;
      button.style.setProperty("--category-accent", presentation.accent);
      button.setAttribute("aria-pressed", "false");
      button.setAttribute("aria-label", `Choose ${presentation.label || option.textContent.trim()}`);

      icon.className = "home-category-icon";
      icon.innerHTML = ICONS[presentation.icon] || ICONS.brain;
      label.textContent = presentation.label || option.textContent.trim();
      button.append(icon, label);

      button.addEventListener("click", () => {
        elements.categorySelect.value = option.value;
        elements.categorySelect.dispatchEvent(new Event("change", { bubbles: true }));
      });

      fragment.appendChild(button);
    });

    elements.categoryGrid.replaceChildren(fragment);
    elements.startScreen.classList.add("home-redesign-ready");
    syncSelectedCategory();
  }

  function syncSelectedCategory() {
    const selectedOption = elements.categorySelect.selectedOptions[0];
    const selectedId = elements.categorySelect.value;
    const selectedLabel = selectedOption?.textContent?.trim() || "Choose a category";

    if (elements.selectedCategory) {
      elements.selectedCategory.textContent = selectedLabel;
    }

    syncCategoryHeading(selectedId, selectedLabel);

    elements.categoryGrid
      .querySelectorAll("[data-category-id]")
      .forEach((button) => {
        const active = button.dataset.categoryId === selectedId;
        button.setAttribute("aria-pressed", String(active));
      });
  }

  function bindCategoryProgression() {
    window.addEventListener(CATEGORY_PROGRESSION_EVENT, (event) => {
      const categories = Array.isArray(event.detail?.categories)
        ? event.detail.categories
        : [];

      categoryProgression.clear();
      categories.forEach((category) => {
        const id = String(category?.id || "");
        const level = Number.parseInt(category?.level, 10);
        if (id && Number.isFinite(level)) {
          categoryProgression.set(id, { level: Math.max(1, level) });
        }
      });

      syncSelectedCategory();
    });
  }

  function syncCategoryHeading(selectedId, selectedLabel) {
    const selectedOption = [...elements.categorySelect.options]
      .find((option) => option.value === selectedId);
    const presentation = presentationForOption(selectedOption);

    if (elements.categoryHeadingTitle) {
      elements.categoryHeadingTitle.textContent = selectedLabel;
    }

    if (elements.categoryHeadingMark) {
      elements.categoryHeadingMark.innerHTML = ICONS[presentation.icon] || ICONS.brain;
    }

    elements.categoryBrowser?.style.setProperty("--selected-category-accent", presentation.accent);

    if (!elements.categoryHeadingLevel) {
      return;
    }

    if (selectedId === "mixed") {
      const level = elements.homeGlobalLevel?.textContent?.trim() || "1";
      elements.categoryHeadingLevel.textContent = `Global level ${level}`;
      return;
    }

    const progression = categoryProgression.get(selectedId);
    elements.categoryHeadingLevel.textContent = progression
      ? `Category level ${progression.level}`
      : "Category level loading";
  }

  function bindHostToggle() {
    if (!elements.homeHostToggle || !elements.hostToggle) {
      return;
    }

    elements.homeHostToggle.addEventListener("click", () => {
      elements.hostToggle.click();
      window.setTimeout(syncHostToggle, 0);
    });

    hostObserver = new MutationObserver(syncHostToggle);
    hostObserver.observe(elements.hostToggle, {
      attributes: true,
      attributeFilter: ["aria-pressed"]
    });
    syncHostToggle();
  }

  function syncHostToggle() {
    const enabled = elements.hostToggle?.getAttribute("aria-pressed") === "true";
    elements.homeHostToggle?.setAttribute("aria-pressed", String(enabled));
  }

  function bindShortcuts() {
    document.querySelector("#homeChallengeShortcut")?.addEventListener("click", () => {
      elements.categoryGrid.querySelector("[aria-pressed='true']")?.focus();
      elements.categoryGrid.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    document.querySelector("#homeFriendsShortcut")?.addEventListener("click", () => {
      document.querySelector("#duelButton")?.click();
    });
    document.querySelector("#homeLeaderboardShortcut")?.addEventListener("click", () => {
      document.querySelector("#leaderboardButton")?.click();
    });
  }

  function observeActiveScreen() {
    const sync = () => {
      document.body.classList.toggle(
        "home-redesign-active",
        elements.startScreen.classList.contains("active")
      );
    };

    screenObserver = new MutationObserver(sync);
    screenObserver.observe(elements.startScreen, {
      attributes: true,
      attributeFilter: ["class"]
    });
    sync();
  }

  function observeProgressionLevel() {
    const findAndObserve = () => {
      elements.progressionLevel = document.querySelector("#globalProgressionChipLevel");
      if (!elements.progressionLevel) {
        window.setTimeout(findAndObserve, 75);
        return;
      }

      const sync = () => {
        if (elements.homeGlobalLevel) {
          elements.homeGlobalLevel.textContent = elements.progressionLevel.textContent || "1";
        }
        syncSelectedCategory();
      };

      levelObserver = new MutationObserver(sync);
      levelObserver.observe(elements.progressionLevel, {
        childList: true,
        characterData: true,
        subtree: true
      });
      sync();
    };

    findAndObserve();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialise, { once: true });
  } else {
    initialise();
  }
})();
