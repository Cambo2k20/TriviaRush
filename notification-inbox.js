(() => {
  "use strict";

  const TYPE_LABELS = Object.freeze({
    friend_request: "Friend request",
    live_duel_invite: "Live duel invitation",
    turn_challenge_ready: "Turn-based challenge",
    turn_challenge_reminder: "Challenge reminder",
    turn_challenge_result: "Challenge result",
    turn_challenge_expired: "Expired challenge"
  });

  const state = {
    initialized: false,
    renderQueued: false,
    observer: null,
    activeRow: null,
    activeNotification: null
  };

  const refs = {};
  const rowNotifications = new WeakMap();

  function init() {
    if (state.initialized) {
      return;
    }

    refs.notificationList = document.querySelector("#notificationList");
    refs.clearButton = document.querySelector("#markNotificationsReadButton");
    refs.notificationBadge = document.querySelector("#notificationBadge");
    refs.notificationButton = document.querySelector("#notificationButton");
    refs.notificationStatus = document.querySelector("#notificationStatus");

    if (!refs.notificationList || !refs.clearButton) {
      return;
    }

    state.initialized = true;
    installStyles();
    buildDetailDialog();

    refs.clearButton.textContent = "Clear all";
    refs.clearButton.setAttribute("aria-label", "Clear all notifications");
    refs.clearButton.title = "Remove every notification from this inbox";

    refs.clearButton.addEventListener("click", handleClearClick, true);
    refs.notificationList.addEventListener("click", handleNotificationClick);
    refs.notificationList.addEventListener("keydown", handleNotificationKeydown);

    state.observer = new MutationObserver(scheduleEnhancement);
    state.observer.observe(refs.notificationList, {
      childList: true,
      subtree: true,
      characterData: true
    });

    window.addEventListener("trivia-rush:social-rpc", (event) => {
      if (event.detail?.functionName === "get_notifications") {
        scheduleEnhancement();
      }
    });

    scheduleEnhancement();
  }

  function installStyles() {
    if (document.querySelector("#notificationInboxStyles")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "notificationInboxStyles";
    style.textContent = `
      #notificationList > .notification-inbox-row {
        cursor: pointer;
        transition: border-color 150ms ease, background 150ms ease, transform 150ms ease;
      }

      #notificationList > .notification-inbox-row:hover {
        border-color: rgba(37, 231, 209, 0.48);
        background: rgba(37, 231, 209, 0.055);
        transform: translateY(-1px);
      }

      #notificationList > .notification-inbox-row:focus-visible {
        outline: 3px solid rgba(37, 231, 209, 0.42);
        outline-offset: -3px;
      }

      #notificationList > .notification-inbox-row.unread {
        box-shadow: inset 4px 0 0 rgba(37, 231, 209, 0.85);
      }

      .social-notification-detail-dialog {
        width: min(560px, calc(100% - 24px));
        max-height: calc(100dvh - 28px);
        overflow-y: auto;
        padding: 0;
        color: #f8f9ff;
        border: 1px solid rgba(143, 99, 255, 0.58);
        border-radius: 18px;
        background:
          radial-gradient(circle at 100% 0, rgba(89, 54, 190, 0.28), transparent 22rem),
          #121a42;
        box-shadow: 0 30px 90px rgba(0, 0, 0, 0.58);
      }

      .social-notification-detail-dialog::backdrop {
        background: rgba(2, 5, 18, 0.8);
        backdrop-filter: blur(8px);
      }

      .notification-detail-card {
        position: relative;
        padding: 30px;
      }

      .notification-detail-heading {
        padding-right: 44px;
        display: grid;
        grid-template-columns: 48px minmax(0, 1fr);
        align-items: center;
        gap: 14px;
      }

      .notification-detail-icon {
        width: 48px;
        height: 48px;
        display: grid;
        place-items: center;
        border: 1px solid rgba(37, 231, 209, 0.35);
        border-radius: 14px;
        font-size: 1.45rem;
        background: rgba(37, 231, 209, 0.08);
      }

      .notification-detail-eyebrow {
        margin: 0 0 3px;
        color: #25e7d1;
        font-size: 0.72rem;
        font-weight: 800;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      .notification-detail-heading h2 {
        margin: 0;
        font-family: "Baloo 2", sans-serif;
        font-size: clamp(1.65rem, 5vw, 2.1rem);
        line-height: 1.05;
      }

      .notification-detail-body {
        margin: 24px 0;
        color: #d8dcef;
        font-size: 1.03rem;
        line-height: 1.6;
        overflow-wrap: anywhere;
      }

      .notification-detail-meta {
        margin: 0;
        display: grid;
        gap: 0;
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 12px;
        overflow: hidden;
        background: rgba(5, 11, 35, 0.28);
      }

      .notification-detail-meta > div {
        min-height: 48px;
        padding: 11px 14px;
        display: grid;
        grid-template-columns: 90px minmax(0, 1fr);
        align-items: center;
        gap: 12px;
      }

      .notification-detail-meta > div + div {
        border-top: 1px solid rgba(255, 255, 255, 0.1);
      }

      .notification-detail-meta dt {
        color: #aeb6d1;
        font-weight: 700;
      }

      .notification-detail-meta dd {
        margin: 0;
        color: #f5f7ff;
        overflow-wrap: anywhere;
      }

      .notification-detail-actions {
        margin-top: 24px;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }

      .notification-detail-actions > button {
        min-height: 48px;
        justify-content: center;
      }

      .notification-detail-actions > button[hidden] {
        display: none;
      }

      .notification-detail-status {
        min-height: 20px;
        margin: 14px 0 0;
        color: #aeb6d1;
        text-align: center;
        font-size: 0.86rem;
      }

      .notification-detail-status.error {
        color: #ff8e96;
      }

      @media (max-width: 560px) {
        .social-notification-detail-dialog {
          width: calc(100% - 20px);
          max-height: calc(100dvh - 20px);
          border-radius: 16px;
        }

        .notification-detail-card {
          padding: 24px 20px 20px;
        }

        .notification-detail-heading {
          grid-template-columns: 42px minmax(0, 1fr);
          gap: 12px;
        }

        .notification-detail-icon {
          width: 42px;
          height: 42px;
          border-radius: 12px;
        }

        .notification-detail-meta > div {
          grid-template-columns: 76px minmax(0, 1fr);
          padding-inline: 12px;
        }

        .notification-detail-actions {
          grid-template-columns: 1fr;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function buildDetailDialog() {
    refs.detailDialog = document.createElement("dialog");
    refs.detailDialog.id = "notificationDetailDialog";
    refs.detailDialog.className = "social-notification-detail-dialog";
    refs.detailDialog.setAttribute("aria-labelledby", "notificationDetailTitle");

    const card = document.createElement("section");
    card.className = "notification-detail-card";

    refs.detailCloseIcon = document.createElement("button");
    refs.detailCloseIcon.type = "button";
    refs.detailCloseIcon.className = "dialog-close";
    refs.detailCloseIcon.setAttribute("aria-label", "Close notification details");
    refs.detailCloseIcon.textContent = "×";

    const heading = document.createElement("div");
    heading.className = "notification-detail-heading";
    heading.innerHTML = `
      <span class="notification-detail-icon" aria-hidden="true">🔔</span>
      <div>
        <p class="notification-detail-eyebrow">Notification details</p>
        <h2 id="notificationDetailTitle"></h2>
      </div>
    `;

    refs.detailTitle = heading.querySelector("#notificationDetailTitle");
    refs.detailBody = document.createElement("p");
    refs.detailBody.className = "notification-detail-body";

    refs.detailMeta = document.createElement("dl");
    refs.detailMeta.className = "notification-detail-meta";

    const actions = document.createElement("div");
    actions.className = "notification-detail-actions";

    refs.detailAction = document.createElement("button");
    refs.detailAction.type = "button";
    refs.detailAction.className = "primary-button";
    refs.detailAction.hidden = true;

    refs.detailCloseButton = document.createElement("button");
    refs.detailCloseButton.type = "button";
    refs.detailCloseButton.className = "secondary-button";
    refs.detailCloseButton.textContent = "Close";

    refs.detailStatus = document.createElement("p");
    refs.detailStatus.className = "notification-detail-status";
    refs.detailStatus.setAttribute("role", "status");
    refs.detailStatus.setAttribute("aria-live", "polite");

    actions.append(refs.detailAction, refs.detailCloseButton);
    card.append(
      refs.detailCloseIcon,
      heading,
      refs.detailBody,
      refs.detailMeta,
      actions,
      refs.detailStatus
    );
    refs.detailDialog.appendChild(card);
    document.body.appendChild(refs.detailDialog);

    refs.detailCloseIcon.addEventListener("click", closeDetailDialog);
    refs.detailCloseButton.addEventListener("click", closeDetailDialog);
    refs.detailAction.addEventListener("click", activateCurrentNotification);
    refs.detailDialog.addEventListener("click", (event) => {
      if (event.target === refs.detailDialog) {
        closeDetailDialog();
      }
    });
    refs.detailDialog.addEventListener("close", () => {
      state.activeRow = null;
      state.activeNotification = null;
      refs.detailStatus.textContent = "";
      refs.detailStatus.classList.remove("error");
    });
  }

  function handleClearClick(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    void clearAllNotifications();
  }

  function handleNotificationClick(event) {
    if (event.target.closest("button, a, input, select, textarea, summary")) {
      return;
    }

    const row = event.target.closest(".social-row");
    if (!row || row.parentElement !== refs.notificationList) {
      return;
    }

    void openNotificationDetails(row);
  }

  function handleNotificationKeydown(event) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    const row = event.target.closest(".social-row");
    if (!row || row.parentElement !== refs.notificationList) {
      return;
    }

    event.preventDefault();
    void openNotificationDetails(row);
  }

  function scheduleEnhancement() {
    if (state.renderQueued) {
      return;
    }

    state.renderQueued = true;
    window.requestAnimationFrame(() => {
      state.renderQueued = false;
      enhanceNotificationRows();
    });
  }

  function enhanceNotificationRows() {
    const rows = [...refs.notificationList.children]
      .filter((child) => child.classList.contains("social-row"));
    const notifications = getLatestNotifications();

    rows.forEach((row, index) => {
      const notification = notifications[index] || buildFallbackNotification(row, index);
      rowNotifications.set(row, notification);
      row.classList.add("notification-inbox-row");
      row.tabIndex = 0;
      row.setAttribute("role", "button");
      row.setAttribute(
        "aria-label",
        `View notification details: ${notification.title || "Notification"}`
      );
      if (notification.notification_id) {
        row.dataset.notificationId = notification.notification_id;
      }
    });
  }

  function getLatestNotifications() {
    const entries = [...(window.triviaRushSocialRpcCache?.values?.() || [])]
      .filter((entry) => entry.functionName === "get_notifications")
      .sort((left, right) => right.receivedAt - left.receivedAt);
    const data = entries[0]?.data;
    return Array.isArray(data) ? data : [];
  }

  function buildFallbackNotification(row, index) {
    const title = row.querySelector(".social-row-copy strong")?.textContent?.trim()
      || "Notification";
    const secondary = row.querySelector(".social-row-copy small")?.textContent?.trim()
      || "";

    return {
      notification_id: row.dataset.notificationId || `legacy-${index}`,
      notification_type: "notification",
      title,
      body: stripRelativeTime(secondary),
      actor_display_name: null,
      read_at: row.classList.contains("unread") ? null : new Date().toISOString(),
      created_at: null,
      expires_at: null
    };
  }

  function stripRelativeTime(value) {
    return String(value || "")
      .replace(/\s+·\s+(?:just now|recently|\d+\s+(?:minute|hour|day)s?\s+ago|in\s+(?:under a minute|\d+\s+(?:minute|hour|day)s?))$/i, "")
      .trim();
  }

  async function openNotificationDetails(row) {
    const notification = rowNotifications.get(row) || buildFallbackNotification(row, 0);
    const actionButton = row.querySelector(".row-actions button, button.row-action");

    state.activeRow = row;
    state.activeNotification = notification;

    refs.detailTitle.textContent = notification.title || "Notification";
    refs.detailBody.textContent = notification.body || "No additional message was provided.";
    renderDetailMeta(notification);

    if (actionButton) {
      refs.detailAction.hidden = false;
      refs.detailAction.textContent = getExpandedActionLabel(
        actionButton.textContent?.trim(),
        notification
      );
      refs.detailAction.dataset.proxyButtonId = ensureElementId(actionButton);
    } else {
      refs.detailAction.hidden = true;
      delete refs.detailAction.dataset.proxyButtonId;
    }

    refs.detailStatus.textContent = "";
    refs.detailStatus.classList.remove("error");
    showDialog(refs.detailDialog);
    window.setTimeout(() => refs.detailCloseButton.focus(), 0);

    if (!notification.read_at && isRealNotificationId(notification.notification_id)) {
      await markNotificationRead(notification, row);
    }
  }

  function renderDetailMeta(notification) {
    refs.detailMeta.replaceChildren();

    const rows = [
      ["Type", TYPE_LABELS[notification.notification_type] || titleCase(notification.notification_type)],
      ["From", notification.actor_display_name || "Trivia Rush"],
      ["Received", formatDateTime(notification.created_at)],
      ["Status", notification.read_at ? "Read" : "Unread"]
    ];

    if (notification.expires_at) {
      rows.push(["Expires", formatDateTime(notification.expires_at)]);
    }

    rows.forEach(([label, value]) => {
      const wrapper = document.createElement("div");
      const term = document.createElement("dt");
      const description = document.createElement("dd");
      term.textContent = label;
      description.textContent = value;
      wrapper.append(term, description);
      refs.detailMeta.appendChild(wrapper);
    });
  }

  async function markNotificationRead(notification, row) {
    const client = getClient();
    if (!client) {
      setDetailStatus("Notification service is not ready. Try again in a moment.", true);
      return;
    }

    const { error } = await client.rpc("mark_notification_read", {
      p_notification_id: notification.notification_id
    });

    if (error) {
      setDetailStatus(error.message || "This notification could not be marked as read.", true);
      return;
    }

    notification.read_at = new Date().toISOString();
    row.classList.remove("unread");
    renderDetailMeta(notification);
    await refreshUnreadCount();
  }

  async function activateCurrentNotification() {
    const proxyId = refs.detailAction.dataset.proxyButtonId;
    const proxyButton = proxyId ? document.getElementById(proxyId) : null;
    closeDetailDialog();
    proxyButton?.click();
  }

  async function clearAllNotifications() {
    const client = getClient();
    if (!client) {
      setNotificationStatus("Notification service is not ready. Try again in a moment.", true);
      return;
    }

    refs.clearButton.disabled = true;
    refs.clearButton.textContent = "Clearing…";
    setNotificationStatus("");

    try {
      const { data, error } = await client.rpc("clear_notifications");
      if (error) {
        throw error;
      }

      updateNotificationCacheAfterClear();
      renderClearedState();
      setUnreadNotificationCount(0);
      closeDetailDialog();

      const clearedCount = Math.max(0, Number(data || 0));
      setNotificationStatus(
        clearedCount === 1
          ? "1 notification cleared."
          : `${clearedCount} notifications cleared.`
      );
    } catch (error) {
      setNotificationStatus(
        error?.message || "Notifications could not be cleared.",
        true
      );
    } finally {
      refs.clearButton.disabled = false;
      refs.clearButton.textContent = "Clear all";
    }
  }

  function renderClearedState() {
    const empty = document.createElement("p");
    empty.className = "social-empty";
    empty.textContent = "No notifications yet.";
    refs.notificationList.replaceChildren(empty);
  }

  function updateNotificationCacheAfterClear() {
    [...(window.triviaRushSocialRpcCache?.values?.() || [])]
      .filter((entry) => entry.functionName === "get_notifications")
      .forEach((entry) => {
        entry.data = [];
        entry.receivedAt = Date.now();
      });
  }

  async function refreshUnreadCount() {
    const client = getClient();
    if (!client) {
      return;
    }

    const { data, error } = await client.rpc("get_unread_notification_count");
    if (!error) {
      setUnreadNotificationCount(Number(data || 0));
    }
  }

  function setUnreadNotificationCount(count) {
    const safeCount = Math.max(0, Number.isFinite(count) ? Math.round(count) : 0);

    if (refs.notificationBadge) {
      refs.notificationBadge.hidden = safeCount === 0;
      refs.notificationBadge.textContent = safeCount > 99 ? "99+" : String(safeCount);
    }

    refs.notificationButton?.setAttribute(
      "aria-label",
      safeCount ? `Open ${safeCount} unread notifications` : "Open notifications"
    );

    if ("setAppBadge" in navigator && safeCount) {
      void Promise.resolve(navigator.setAppBadge(safeCount)).catch(() => {});
    } else if ("clearAppBadge" in navigator && safeCount === 0) {
      void Promise.resolve(navigator.clearAppBadge()).catch(() => {});
    }
  }

  function setNotificationStatus(message, isError = false) {
    if (!refs.notificationStatus) {
      return;
    }
    refs.notificationStatus.textContent = message;
    refs.notificationStatus.classList.toggle("error", isError);
  }

  function setDetailStatus(message, isError = false) {
    refs.detailStatus.textContent = message;
    refs.detailStatus.classList.toggle("error", isError);
  }

  function getClient() {
    return window.triviaRushSupabaseClient || null;
  }

  function ensureElementId(element) {
    if (!element.id) {
      element.id = `notificationAction-${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}`;
    }
    return element.id;
  }

  function getExpandedActionLabel(label, notification) {
    if (label === "Join") {
      return "Join duel";
    }
    if (label === "Open") {
      return notification.notification_type === "turn_challenge_result"
        ? "Open result"
        : "Open challenge";
    }
    if (label === "View") {
      return "View request";
    }
    return label || "Open";
  }

  function titleCase(value) {
    const text = String(value || "Notification").replaceAll("_", " ").trim();
    return text ? `${text.charAt(0).toUpperCase()}${text.slice(1)}` : "Notification";
  }

  function formatDateTime(value) {
    const timestamp = Date.parse(value);
    if (!Number.isFinite(timestamp)) {
      return "Recently";
    }

    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date(timestamp));
  }

  function isRealNotificationId(value) {
    return typeof value === "string" && !value.startsWith("legacy-");
  }

  function showDialog(dialog) {
    if (dialog.open) {
      return;
    }
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
  }

  function closeDetailDialog() {
    if (!refs.detailDialog?.open && !refs.detailDialog?.hasAttribute("open")) {
      return;
    }
    if (typeof refs.detailDialog.close === "function") {
      refs.detailDialog.close();
    } else {
      refs.detailDialog.removeAttribute("open");
      refs.detailDialog.dispatchEvent(new Event("close"));
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
