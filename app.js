(() => {
  "use strict";

  const QUESTION_DELAY_MS = 850;
  const TIMER_CIRCUMFERENCE = 2 * Math.PI * 52;
  function isDiscordActivity() {
    return window.location.hostname.endsWith(".discordsays.com");
  }
  
  const SUPABASE_URL = isDiscordActivity()
    ? `${window.location.origin}/supabase-api`
    : "https://kgdnuzasbeavpqharbpf.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_R-AJK-addd0bcjUtfzAOqQ_88GYxN_O";
  const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
  );
  const state = {
    categories: [],
    currentQuestion: null,
    questionIndex: 0,
    score: 0,
    streak: 0,
    bestStreak: 0,
    correct: 0,
    answered: 0,
    remainingMs: 60 * 1000,
    durationSeconds: 60,
    runId: null,
    completedSessionId: null,
    serverEndsAtMs: 0,
    serverClockOffsetMs: 0,
    questionStartedAt: 0,
    timerStartedAt: 0,
    timerFrame: null,
    locked: false,
    starting: false,
    gameEnded: false,
    pendingQuestionTimer: null,
    soundEnabled: true,
    hostEnabled: false,
    recognition: null,
    listening: false,
    selectedCategory: "mixed",
    user: null,
    profile: null,
    scoreSaved: false,
    baseResultMessage: "",
    responseTimes: [],
    accountMode: "create",
    recoveryMode: false,
    authSubscription: null,
    leaderboardPeriod: "all",
    leaderboardCategory: "overall",
    leaderboardCategories: [],
    leaderboardReturnScreen: null,
    leaderboardRows: [],
    leaderboardRequestId: 0,
    socialReturnScreen: null,
    activeDuelId: null,
    activeDuelCode: null,
    activeDuelFormat: "live",
    duelState: null,
    duelQuestion: null,
    duelLocked: true,
    duelPollTimer: null,
    duelTimerFrame: null,
    duelSubscription: null,
    duelServerOffsetMs: 0,
    duelRefreshPending: false,
    rematchSettings: null,
    duelLeaderboardFormat: "all",
    notificationSubscription: null,
    notificationPreferences: null,
    notificationDispatchKey: null
  };

  const elements = {
    screens: [...document.querySelectorAll(".screen")],
    startScreen: document.querySelector("#startScreen"),
    countdownScreen: document.querySelector("#countdownScreen"),
    gameScreen: document.querySelector("#gameScreen"),
    resultsScreen: document.querySelector("#resultsScreen"),
    leaderboardScreen: document.querySelector("#leaderboardScreen"),
    startButton: document.querySelector("#startButton"),
    playAgainButton: document.querySelector("#playAgainButton"),
    homeButton: document.querySelector("#homeButton"),
    resultsLeaderboardButton: document.querySelector("#resultsLeaderboardButton"),
    categorySelect: document.querySelector("#categorySelect"),
    startStatus: document.querySelector("#startStatus"),
    notificationButton: document.querySelector("#notificationButton"),
    notificationBadge: document.querySelector("#notificationBadge"),
    duelButton: document.querySelector("#duelButton"),
    socialScreen: document.querySelector("#socialScreen"),
    closeSocialButton: document.querySelector("#closeSocialButton"),
    duelAccountGate: document.querySelector("#duelAccountGate"),
    openAccountForDuelButton: document.querySelector("#openAccountForDuelButton"),
    socialContent: document.querySelector("#socialContent"),
    socialStatus: document.querySelector("#socialStatus"),
    duelFormatSelect: document.querySelector("#duelFormatSelect"),
    duelFormatNote: document.querySelector("#duelFormatNote"),
    duelInviteAccountLabel: document.querySelector("#duelInviteAccountLabel"),
    duelCategorySelect: document.querySelector("#duelCategorySelect"),
    duelDurationSelect: document.querySelector("#duelDurationSelect"),
    duelInviteAccount: document.querySelector("#duelInviteAccount"),
    createDuelButton: document.querySelector("#createDuelButton"),
    duelRoomCode: document.querySelector("#duelRoomCode"),
    joinDuelButton: document.querySelector("#joinDuelButton"),
    duelInvitations: document.querySelector("#duelInvitations"),
    turnChallenges: document.querySelector("#turnChallenges"),
    turnChallengeActivity: document.querySelector("#turnChallengeActivity"),
    friendAccountNumber: document.querySelector("#friendAccountNumber"),
    addFriendButton: document.querySelector("#addFriendButton"),
    friendRequests: document.querySelector("#friendRequests"),
    friendsList: document.querySelector("#friendsList"),
    historyOpponentFilter: document.querySelector("#historyOpponentFilter"),
    duelHistory: document.querySelector("#duelHistory"),
    duelLeaderboard: document.querySelector("#duelLeaderboard"),
    duelLeaderboardFormatButtons: [
      ...document.querySelectorAll("[data-duel-leaderboard-format]")
    ],
    notificationCard: document.querySelector("#notificationCard"),
    notificationList: document.querySelector("#notificationList"),
    markNotificationsReadButton: document.querySelector("#markNotificationsReadButton"),
    challengeNotificationsToggle: document.querySelector("#challengeNotificationsToggle"),
    friendNotificationsToggle: document.querySelector("#friendNotificationsToggle"),
    emailNotificationsToggle: document.querySelector("#emailNotificationsToggle"),
    pushNotificationsButton: document.querySelector("#pushNotificationsButton"),
    notificationStatus: document.querySelector("#notificationStatus"),
    duelWaitingScreen: document.querySelector("#duelWaitingScreen"),
    duelWaitingEyebrow: document.querySelector("#duelWaitingEyebrow"),
    duelWaitingTitle: document.querySelector("#duelWaitingTitle"),
    duelWaitingDescription: document.querySelector("#duelWaitingDescription"),
    duelWaitingCode: document.querySelector("#duelWaitingCode"),
    duelWaitingStatus: document.querySelector("#duelWaitingStatus"),
    copyDuelLinkButton: document.querySelector("#copyDuelLinkButton"),
    startTurnChallengeButton: document.querySelector("#startTurnChallengeButton"),
    declineTurnChallengeButton: document.querySelector("#declineTurnChallengeButton"),
    cancelDuelButton: document.querySelector("#cancelDuelButton"),
    backFromDuelWaitingButton: document.querySelector("#backFromDuelWaitingButton"),
    duelGameScreen: document.querySelector("#duelGameScreen"),
    duelSelfScore: document.querySelector("#duelSelfScore"),
    duelSelfProgress: document.querySelector("#duelSelfProgress"),
    duelOpponentName: document.querySelector("#duelOpponentName"),
    duelOpponentScore: document.querySelector("#duelOpponentScore"),
    duelOpponentProgressText: document.querySelector("#duelOpponentProgressText"),
    duelTimerValue: document.querySelector("#duelTimerValue"),
    duelPhaseLabel: document.querySelector("#duelPhaseLabel"),
    duelCategoryBadge: document.querySelector("#duelCategoryBadge"),
    duelQuestionNumber: document.querySelector("#duelQuestionNumber"),
    duelQuestionText: document.querySelector("#duelQuestionText"),
    duelAnswerGrid: document.querySelector("#duelAnswerGrid"),
    duelPassButton: document.querySelector("#duelPassButton"),
    duelFeedback: document.querySelector("#duelFeedback"),
    duelResultsScreen: document.querySelector("#duelResultsScreen"),
    duelResultBadge: document.querySelector("#duelResultBadge"),
    duelResultTitle: document.querySelector("#duelResultTitle"),
    duelResultMessage: document.querySelector("#duelResultMessage"),
    duelFinalSelfScore: document.querySelector("#duelFinalSelfScore"),
    duelFinalOpponentName: document.querySelector("#duelFinalOpponentName"),
    duelFinalOpponentScore: document.querySelector("#duelFinalOpponentScore"),
    duelRematchButton: document.querySelector("#duelRematchButton"),
    duelResultsHomeButton: document.querySelector("#duelResultsHomeButton"),
    startHighScore: document.querySelector("#startHighScore"),
    startBestStreak: document.querySelector("#startBestStreak"),
    countdownNumber: document.querySelector("#countdownNumber"),
    scoreValue: document.querySelector("#scoreValue"),
    streakValue: document.querySelector("#streakValue"),
    timerValue: document.querySelector("#timerValue"),
    timerProgress: document.querySelector("#timerProgress"),
    categoryBadge: document.querySelector("#categoryBadge"),
    questionNumber: document.querySelector("#questionNumber"),
    questionText: document.querySelector("#questionText"),
    answerGrid: document.querySelector("#answerGrid"),
    passButton: document.querySelector("#passButton"),
    voiceButton: document.querySelector("#voiceButton"),
    voiceButtonText: document.querySelector("#voiceButtonText"),
    feedback: document.querySelector("#feedback"),
    finalScore: document.querySelector("#finalScore"),
    correctTotal: document.querySelector("#correctTotal"),
    answeredTotal: document.querySelector("#answeredTotal"),
    accuracyTotal: document.querySelector("#accuracyTotal"),
    bestStreakTotal: document.querySelector("#bestStreakTotal"),
    resultTitle: document.querySelector("#resultTitle"),
    resultMessage: document.querySelector("#resultMessage"),
    newHighScore: document.querySelector("#newHighScore"),
    soundToggle: document.querySelector("#soundToggle"),
    hostToggle: document.querySelector("#hostToggle"),

    leaderboardButton: document.querySelector("#leaderboardButton"),
    closeLeaderboardButton: document.querySelector("#closeLeaderboardButton"),
    leaderboardPeriodButtons: [
      ...document.querySelectorAll("[data-leaderboard-period]")
    ],
    leaderboardCategoryFilters: document.querySelector(
      "#leaderboardCategoryFilters"
    ),
    retrySaveButton: document.querySelector("#retrySaveButton"),
    leaderboardFilterSummary: document.querySelector("#leaderboardFilterSummary"),
    currentPlayerRank: document.querySelector("#currentPlayerRank"),
    leaderboardStatus: document.querySelector("#leaderboardStatus"),
    leaderboardList: document.querySelector("#leaderboardList"),
    leaderboardRetryButton: document.querySelector("#leaderboardRetryButton"),

    accountButton: document.querySelector("#accountButton"),
    accountButtonText: document.querySelector("#accountButtonText"),
    accountDialog: document.querySelector("#accountDialog"),
    closeAccountDialogButton: document.querySelector("#closeAccountDialogButton"),
    accountDescription: document.querySelector("#accountDescription"),
    accountPlayerName: document.querySelector("#accountPlayerName"),
    accountIdentifier: document.querySelector("#accountIdentifier"),
    accountAuthTabs: document.querySelector("#accountAuthTabs"),
    showCreateAccountButton: document.querySelector("#showCreateAccountButton"),
    showSignInButton: document.querySelector("#showSignInButton"),
    createAccountForm: document.querySelector("#createAccountForm"),
    createUsername: document.querySelector("#createUsername"),
    createEmail: document.querySelector("#createEmail"),
    createAccountButton: document.querySelector("#createAccountButton"),
    signInForm: document.querySelector("#signInForm"),
    signInEmail: document.querySelector("#signInEmail"),
    signInPassword: document.querySelector("#signInPassword"),
    signInButton: document.querySelector("#signInButton"),
    forgotPasswordButton: document.querySelector("#forgotPasswordButton"),
    accountSetupForm: document.querySelector("#accountSetupForm"),
    setupPassword: document.querySelector("#setupPassword"),
    setupPasswordConfirm: document.querySelector("#setupPasswordConfirm"),
    finishAccountSetupButton: document.querySelector("#finishAccountSetupButton"),
    manageAccountForm: document.querySelector("#manageAccountForm"),
    manageEmail: document.querySelector("#manageEmail"),
    manageUsername: document.querySelector("#manageUsername"),
    saveUsernameButton: document.querySelector("#saveUsernameButton"),
    newPassword: document.querySelector("#newPassword"),
    newPasswordConfirm: document.querySelector("#newPasswordConfirm"),
    changePasswordButton: document.querySelector("#changePasswordButton"),
    signOutButton: document.querySelector("#signOutButton"),
    passwordRecoveryForm: document.querySelector("#passwordRecoveryForm"),
    recoveryPassword: document.querySelector("#recoveryPassword"),
    recoveryPasswordConfirm: document.querySelector("#recoveryPasswordConfirm"),
    completeRecoveryButton: document.querySelector("#completeRecoveryButton"),
    accountStatus: document.querySelector("#accountStatus"),

    howToButton: document.querySelector("#howToButton"),
    howToDialog: document.querySelector("#howToDialog"),
    closeDialogButton: document.querySelector("#closeDialogButton")
  };
  async function init() {
    loadPreferences();
    updateStartStats();
    configureSpeechRecognition();
    setupAuthStateListener();
    bindEvents();
    updateDuelFormatUI();
    updateLeaderboardFilterButtons();

    if (elements.timerProgress) {
      elements.timerProgress.style.strokeDasharray =
        `${TIMER_CIRCUMFERENCE}`;
      elements.timerProgress.style.strokeDashoffset = "0";
    }

    await initialisePlayer();
    await loadQuestionCategories();
    updateAccountUI();
    await refreshNotificationRuntime();
    await handleDuelLink();
  }

  function setupAuthStateListener() {
    const { data } =
      supabaseClient.auth.onAuthStateChange(
        (event, session) => {
          window.setTimeout(() => {
            void handleAuthStateChange(
              event,
              session
            );
          }, 0);
        }
      );

    state.authSubscription =
      data.subscription;
  }

  async function handleAuthStateChange(
    event,
    session
  ) {
    if (event === "PASSWORD_RECOVERY") {
      state.recoveryMode = true;
      state.user = session?.user ?? null;
      state.profile = null;

      if (state.user) {
        await loadPlayerProfile();
      } else {
        updateAccountUI();
      }

      openAccountDialog(false);
      setAccountStatus(
        "Recovery link accepted. Choose a new password."
      );
      return;
    }

    if (event === "SIGNED_OUT") {
      stopNotificationRuntime();
      state.user = null;
      state.profile = null;
      state.recoveryMode = false;
      updateAccountUI();
      return;
    }

    if (
      event === "SIGNED_IN" ||
      event === "USER_UPDATED" ||
      event === "TOKEN_REFRESHED"
    ) {
      state.user = session?.user ?? null;

      if (!state.user) {
        state.profile = null;
        updateAccountUI();
        return;
      }

      // Phase 3: token refreshes happen roughly hourly and do not change
      // profile data, so skip the profile query when one is already loaded.
      if (
        event === "TOKEN_REFRESHED" &&
        state.profile
      ) {
        return;
      }

      await loadPlayerProfile();
      await refreshNotificationRuntime();
    }
  }


  async function initialisePlayer() {
    let setupStage =
      "checking the existing session";

    try {
      const {
        data: { session },
        error: sessionError
      } = await supabaseClient.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      let activeSession = session;

      if (!activeSession) {
        setupStage =
          "creating an anonymous account";

        const {
          data,
          error
        } =
          await supabaseClient.auth
            .signInAnonymously();

        if (error) {
          throw error;
        }

        activeSession = data.session;
      }

      state.user =
        activeSession?.user ?? null;

      if (!state.user) {
        throw new Error(
          "Supabase did not return a player account."
        );
      }

      setupStage =
        "loading the player profile";

      await loadPlayerProfile();

      console.log(
        "Player authentication ready:",
        {
          id: state.user.id,
          email: state.user.email,
          anonymous:
            state.user.is_anonymous
        }
      );
    } catch (error) {
      console.error(
        `Player setup failed while ${setupStage}:`,
        error
      );

      alert(
        `Player setup failed while ${setupStage}.\n\n` +
        `${error?.message || String(error)}`
      );
    }
  }
  async function loadPlayerProfile() {
    if (!state.user) {
      state.profile = null;
      updateAccountUI();
      return null;
    }

    const { data, error } =
      await supabaseClient
        .from("profiles")
        .select(
          "id, display_name, account_number"
        )
        .eq("id", state.user.id)
        .maybeSingle();

    if (error) {
      throw error;
    }

    state.profile = data ?? null;

    if (state.profile?.display_name) {
      localStorage.setItem(
        "triviaRushPlayerName",
        state.profile.display_name
      );
    }

    updateAccountUI();
    return state.profile;
  }
  async function ensurePlayerProfile() {
    if (state.profile) {
      return true;
    }

    if (!state.user) {
      alert(
        "The player account is not ready. Reload the page and try again."
      );
      return false;
    }

    // Phase 3: profile creation is delegated to saveProfileUsername so the
    // insert logic, duplicate-name handling and localStorage write exist in
    // exactly one place.
    while (!state.profile) {
      const displayName = requestPlayerName();

      if (!displayName) {
        return false;
      }

      try {
        await saveProfileUsername(
          displayName
        );
      } catch (error) {
        const isDuplicateName =
          String(
            error?.message || ""
          ).includes("already being used");

        if (isDuplicateName) {
          localStorage.removeItem(
            "triviaRushPlayerName"
          );
          alert(
            "That player name is already being used. Choose another name."
          );
          continue;
        }

        console.error(
          "Could not create player profile:",
          error
        );
        alert(
          `The player profile could not be created.\n\n${error?.message || error}`
        );
        return false;
      }
    }

    updateAccountUI();
    return true;
  }

  function requestPlayerName() {
    const savedName = localStorage.getItem("triviaRushPlayerName");

    const enteredName = window.prompt(
      "Choose a public leaderboard name:",
      savedName || ""
    );

    if (enteredName === null) {
      return null;
    }

    const cleanedName = enteredName.trim();

    if (cleanedName.length < 3 || cleanedName.length > 24) {
      alert("Your player name must be between 3 and 24 characters.");
      return requestPlayerName();
    }

    localStorage.setItem("triviaRushPlayerName", cleanedName);
    return cleanedName;
  }
  function openAccountDialog(
    clearStatus = true
  ) {
    if (!elements.accountDialog) {
      console.error(
        "The #accountDialog element is missing."
      );
      alert(
        "The account window could not be opened."
      );
      return;
    }

    if (clearStatus) {
      setAccountStatus("");
    }

    updateAccountUI();

    if (!elements.accountDialog.open) {
      elements.accountDialog.showModal();
    }
  }

  function closeAccountDialog() {
    if (elements.accountDialog?.open) {
      elements.accountDialog.close();
    }
  }

  function setAccountMode(mode) {
    state.accountMode =
      mode === "signin"
        ? "signin"
        : "create";
    setAccountStatus("");
    updateAccountUI();
  }

  function formatAccountIdentifier(
    accountNumber
  ) {
    const parsedNumber =
      Number(accountNumber);

    if (
      !Number.isInteger(parsedNumber) ||
      parsedNumber < 1
    ) {
      return "#----";
    }

    return `#${String(parsedNumber)
      .padStart(4, "0")}`;
  }

  function hasCompletedPasswordSetup() {
    return (
      state.user?.user_metadata
        ?.password_setup_complete === true
    );
  }

  function isPasswordSetupPending() {
    return Boolean(
      state.user?.email &&
      !state.user?.is_anonymous &&
      !hasCompletedPasswordSetup() &&
      state.user?.user_metadata
        ?.account_setup_stage ===
        "awaiting_password"
    );
  }

  function updateAccountUI() {
    const isPermanentAccount = Boolean(
      state.user?.email &&
      !state.user?.is_anonymous
    );
    const setupPending =
      isPasswordSetupPending();
    const isRecovery =
      state.recoveryMode === true;
    const playerName =
      state.profile?.display_name ||
      "Guest player";

    if (elements.accountButtonText) {
      elements.accountButtonText.textContent =
        state.profile?.display_name ||
        "Account";
    }

    if (elements.notificationButton) {
      elements.notificationButton.hidden = !isPermanentAccount;
    }

    if (elements.accountPlayerName) {
      elements.accountPlayerName.textContent =
        playerName;
    }

    if (elements.accountIdentifier) {
      elements.accountIdentifier.textContent =
        formatAccountIdentifier(
          state.profile?.account_number
        );
    }

    if (
      elements.createUsername &&
      !elements.createUsername.value
    ) {
      elements.createUsername.value =
        state.profile?.display_name || "";
    }

    if (elements.manageUsername) {
      elements.manageUsername.value =
        state.profile?.display_name || "";
    }

    if (elements.manageEmail) {
      elements.manageEmail.value =
        state.user?.email || "";
    }

    const showGuestAuth =
      !isPermanentAccount && !isRecovery;
    const showCreate =
      showGuestAuth &&
      state.accountMode === "create";
    const showSignIn =
      showGuestAuth &&
      state.accountMode === "signin";
    const showSetup =
      setupPending && !isRecovery;
    const showManage =
      isPermanentAccount &&
      !setupPending &&
      !isRecovery;

    if (elements.accountAuthTabs) {
      elements.accountAuthTabs.hidden =
        !showGuestAuth;
    }
    if (elements.createAccountForm) {
      elements.createAccountForm.hidden =
        !showCreate;
    }
    if (elements.signInForm) {
      elements.signInForm.hidden =
        !showSignIn;
    }
    if (elements.accountSetupForm) {
      elements.accountSetupForm.hidden =
        !showSetup;
    }
    if (elements.manageAccountForm) {
      elements.manageAccountForm.hidden =
        !showManage;
    }
    if (elements.passwordRecoveryForm) {
      elements.passwordRecoveryForm.hidden =
        !isRecovery;
    }

    if (elements.showCreateAccountButton) {
      const active =
        state.accountMode === "create";
      elements.showCreateAccountButton
        .classList.toggle("active", active);
      elements.showCreateAccountButton
        .setAttribute(
          "aria-selected",
          String(active)
        );
    }

    if (elements.showSignInButton) {
      const active =
        state.accountMode === "signin";
      elements.showSignInButton
        .classList.toggle("active", active);
      elements.showSignInButton
        .setAttribute(
          "aria-selected",
          String(active)
        );
    }

    if (!elements.accountDescription) {
      return;
    }

    if (isRecovery) {
      elements.accountDescription.textContent =
        "Set a new password for your account.";
    } else if (setupPending) {
      elements.accountDescription.textContent =
        "Your email is verified. Finish creating your account by choosing a password.";
    } else if (showManage) {
      elements.accountDescription.textContent =
        "Manage your public username, password and session.";
    } else if (showSignIn) {
      elements.accountDescription.textContent =
        "Sign in to restore your player profile and leaderboard progress.";
    } else {
      elements.accountDescription.textContent =
        "Create an account to protect your leaderboard progress.";
    }

    if (
      elements.accountStatus &&
      !elements.accountStatus.textContent
    ) {
      if (setupPending) {
        setAccountStatus(
          "Email verified. Choose your password to complete setup."
        );
      } else if (showManage) {
        setAccountStatus(
          `Signed in as ${state.user.email}.`
        );
      } else if (showGuestAuth) {
        setAccountStatus(
          "You are currently playing as a guest."
        );
      }
    }

    if (elements.socialScreen?.classList.contains("active")) {
      const permanentForDuels = state.user?.is_anonymous === false && Boolean(state.profile);
      elements.duelAccountGate.hidden = permanentForDuels;
      elements.socialContent.hidden = !permanentForDuels;
      if (permanentForDuels) {
        void loadSocialData();
      }
    }
  }

  function getAuthRedirectUrl() {
    const redirectUrl =
      new URL(window.location.href);
    redirectUrl.search = "";
    redirectUrl.hash = "";
    return redirectUrl.toString();
  }

  async function saveProfileUsername(
    username
  ) {
    if (!state.user) {
      throw new Error(
        "No authenticated player is available."
      );
    }

    let result;

    if (state.profile) {
      result = await supabaseClient
        .from("profiles")
        .update({
          display_name: username
        })
        .eq("id", state.user.id)
        .select(
          "id, display_name, account_number"
        )
        .single();
    } else {
      result = await supabaseClient
        .from("profiles")
        .insert({
          id: state.user.id,
          display_name: username
        })
        .select(
          "id, display_name, account_number"
        )
        .single();
    }

    if (result.error) {
      if (result.error.code === "23505") {
        throw new Error(
          "That username is already being used."
        );
      }
      throw result.error;
    }

    state.profile = result.data;
    localStorage.setItem(
      "triviaRushPlayerName",
      username
    );
    updateAccountUI();
    return state.profile;
  }

  function setAccountStatus(
    message,
    isError = false
  ) {
    if (!elements.accountStatus) {
      if (message) {
        console[isError ? "error" : "log"](
          message
        );
      }
      return;
    }

    elements.accountStatus.textContent =
      message;
    elements.accountStatus.className =
      isError
        ? "account-status error"
        : "account-status";
  }

  function readUsernameInput(element) {
    const username =
      element?.value.trim() || "";

    if (
      username.length < 3 ||
      username.length > 24
    ) {
      setAccountStatus(
        "Username must contain between 3 and 24 characters.",
        true
      );
      return null;
    }

    return username;
  }

  function readEmailInput(element) {
    const email =
      element?.value.trim().toLowerCase() ||
      "";

    if (element) {
      element.value = email;
    }

    if (
      !email ||
      !element?.checkValidity()
    ) {
      setAccountStatus(
        "Enter a valid email address.",
        true
      );
      return null;
    }

    return email;
  }

  function readPasswordInput(element) {
    const password =
      element?.value || "";

    if (password.length < 8) {
      setAccountStatus(
        "Password must contain at least 8 characters.",
        true
      );
      return null;
    }

    return password;
  }

  function readPasswordPair(
    passwordElement,
    confirmationElement
  ) {
    const password =
      readPasswordInput(passwordElement);

    if (!password) {
      return null;
    }

    if (
      password !==
      (confirmationElement?.value || "")
    ) {
      setAccountStatus(
        "The two passwords do not match.",
        true
      );
      return null;
    }

    return password;
  }

  function clearPasswordFields() {
    [
      elements.signInPassword,
      elements.setupPassword,
      elements.setupPasswordConfirm,
      elements.newPassword,
      elements.newPasswordConfirm,
      elements.recoveryPassword,
      elements.recoveryPasswordConfirm
    ].forEach((element) => {
      if (element) {
        element.value = "";
      }
    });
  }

  function setAccountBusy(isBusy) {
    elements.accountDialog
      ?.querySelectorAll(
        "[data-account-control]"
      )
      .forEach((element) => {
        element.disabled = isBusy;
      });
  }

  function isNetworkLoadError(error) {
    const message = String(
      error?.message || error || ""
    ).toLowerCase();

    return (
      error instanceof TypeError ||
      message.includes("load failed") ||
      message.includes("failed to fetch") ||
      message.includes(
        "network request failed"
      ) ||
      message.includes("networkerror")
    );
  }

  function getFriendlyAuthError(
    error,
    fallback
  ) {
    if (isNetworkLoadError(error)) {
      return "Trivia Rush could not contact Supabase. Open the game directly in Safari or Chrome rather than an in-app browser, then try again.";
    }

    return error?.message || fallback;
  }

  async function runAuthRequest(operation) {
    let lastError = null;

    for (
      let attempt = 1;
      attempt <= 2;
      attempt += 1
    ) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (
          !isNetworkLoadError(error) ||
          attempt === 2
        ) {
          throw error;
        }

        await wait(1200);
      }
    }

    throw lastError;
  }

  async function createAccount() {
    if (!state.user) {
      setAccountStatus(
        "The player account is not ready. Reload the page and try again.",
        true
      );
      return;
    }

    const username =
      readUsernameInput(
        elements.createUsername
      );
    const email =
      readEmailInput(elements.createEmail);

    if (!username || !email) {
      return;
    }

    setAccountBusy(true);
    setAccountStatus(
      "Creating your account…"
    );

    try {
      await saveProfileUsername(username);

      const currentMetadata =
        state.user.user_metadata || {};
      const { data, error } =
        await runAuthRequest(() =>
          supabaseClient.auth.updateUser(
            {
              email,
              data: {
                ...currentMetadata,
                display_name: username,
                account_setup_stage:
                  "awaiting_password",
                password_setup_complete:
                  false
              }
            },
            {
              emailRedirectTo:
                getAuthRedirectUrl()
            }
          )
        );

      if (error) {
        throw error;
      }

      state.user =
        data.user || state.user;
      setAccountStatus(
        "Verification email sent. Open the link, return to Trivia Rush and choose your password."
      );
    } catch (error) {
      console.error(
        "Could not create account:",
        error
      );
      const message =
        getFriendlyAuthError(
          error,
          "Account creation failed."
        );
      setAccountStatus(
        message.toLowerCase().includes(
          "already"
        )
          ? "That email or username is already in use. Try signing in instead."
          : message,
        true
      );
    } finally {
      setAccountBusy(false);
      updateAccountUI();
    }
  }

  async function finishAccountSetup() {
    const password = readPasswordPair(
      elements.setupPassword,
      elements.setupPasswordConfirm
    );

    if (!password) {
      return;
    }

    setAccountBusy(true);
    setAccountStatus(
      "Finishing account setup…"
    );

    try {
      const currentMetadata =
        state.user?.user_metadata || {};
      const { data, error } =
        await runAuthRequest(() =>
          supabaseClient.auth.updateUser({
            password,
            data: {
              ...currentMetadata,
              account_setup_stage:
                "complete",
              password_setup_complete: true
            }
          })
        );

      if (error) {
        throw error;
      }

      state.user =
        data.user || state.user;
      clearPasswordFields();
      setAccountStatus(
        "Account created successfully. Your scores are protected."
      );
      updateAccountUI();
    } catch (error) {
      console.error(
        "Could not finish account setup:",
        error
      );
      setAccountStatus(
        getFriendlyAuthError(
          error,
          "Account setup failed."
        ),
        true
      );
    } finally {
      setAccountBusy(false);
    }
  }

  async function signInToAccount() {
    const email =
      readEmailInput(elements.signInEmail);
    const password =
      readPasswordInput(
        elements.signInPassword
      );

    if (!email || !password) {
      return;
    }

    setAccountBusy(true);
    setAccountStatus("Signing in…");

    try {
      const { data, error } =
        await runAuthRequest(() =>
          supabaseClient.auth
            .signInWithPassword({
              email,
              password
            })
        );

      if (error) {
        throw error;
      }

      state.user = data.user;
      state.profile = null;
      state.recoveryMode = false;

      if (
        !hasCompletedPasswordSetup()
      ) {
        const currentMetadata =
          state.user.user_metadata || {};
        const {
          data: updatedData,
          error: metadataError
        } = await supabaseClient.auth
          .updateUser({
            data: {
              ...currentMetadata,
              account_setup_stage:
                "complete",
              password_setup_complete: true
            }
          });

        if (
          !metadataError &&
          updatedData.user
        ) {
          state.user = updatedData.user;
        }
      }

      await loadPlayerProfile();
      clearPasswordFields();
      setAccountStatus(
        "Signed in successfully. Your saved progress has been restored."
      );
      updateAccountUI();
    } catch (error) {
      console.error(
        "Could not sign in:",
        error
      );
      setAccountStatus(
        isNetworkLoadError(error)
          ? getFriendlyAuthError(error)
          : "Sign-in failed. Check your email address and password.",
        true
      );
    } finally {
      setAccountBusy(false);
    }
  }

  async function saveUsername() {
    const username =
      readUsernameInput(
        elements.manageUsername
      );

    if (!username) {
      return;
    }

    setAccountBusy(true);
    setAccountStatus(
      "Saving username…"
    );

    try {
      await saveProfileUsername(username);

      const currentMetadata =
        state.user?.user_metadata || {};
      const { data, error } =
        await supabaseClient.auth
          .updateUser({
            data: {
              ...currentMetadata,
              display_name: username
            }
          });

      if (error) {
        console.warn(
          "Username metadata was not updated:",
          error
        );
      } else if (data.user) {
        state.user = data.user;
      }

      setAccountStatus(
        "Username updated. Your player number and scores are unchanged."
      );
      updateAccountUI();
    } catch (error) {
      console.error(
        "Could not save username:",
        error
      );
      setAccountStatus(
        error?.message ||
          "Username could not be saved.",
        true
      );
    } finally {
      setAccountBusy(false);
    }
  }

  async function changePassword() {
    const password = readPasswordPair(
      elements.newPassword,
      elements.newPasswordConfirm
    );

    if (!password) {
      return;
    }

    setAccountBusy(true);
    setAccountStatus(
      "Changing password…"
    );

    try {
      const currentMetadata =
        state.user?.user_metadata || {};
      const { data, error } =
        await runAuthRequest(() =>
          supabaseClient.auth.updateUser({
            password,
            data: {
              ...currentMetadata,
              account_setup_stage:
                "complete",
              password_setup_complete: true
            }
          })
        );

      if (error) {
        throw error;
      }

      state.user =
        data.user || state.user;
      clearPasswordFields();
      setAccountStatus(
        "Password changed successfully."
      );
    } catch (error) {
      console.error(
        "Could not change password:",
        error
      );
      setAccountStatus(
        getFriendlyAuthError(
          error,
          "Password could not be changed."
        ),
        true
      );
    } finally {
      setAccountBusy(false);
    }
  }

  async function sendPasswordResetEmail() {
    const email =
      readEmailInput(elements.signInEmail);

    if (!email) {
      return;
    }

    setAccountBusy(true);
    setAccountStatus(
      "Sending password-reset email…"
    );

    try {
      const { error } =
        await runAuthRequest(() =>
          supabaseClient.auth
            .resetPasswordForEmail(
              email,
              {
                redirectTo:
                  getAuthRedirectUrl()
              }
            )
        );

      if (error) {
        throw error;
      }

      setAccountStatus(
        "Check your email for a password-reset link."
      );
    } catch (error) {
      console.error(
        "Could not send reset email:",
        error
      );
      setAccountStatus(
        getFriendlyAuthError(
          error,
          "The reset email could not be sent."
        ),
        true
      );
    } finally {
      setAccountBusy(false);
    }
  }

  async function completePasswordRecovery() {
    const password = readPasswordPair(
      elements.recoveryPassword,
      elements.recoveryPasswordConfirm
    );

    if (!password) {
      return;
    }

    setAccountBusy(true);
    setAccountStatus(
      "Saving new password…"
    );

    try {
      const currentMetadata =
        state.user?.user_metadata || {};
      const { data, error } =
        await runAuthRequest(() =>
          supabaseClient.auth.updateUser({
            password,
            data: {
              ...currentMetadata,
              account_setup_stage:
                "complete",
              password_setup_complete: true
            }
          })
        );

      if (error) {
        throw error;
      }

      state.user =
        data.user || state.user;
      state.recoveryMode = false;
      clearPasswordFields();
      setAccountStatus(
        "Password reset successfully."
      );
      updateAccountUI();
    } catch (error) {
      console.error(
        "Could not reset password:",
        error
      );
      setAccountStatus(
        getFriendlyAuthError(
          error,
          "Password could not be reset."
        ),
        true
      );
    } finally {
      setAccountBusy(false);
    }
  }

  async function signOutAccount() {
    setAccountBusy(true);
    setAccountStatus("Signing out…");

    try {
      const { error: signOutError } =
        await supabaseClient.auth.signOut();

      if (signOutError) {
        throw signOutError;
      }

      const { data, error } =
        await supabaseClient.auth
          .signInAnonymously();

      if (error) {
        throw error;
      }

      state.user = data.user;
      state.profile = null;
      state.recoveryMode = false;
      state.accountMode = "create";
      localStorage.removeItem(
        "triviaRushPlayerName"
      );

      await loadPlayerProfile();
      clearPasswordFields();
      setAccountStatus(
        "Signed out. You are now playing as a guest."
      );
      updateAccountUI();
    } catch (error) {
      console.error(
        "Could not sign out:",
        error
      );
      setAccountStatus(
        getFriendlyAuthError(
          error,
          "Could not sign out."
        ),
        true
      );
    } finally {
      setAccountBusy(false);
    }
  }

  async function loadQuestionCategories() {
    elements.startButton.disabled = true;
    setStartStatus("Loading the question bank…");

    const { data, error } = await supabaseClient.rpc(
      "get_question_categories"
    );

    if (error) {
      console.error("Could not load question categories:", error);
      setStartStatus(
        "The question bank could not be loaded. Try refreshing after the Phase 4A database migration is deployed.",
        true
      );
      return;
    }

    const categories = (Array.isArray(data) ? data : [])
      .map((category) => ({
        id: String(category.category_id || "").trim().toLowerCase(),
        label: String(category.label || "").trim(),
        questionCount: Number(category.question_count || 0),
        iconKey: String(category.icon_key || "").trim().toLowerCase(),
        color: String(category.color || "").trim().toUpperCase(),
        sortOrder: Number(category.sort_order || 0)
      }))
      .filter((category) =>
        category.id &&
        category.label &&
        category.questionCount >= 80
      );

    if (categories.length === 0) {
      setStartStatus(
        "The question bank is incomplete. Each active category needs at least 80 questions.",
        true
      );
      return;
    }

    state.categories = categories;
    populateCategories();
    buildLeaderboardCategoryFilters();
    elements.startButton.disabled = false;
    setStartStatus("");
  }

  function setStartStatus(message, isError = false) {
    if (!elements.startStatus) {
      return;
    }

    elements.startStatus.textContent = message;
    elements.startStatus.classList.toggle("error", isError);
  }

  function populateCategories() {
    const options = [
      { id: "mixed", label: "All categories" },
      ...state.categories
    ];

    elements.categorySelect.replaceChildren();
    options.forEach((category) => {
      const option = document.createElement("option");
      option.value = category.id;
      option.textContent = category.label;
      elements.categorySelect.appendChild(option);
    });

    if (elements.duelCategorySelect) {
      elements.duelCategorySelect.replaceChildren();
      options.forEach((category) => {
        const option = document.createElement("option");
        option.value = category.id;
        option.textContent = category.label;
        elements.duelCategorySelect.appendChild(option);
      });
    }
  }

  // Category IDs and labels come from the same controlled database RPC used
  // by the game selector. This keeps question delivery, stored sessions and
  // leaderboard filters on one taxonomy.
  function buildLeaderboardCategoryFilters() {
    if (!elements.leaderboardCategoryFilters) {
      return;
    }

    const categories = [
      { id: "overall", label: "Overall" },
      { id: "mixed", label: "Mixed" },
      ...state.categories.map(({ id, label }) => ({ id, label }))
    ];

    state.leaderboardCategories = categories;

    if (
      !categories.some(
        (category) =>
          category.id ===
          state.leaderboardCategory
      )
    ) {
      state.leaderboardCategory = "overall";
    }

    elements.leaderboardCategoryFilters
      .replaceChildren();

    categories.forEach((category) => {
      const button =
        document.createElement("button");

      button.type = "button";
      button.className = "leaderboard-filter";
      button.dataset.leaderboardCategory =
        category.id;
      button.setAttribute(
        "aria-pressed",
        "false"
      );
      button.textContent = category.label;

      button.addEventListener(
        "click",
        () => {
          setLeaderboardCategory(
            category.id
          );
        }
      );

      elements.leaderboardCategoryFilters
        .appendChild(button);
    });
  }

  function getLeaderboardCategoryButtons() {
    return [
      ...(
        elements.leaderboardCategoryFilters
          ?.querySelectorAll(
            "[data-leaderboard-category]"
          ) ?? []
      )
    ];
  }
  function bindEvents() {
    elements.notificationButton?.addEventListener("click", openNotifications);
    elements.duelButton?.addEventListener("click", openSocialScreen);
    elements.closeSocialButton?.addEventListener("click", closeSocialScreen);
    elements.openAccountForDuelButton?.addEventListener("click", () => openAccountDialog(true));
    elements.duelFormatSelect?.addEventListener("change", updateDuelFormatUI);
    elements.createDuelButton?.addEventListener("click", createDuel);
    elements.joinDuelButton?.addEventListener("click", () => joinDuel(elements.duelRoomCode.value));
    elements.copyDuelLinkButton?.addEventListener("click", copyDuelInviteLink);
    elements.startTurnChallengeButton?.addEventListener("click", () => startTurnChallenge());
    elements.declineTurnChallengeButton?.addEventListener("click", () => declineTurnChallenge());
    elements.cancelDuelButton?.addEventListener("click", cancelWaitingDuel);
    elements.backFromDuelWaitingButton?.addEventListener("click", openSocialScreen);
    elements.addFriendButton?.addEventListener("click", addFriend);
    elements.historyOpponentFilter?.addEventListener("change", loadDuelHistory);
    elements.duelPassButton?.addEventListener("click", () => submitDuelAnswer(null));
    elements.duelRematchButton?.addEventListener("click", createRematch);
    elements.duelResultsHomeButton?.addEventListener("click", openSocialScreen);
    elements.duelLeaderboardFormatButtons.forEach((button) => {
      button.addEventListener("click", () => {
        setDuelLeaderboardFormat(button.dataset.duelLeaderboardFormat);
      });
    });
    elements.markNotificationsReadButton?.addEventListener("click", markAllNotificationsRead);
    elements.pushNotificationsButton?.addEventListener("click", togglePushNotifications);
    [
      elements.challengeNotificationsToggle,
      elements.friendNotificationsToggle,
      elements.emailNotificationsToggle
    ].forEach((control) => control?.addEventListener("change", saveNotificationPreferences));
    elements.startButton?.addEventListener(
      "click",
      beginCountdown
    );
    elements.playAgainButton?.addEventListener(
      "click",
      beginCountdown
    );
    elements.homeButton?.addEventListener(
      "click",
      showHome
    );
    elements.passButton?.addEventListener(
      "click",
      passQuestion
    );
    elements.voiceButton?.addEventListener(
      "click",
      toggleVoiceRecognition
    );
    elements.soundToggle?.addEventListener(
      "click",
      toggleSound
    );
    elements.hostToggle?.addEventListener(
      "click",
      toggleHost
    );

    elements.leaderboardButton
      ?.addEventListener(
        "click",
        openLeaderboard
      );
    elements.resultsLeaderboardButton
      ?.addEventListener(
        "click",
        openLeaderboard
      );
    elements.closeLeaderboardButton
      ?.addEventListener(
        "click",
        closeLeaderboard
      );
    elements.leaderboardRetryButton
      ?.addEventListener(
        "click",
        loadLeaderboard
      );

    elements.leaderboardPeriodButtons
      .forEach((button) => {
        button.addEventListener(
          "click",
          () => {
            setLeaderboardPeriod(
              button.dataset
                .leaderboardPeriod
            );
          }
        );
      });

    elements.retrySaveButton
      ?.addEventListener(
        "click",
        () => {
          void saveGameResult();
        }
      );

    elements.accountButton?.addEventListener(
      "click",
      () => openAccountDialog(true)
    );
    elements.closeAccountDialogButton
      ?.addEventListener(
        "click",
        closeAccountDialog
      );
    elements.showCreateAccountButton
      ?.addEventListener(
        "click",
        () => setAccountMode("create")
      );
    elements.showSignInButton
      ?.addEventListener(
        "click",
        () => setAccountMode("signin")
      );
    elements.createAccountButton
      ?.addEventListener(
        "click",
        createAccount
      );
    elements.signInButton
      ?.addEventListener(
        "click",
        signInToAccount
      );
    elements.forgotPasswordButton
      ?.addEventListener(
        "click",
        sendPasswordResetEmail
      );
    elements.finishAccountSetupButton
      ?.addEventListener(
        "click",
        finishAccountSetup
      );
    elements.saveUsernameButton
      ?.addEventListener(
        "click",
        saveUsername
      );
    elements.changePasswordButton
      ?.addEventListener(
        "click",
        changePassword
      );
    elements.completeRecoveryButton
      ?.addEventListener(
        "click",
        completePasswordRecovery
      );
    elements.signOutButton
      ?.addEventListener(
        "click",
        signOutAccount
      );

    elements.accountDialog?.addEventListener(
      "click",
      (event) => {
        if (
          event.target ===
          elements.accountDialog
        ) {
          closeAccountDialog();
        }
      }
    );

    elements.howToButton?.addEventListener(
      "click",
      () => {
        elements.howToDialog?.showModal();
      }
    );
    elements.closeDialogButton
      ?.addEventListener(
        "click",
        () => {
          elements.howToDialog?.close();
        }
      );
    elements.howToDialog?.addEventListener(
      "click",
      (event) => {
        if (
          event.target ===
          elements.howToDialog
        ) {
          elements.howToDialog.close();
        }
      }
    );

    document.addEventListener(
      "keydown",
      handleKeyboard
    );
  }

  function showScreen(screen) {
    elements.screens.forEach((item) => {
      item.classList.toggle(
        "active",
        item === screen
      );
    });

    const gameIsRunning =
      screen === elements.gameScreen ||
      screen === elements.countdownScreen ||
      screen === elements.duelWaitingScreen ||
      screen === elements.duelGameScreen;

    if (elements.leaderboardButton) {
      elements.leaderboardButton.disabled =
        gameIsRunning;
    }

    if (elements.accountButton) {
      elements.accountButton.disabled =
        gameIsRunning;
    }

    if (elements.duelButton) {
      elements.duelButton.disabled = gameIsRunning;
    }

    if (elements.notificationButton) {
      elements.notificationButton.disabled = gameIsRunning;
    }
  }

  async function beginCountdown() {
    if (state.starting) {
      return;
    }

    state.starting = true;
    const profileReady =
      await ensurePlayerProfile();

    if (!profileReady) {
      state.starting = false;
      return;
    }

    state.selectedCategory =
      elements.categorySelect.value;

    resetGame();

    showScreen(
      elements.countdownScreen
    );

    stopSpeaking();

    if (state.hostEnabled) {
      speak("Get ready.");
    }

    const values = [
      "3",
      "2",
      "1",
      "GO!"
    ];

    for (const value of values) {
      elements.countdownNumber.textContent =
        value;

      playTone(
        value === "GO!" ? 660 : 440,
        value === "GO!" ? 0.16 : 0.09
      );

      await wait(
        value === "GO!" ? 450 : 650
      );
    }

    await startGame();
  }

  function resetGame() {
    state.currentQuestion = null;
    state.questionIndex = 0;
    state.score = 0;
    state.streak = 0;
    state.bestStreak = 0;
    state.correct = 0;
    state.answered = 0;
    state.remainingMs = 60 * 1000;
    state.durationSeconds = 60;
    state.runId = null;
    state.completedSessionId = null;
    state.serverEndsAtMs = 0;
    state.serverClockOffsetMs = 0;
    state.locked = false;
    state.gameEnded = false;
    state.scoreSaved = false;
    state.responseTimes = [];

    if (state.pendingQuestionTimer !== null) {
      window.clearTimeout(
        state.pendingQuestionTimer
      );
      state.pendingQuestionTimer = null;
    }

    if (elements.retrySaveButton) {
      elements.retrySaveButton.hidden = true;
    }

    updateHud();

    elements.feedback.textContent = "";
    elements.newHighScore.hidden = true;
  }

  async function startGame() {
    elements.countdownNumber.textContent = "STARTING…";

    const { data, error } = await supabaseClient.rpc(
      "start_solo_game",
      {
        p_game_mode: "rush_60",
        p_category: state.selectedCategory
      }
    );

    if (error || !data?.run_id || !data?.question) {
      console.error("Could not start the game:", error);
      showScreen(elements.startScreen);
      setStartStatus(
        error?.message || "The game could not be started. Please try again.",
        true
      );
      state.starting = false;
      return;
    }

    setStartStatus("");
    state.starting = false;
    state.runId = data.run_id;
    state.durationSeconds = Number(data.duration_seconds) || 60;
    syncServerClock(data.server_now);
    state.serverEndsAtMs = Date.parse(data.ends_at);
    applyAuthoritativeStats(data);
    setCurrentQuestion(data.question);

    showScreen(elements.gameScreen);
    renderQuestion();
    if (state.hostEnabled) {
      speakQuestion();
    }
    timerLoop();
  }

  function timerLoop() {
    state.remainingMs = Math.max(
      0,
      state.serverEndsAtMs - serverNowMs()
    );

    const seconds = Math.ceil(state.remainingMs / 1000);
    const ratio = state.remainingMs / (state.durationSeconds * 1000);

    elements.timerValue.textContent = String(seconds);
    elements.timerProgress.style.strokeDashoffset = String(TIMER_CIRCUMFERENCE * (1 - ratio));

    if (seconds <= 10) {
      elements.timerProgress.style.stroke = "var(--red)";
    } else if (seconds <= 20) {
      elements.timerProgress.style.stroke = "var(--yellow)";
    } else {
      elements.timerProgress.style.stroke = "var(--cyan)";
    }

    if (state.remainingMs <= 0) {
      void endGame();
      return;
    }

    state.timerFrame = requestAnimationFrame(timerLoop);
  }

  async function nextQuestion() {
    state.pendingQuestionTimer = null;

    if (state.remainingMs <= 0) {
      void endGame();
      return;
    }

    stopRecognition();
    elements.feedback.textContent = "";
    elements.feedback.className = "feedback";

    const { data, error } = await supabaseClient.rpc(
      "get_current_solo_question",
      { p_run_id: state.runId }
    );

    if (state.gameEnded) {
      return;
    }

    if (error) {
      console.error("Could not load the next question:", error);
      elements.feedback.textContent = "Connection interrupted — retrying…";
      elements.feedback.className = "feedback wrong";
      state.pendingQuestionTimer = window.setTimeout(nextQuestion, 700);
      return;
    }

    syncServerClock(data?.server_now);

    if (data?.status === "completed" || data?.status === "expired") {
      void endGame(data);
      return;
    }

    if (data?.status === "waiting") {
      const delay = Math.max(
        40,
        Date.parse(data.available_at) - serverNowMs()
      );
      state.pendingQuestionTimer = window.setTimeout(nextQuestion, delay);
      return;
    }

    if (data?.status !== "active" || !data.question) {
      elements.feedback.textContent = "The next question is unavailable — retrying…";
      state.pendingQuestionTimer = window.setTimeout(nextQuestion, 700);
      return;
    }

    applyAuthoritativeStats(data);
    setCurrentQuestion(data.question);
    state.locked = false;

    renderQuestion();
    if (state.hostEnabled) {
      speakQuestion();
    }
  }

  function renderQuestion() {
    const question = state.currentQuestion;
    elements.categoryBadge.textContent = question.categoryLabel;
    elements.questionNumber.textContent = String(state.questionIndex);
    elements.questionText.textContent = question.question;
    elements.answerGrid.innerHTML = "";

    question.answers.forEach((answer, index) => {
      const button = document.createElement("button");
      button.className = "answer-button";
      button.type = "button";
      button.dataset.index = String(index);
      button.innerHTML = `<span class="answer-key">${index + 1}</span><span>${escapeHtml(answer)}</span>`;
      button.addEventListener("click", () => selectAnswer(index));
      elements.answerGrid.appendChild(button);
    });
  }

  async function selectAnswer(index) {
    if (
      state.locked ||
      !state.currentQuestion ||
      state.remainingMs <= 0
    ) {
      return;
    }

    state.locked = true;

    stopRecognition();
    stopSpeaking();

    const buttons = [
      ...elements.answerGrid.querySelectorAll(
        ".answer-button"
      )
    ];

    buttons.forEach((button) => {
      button.disabled = true;
    });

    const requestId = createRequestId();
    const response = await submitAnswerWithRetry(index, requestId);

    if (state.gameEnded) {
      return;
    }

    if (!response) {
      state.locked = false;
      buttons.forEach((button) => {
        button.disabled = false;
      });
      elements.feedback.textContent = "Your answer could not be sent. Please try again.";
      elements.feedback.className = "feedback wrong";
      return;
    }

    if (response.status === "completed" || response.status === "expired") {
      void endGame(response);
      return;
    }

    syncServerClock(response.server_now);
    applyAuthoritativeStats(response);
    const isCorrect = response.is_correct === true;

    buttons.forEach((button, buttonIndex) => {
      if (isCorrect && buttonIndex === index) {
        button.classList.add("correct");
      } else if (!isCorrect && buttonIndex === index) {
        button.classList.add("wrong");
      }
    });

    if (isCorrect) {
      elements.feedback.textContent =
        `Correct! +${response.points_awarded}`;

      elements.feedback.className =
        "feedback correct";

      playSuccessSound();

      if (state.hostEnabled) {
        speak(
          randomItem([
            "Correct.",
            "That's right.",
            "Nice one.",
            "You got it."
          ])
        );
      }
    } else {
      state.streak = 0;

      elements.feedback.textContent =
        `The answer was ${response.correct_answer}.`;

      elements.feedback.className =
        "feedback wrong";

      playWrongSound();

      if (state.hostEnabled) {
        speak(
          `Not this time. The answer was ${
            response.correct_answer
          }.`
        );
      }
    }

    updateHud();

    state.pendingQuestionTimer =
      window.setTimeout(
        nextQuestion,
        getNextQuestionDelay(response.next_question_at)
      );
  }


  async function passQuestion() {
    if (state.locked || state.remainingMs <= 0) {
      return;
    }

    state.locked = true;
    stopRecognition();
    stopSpeaking();
    const response = await submitAnswerWithRetry(null, createRequestId());

    if (state.gameEnded) {
      return;
    }

    if (!response) {
      state.locked = false;
      elements.feedback.textContent = "Your pass could not be sent. Please try again.";
      elements.feedback.className = "feedback wrong";
      return;
    }

    if (response.status === "completed" || response.status === "expired") {
      void endGame(response);
      return;
    }

    syncServerClock(response.server_now);
    applyAuthoritativeStats(response);
    elements.answerGrid.querySelectorAll(".answer-button").forEach((button) => {
      button.disabled = true;
    });
    elements.feedback.textContent = `Passed — the answer was ${response.correct_answer}.`;
    elements.feedback.className = "feedback";
    updateHud();
    playTone(260, 0.08);
    state.pendingQuestionTimer = window.setTimeout(
      nextQuestion,
      getNextQuestionDelay(response.next_question_at)
    );
  }

  async function submitAnswerWithRetry(selectedIndex, requestId) {
    const parameters = {
      p_run_id: state.runId,
      p_position: state.currentQuestion.position,
      p_selected_index: selectedIndex,
      p_request_id: requestId
    };

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const { data, error } = await supabaseClient.rpc(
        "submit_solo_answer",
        parameters
      );

      if (!error) {
        return data;
      }

      console.warn("Could not submit answer:", error);
      if (attempt === 0 && state.remainingMs > 500) {
        await wait(250);
      }
    }

    return null;
  }

  function setCurrentQuestion(question) {
    state.currentQuestion = {
      position: Number(question.position),
      questionId: Number(question.question_id),
      categoryId: question.category_id,
      categoryLabel: question.category_label,
      difficulty: question.difficulty,
      question: question.question,
      answers: Array.isArray(question.answers) ? question.answers : []
    };
    state.questionIndex = state.currentQuestion.position;
  }

  function applyAuthoritativeStats(payload) {
    state.score = Number(payload.score ?? state.score);
    state.streak = Number(payload.streak ?? state.streak);
    state.bestStreak = Number(payload.best_streak ?? state.bestStreak);
    state.answered = Number(payload.questions_answered ?? state.answered);
    state.correct = Number(payload.correct_answers ?? state.correct);
    updateHud();
  }

  function syncServerClock(serverNow) {
    const parsed = Date.parse(serverNow);
    if (Number.isFinite(parsed)) {
      state.serverClockOffsetMs = parsed - Date.now();
    }
  }

  function serverNowMs() {
    return Date.now() + state.serverClockOffsetMs;
  }

  function getNextQuestionDelay(nextQuestionAt) {
    const parsed = Date.parse(nextQuestionAt);
    return Number.isFinite(parsed)
      ? Math.max(40, parsed - serverNowMs())
      : QUESTION_DELAY_MS;
  }

  function createRequestId() {
    if (window.crypto?.randomUUID) {
      return window.crypto.randomUUID();
    }

    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
      const value = Math.floor(Math.random() * 16);
      const nibble = character === "x" ? value : (value & 0x3) | 0x8;
      return nibble.toString(16);
    });
  }

  function updateHud() {
    elements.scoreValue.textContent = state.score.toLocaleString();
    elements.streakValue.textContent = String(state.streak);
  }

  async function endGame(serverPayload = null) {
    if (state.gameEnded) {
      return;
    }

    state.gameEnded = true;

    if (state.pendingQuestionTimer !== null) {
      window.clearTimeout(
        state.pendingQuestionTimer
      );
      state.pendingQuestionTimer = null;
    }

    cancelAnimationFrame(state.timerFrame);

    state.timerFrame = null;
    state.remainingMs = 0;
    state.locked = true;

    stopRecognition();
    stopSpeaking();

    if (serverPayload?.server_now) {
      syncServerClock(serverPayload.server_now);
    }

    const finalPayload = await finishGameRun();
    if (finalPayload) {
      applyAuthoritativeStats(finalPayload);
    }

    const previousHighScore = readNumber(
      "triviaRushHighScore"
    );

    const previousBestStreak = readNumber(
      "triviaRushBestStreak"
    );

    const isNewHighScore =
      state.score > previousHighScore;

    if (isNewHighScore) {
      localStorage.setItem(
        "triviaRushHighScore",
        String(state.score)
      );
    }

    if (
      state.bestStreak >
      previousBestStreak
    ) {
      localStorage.setItem(
        "triviaRushBestStreak",
        String(state.bestStreak)
      );
    }

    const accuracy =
      state.answered === 0
        ? 0
        : Math.round(
            (state.correct /
              state.answered) *
              100
          );

    const resultCopy = getResultCopy(
      state.correct,
      accuracy
    );

    elements.finalScore.textContent =
      state.score.toLocaleString();

    elements.correctTotal.textContent =
      String(state.correct);

    elements.answeredTotal.textContent =
      String(state.answered);

    elements.accuracyTotal.textContent =
      `${accuracy}%`;

    elements.bestStreakTotal.textContent =
      String(state.bestStreak);

    elements.resultTitle.textContent =
      resultCopy.title;

    elements.resultMessage.textContent =
      resultCopy.message;

    state.baseResultMessage =
      resultCopy.message;

    if (state.scoreSaved && state.completedSessionId) {
      setResultSaveMessage(
        "Your server-validated result was saved to the global leaderboard."
      );
    } else if (state.scoreSaved) {
      setResultSaveMessage(
        "No result was saved because no questions were answered."
      );
    } else {
      setResultSaveMessage(
        "Your result could not be finalised. Use Retry save to try again."
      );
    }

    elements.newHighScore.hidden =
      !isNewHighScore;

    updateStartStats();

    showScreen(elements.resultsScreen);

    playFinishSound();

    state.leaderboardRows = [];

    if (state.hostEnabled) {
      speak(
        `Time. You scored ${state.score} points with ${state.correct} correct answers.`
      );
    }
  }

  async function saveGameResult() {
    if (state.scoreSaved) {
      return;
    }

    const finalPayload = await finishGameRun();

    if (finalPayload) {
      applyAuthoritativeStats(finalPayload);
      state.leaderboardRows = [];
      setResultSaveMessage(
        state.completedSessionId
          ? "Your server-validated result was saved to the global leaderboard."
          : "No result was saved because no questions were answered."
      );
    }
  }

  async function finishGameRun() {
    if (!state.runId) {
      return null;
    }

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const { data, error } = await supabaseClient.rpc(
        "finish_solo_game",
        { p_run_id: state.runId }
      );

      if (!error && data) {
        state.scoreSaved = true;
        state.completedSessionId = data.session_id || null;
        syncServerClock(data.server_now);
        if (elements.retrySaveButton) {
          elements.retrySaveButton.hidden = true;
        }
        return data;
      }

      const timerNotExpired = String(error?.message || "")
        .toLowerCase()
        .includes("timer has not expired");

      if (timerNotExpired && attempt < 3) {
        await wait(250);
        continue;
      }

      console.error("Could not finalise game result:", error);
      state.scoreSaved = false;
      if (elements.retrySaveButton) {
        elements.retrySaveButton.hidden = false;
      }
      return null;
    }

    return null;
  }

  // Phase 3: the result message is rebuilt from the stored base copy so a
  // failed save followed by a retry never stacks status sentences.
  function setResultSaveMessage(suffix) {
    if (!elements.resultMessage) {
      return;
    }

    elements.resultMessage.textContent =
      `${state.baseResultMessage} ${suffix}`.trim();
  }

  async function loadLeaderboard() {
    if (
      !elements.leaderboardList ||
      !elements.leaderboardStatus
    ) {
      return [];
    }

    const requestId =
      state.leaderboardRequestId + 1;

    state.leaderboardRequestId =
      requestId;

    setLeaderboardLoadingState();
    updateLeaderboardFilterButtons();

    const parameters = {
      p_period:
        state.leaderboardPeriod,
      p_category:
        state.leaderboardCategory,
      p_limit:
        20
    };

    try {
      const [
        leaderboardResponse,
        playerRankResponse
      ] = await Promise.all([
        supabaseClient.rpc(
          "get_leaderboard_v2",
          parameters
        ),
        supabaseClient.rpc(
          "get_my_leaderboard_rank_v2",
          {
            p_period:
              state.leaderboardPeriod,
            p_category:
              state.leaderboardCategory
          }
        )
      ]);

      if (
        requestId !==
        state.leaderboardRequestId
      ) {
        return [];
      }

      if (leaderboardResponse.error) {
        throw leaderboardResponse.error;
      }

      const rows =
        Array.isArray(
          leaderboardResponse.data
        )
          ? leaderboardResponse.data
          : [];

      state.leaderboardRows =
        rows;

      renderLeaderboard(rows);

      if (playerRankResponse.error) {
        console.warn(
          "Could not load the current player's rank:",
          playerRankResponse.error
        );

        renderCurrentPlayerRank(null);
      } else {
        const playerRank =
          Array.isArray(
            playerRankResponse.data
          )
            ? playerRankResponse.data[0] ||
              null
            : playerRankResponse.data ||
              null;

        renderCurrentPlayerRank(
          playerRank
        );
      }

      return rows;
    } catch (error) {
      if (
        requestId !==
        state.leaderboardRequestId
      ) {
        return [];
      }

      console.error(
        "Could not load the global leaderboard:",
        error
      );

      setLeaderboardErrorState(
        getLeaderboardErrorMessage(
          error
        )
      );

      return [];
    }
  }


  function openLeaderboard() {
    if (!elements.leaderboardScreen) {
      return;
    }

    const activeScreen =
      elements.screens.find(
        (screen) =>
          screen.classList.contains(
            "active"
          )
      );

    if (
      activeScreen ===
        elements.gameScreen ||
      activeScreen ===
        elements.countdownScreen
    ) {
      return;
    }

    if (
      activeScreen &&
      activeScreen !==
        elements.leaderboardScreen
    ) {
      state.leaderboardReturnScreen =
        activeScreen;
    }

    showScreen(
      elements.leaderboardScreen
    );

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });

    void loadLeaderboard();
  }


  function closeLeaderboard() {
    const returnScreen =
      state.leaderboardReturnScreen &&
      document.body.contains(
        state.leaderboardReturnScreen
      )
        ? state.leaderboardReturnScreen
        : elements.startScreen;

    state.leaderboardReturnScreen =
      null;

    showScreen(returnScreen);
  }


  function setLeaderboardPeriod(period) {
    const allowedPeriods =
      new Set([
        "all",
        "week",
        "today"
      ]);

    const nextPeriod =
      allowedPeriods.has(period)
        ? period
        : "all";

    if (
      state.leaderboardPeriod ===
      nextPeriod
    ) {
      return;
    }

    state.leaderboardPeriod =
      nextPeriod;

    updateLeaderboardFilterButtons();
    void loadLeaderboard();
  }


  function setLeaderboardCategory(
    category
  ) {
    const allowedCategories = new Set(
      state.leaderboardCategories.map(
        (item) => item.id
      )
    );

    const nextCategory =
      allowedCategories.has(category)
        ? category
        : "overall";

    if (
      state.leaderboardCategory ===
      nextCategory
    ) {
      return;
    }

    state.leaderboardCategory =
      nextCategory;

    updateLeaderboardFilterButtons();
    void loadLeaderboard();
  }


  function updateLeaderboardFilterButtons() {
    elements.leaderboardPeriodButtons
      .forEach((button) => {
        const active =
          button.dataset
            .leaderboardPeriod ===
          state.leaderboardPeriod;

        button.classList.toggle(
          "active",
          active
        );

        button.setAttribute(
          "aria-pressed",
          String(active)
        );
      });

    getLeaderboardCategoryButtons()
      .forEach((button) => {
        const active =
          button.dataset
            .leaderboardCategory ===
          state.leaderboardCategory;

        button.classList.toggle(
          "active",
          active
        );

        button.setAttribute(
          "aria-pressed",
          String(active)
        );
      });

    if (
      elements.leaderboardFilterSummary
    ) {
      elements.leaderboardFilterSummary
        .textContent =
          getLeaderboardFilterSummary();
    }
  }


  function getLeaderboardFilterSummary() {
    const periodLabels = {
      all: "All-time",
      week: "This week's",
      today: "Today's"
    };

    const category =
      state.leaderboardCategories.find(
        (item) =>
          item.id ===
          state.leaderboardCategory
      );

    const categoryLabel =
      state.leaderboardCategory ===
      "overall"
        ? "overall"
        : category?.label ??
          state.leaderboardCategory;

    return `${
      periodLabels[
        state.leaderboardPeriod
      ]
    } ${categoryLabel} rankings`;
  }


  function setLeaderboardLoadingState() {
    elements.leaderboardList
      .replaceChildren();

    elements.leaderboardStatus
      .textContent =
        "Loading leaderboard…";

    elements.leaderboardStatus
      .className =
        "leaderboard-status loading";

    if (
      elements.leaderboardRetryButton
    ) {
      elements.leaderboardRetryButton
        .hidden = true;
    }

    if (elements.currentPlayerRank) {
      elements.currentPlayerRank.hidden =
        true;
    }
  }


  function setLeaderboardErrorState(
    message
  ) {
    elements.leaderboardList
      .replaceChildren();

    elements.leaderboardStatus
      .textContent = message;

    elements.leaderboardStatus
      .className =
        "leaderboard-status error";

    if (
      elements.leaderboardRetryButton
    ) {
      elements.leaderboardRetryButton
        .hidden = false;
    }

    if (elements.currentPlayerRank) {
      elements.currentPlayerRank.hidden =
        true;
    }
  }


  function renderLeaderboard(rows) {
    elements.leaderboardList
      .replaceChildren();

    if (rows.length === 0) {
      elements.leaderboardStatus
        .textContent =
          "No scores have been recorded for these filters yet.";

      elements.leaderboardStatus
        .className =
          "leaderboard-status empty";

      return;
    }

    const fragment =
      document.createDocumentFragment();

    rows.forEach((row) => {
      fragment.appendChild(
        createLeaderboardRow(row)
      );
    });

    elements.leaderboardList
      .appendChild(fragment);

    elements.leaderboardStatus
      .textContent =
        `Showing the top ${
          rows.length
        } player${
          rows.length === 1 ? "" : "s"
        }.`;

    elements.leaderboardStatus
      .className =
        "leaderboard-status success";

    if (
      elements.leaderboardRetryButton
    ) {
      elements.leaderboardRetryButton
        .hidden = true;
    }
  }


  function createLeaderboardRow(row) {
    const article =
      document.createElement("article");

    const isCurrentPlayer =
      row.is_current_player === true ||
      (
        Number(
          row.account_number
        ) ===
        Number(
          state.profile
            ?.account_number
        )
      );

    article.className =
      isCurrentPlayer
        ? "leaderboard-row current-player"
        : "leaderboard-row";

    if (isCurrentPlayer) {
      article.setAttribute(
        "aria-current",
        "true"
      );
    }

    const rank =
      formatLeaderboardInteger(
        row.leaderboard_rank
      );

    const playerName =
      escapeHtml(
        row.display_name ||
        "Unknown player"
      );

    const identifier =
      escapeHtml(
        formatAccountIdentifier(
          row.account_number
        )
      );

    const highScore =
      formatLeaderboardInteger(
        row.high_score
      );

    const accuracy =
      formatLeaderboardPercent(
        row.accuracy_percent
      );

    const streak =
      formatLeaderboardInteger(
        row.best_streak
      );

    const gamesPlayed =
      formatLeaderboardInteger(
        row.games_played
      );

    article.innerHTML = `
      <span class="leaderboard-cell leaderboard-rank" data-label="Rank">
        #${rank}
      </span>

      <span class="leaderboard-cell leaderboard-player" data-label="Player">
        <strong>${playerName}</strong>
        <small>${gamesPlayed} game${Number(row.games_played) === 1 ? "" : "s"}</small>
      </span>

      <span class="leaderboard-cell leaderboard-id" data-label="ID">
        ${identifier}
      </span>

      <span class="leaderboard-cell leaderboard-score" data-label="High score">
        ${highScore}
      </span>

      <span class="leaderboard-cell" data-label="Accuracy">
        ${accuracy}
      </span>

      <span class="leaderboard-cell" data-label="Streak">
        ${streak}
      </span>
    `;

    return article;
  }


  function renderCurrentPlayerRank(row) {
    if (!elements.currentPlayerRank) {
      return;
    }

    if (!state.profile) {
      elements.currentPlayerRank.hidden =
        true;
      elements.currentPlayerRank
        .replaceChildren();
      return;
    }

    elements.currentPlayerRank.hidden =
      false;

    const identifier =
      escapeHtml(
        formatAccountIdentifier(
          state.profile.account_number
        )
      );

    const playerName =
      escapeHtml(
        state.profile.display_name ||
        "Current player"
      );

    if (!row) {
      elements.currentPlayerRank
        .innerHTML = `
          <div>
            <span>Your rank</span>
            <strong>Unranked</strong>
          </div>

          <p>
            ${playerName} ${identifier} has no score for the selected filters yet.
          </p>
        `;

      return;
    }

    elements.currentPlayerRank
      .innerHTML = `
        <div>
          <span>Your rank</span>
          <strong>#${formatLeaderboardInteger(row.leaderboard_rank)}</strong>
        </div>

        <p>
          ${playerName} ${identifier} ·
          ${formatLeaderboardInteger(row.high_score)} high score ·
          ${formatLeaderboardPercent(row.accuracy_percent)} accuracy ·
          ${formatLeaderboardInteger(row.best_streak)} streak
        </p>
      `;
  }


  function formatLeaderboardInteger(
    value
  ) {
    const number =
      Number(value);

    return Number.isFinite(number)
      ? Math.round(number)
          .toLocaleString()
      : "0";
  }


  function formatLeaderboardPercent(
    value
  ) {
    const number =
      Number(value);

    return Number.isFinite(number)
      ? `${number.toFixed(1)}%`
      : "0.0%";
  }


  function isMissingRpcError(
    error,
    functionName
  ) {
    const message =
      String(
        error?.message ||
        error?.details ||
        error ||
        ""
      ).toLowerCase();

    return (
      error?.code === "PGRST202" ||
      error?.code === "42883" ||
      (
        message.includes(
          functionName.toLowerCase()
        ) &&
        (
          message.includes(
            "not find"
          ) ||
          message.includes(
            "does not exist"
          ) ||
          message.includes(
            "schema cache"
          )
        )
      )
    );
  }


  function getLeaderboardErrorMessage(
    error
  ) {
    if (
      isMissingRpcError(
        error,
        "get_leaderboard_v2"
      )
    ) {
      return "Leaderboard setup is incomplete. The site owner needs to run the Phase 2 Supabase SQL migration.";
    }

    if (isNetworkLoadError(error)) {
      return "The leaderboard could not be reached. Open Trivia Rush directly in Safari or Chrome and try again.";
    }

    return "The leaderboard could not be loaded. Try again in a moment.";
  }

  function isPermanentAccount() {
    return Boolean(state.user && state.profile && state.user.is_anonymous === false);
  }

  async function handleDuelLink() {
    const url = new URL(window.location.href);
    const challengeId = url.searchParams.get("challenge")?.trim();
    if (challengeId) {
      if (isPermanentAccount()) {
        await openTurnChallenge(challengeId);
      } else {
        openSocialScreen();
        setSocialStatus("Sign in or create a permanent account to open this turn-based challenge.");
      }
      return;
    }

    const socialView = url.searchParams.get("social")?.trim();
    if (socialView) {
      openSocialScreen();
      window.setTimeout(() => {
        const target = socialView === "friends"
          ? elements.friendRequests
          : elements.notificationCard;
        target?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 120);
      return;
    }

    const roomCode = url.searchParams.get("duel")?.trim().toUpperCase();

    if (!roomCode) {
      const savedDuel = readSavedDuel();
      if (savedDuel && isPermanentAccount()) {
        enterDuelRoom(
          savedDuel.matchId,
          savedDuel.roomCode || "",
          savedDuel.isHost,
          savedDuel.matchFormat || "live"
        );
      }
      return;
    }

    elements.duelRoomCode.value = roomCode;
    if (isPermanentAccount()) {
      await joinDuel(roomCode);
    } else {
      openSocialScreen();
      setSocialStatus("Sign in or create a permanent account, then join the pre-filled room.");
    }
  }

  function readSavedDuel() {
    try {
      const value = JSON.parse(localStorage.getItem("triviaRushActiveDuel") || "null");
      return value?.matchId ? value : null;
    } catch {
      return null;
    }
  }

  function openSocialScreen() {
    const activeScreen = elements.screens.find((screen) => screen.classList.contains("active"));
    if (activeScreen && ![
      elements.socialScreen,
      elements.duelWaitingScreen,
      elements.duelGameScreen,
      elements.duelResultsScreen
    ].includes(activeScreen)) {
      state.socialReturnScreen = activeScreen;
    }

    stopDuelRuntime();
    showScreen(elements.socialScreen);
    const permanent = isPermanentAccount();
    elements.duelAccountGate.hidden = permanent;
    elements.socialContent.hidden = !permanent;
    if (permanent) {
      void loadSocialData();
    }
  }

  function closeSocialScreen() {
    const returnScreen = state.socialReturnScreen || elements.startScreen;
    state.socialReturnScreen = null;
    showScreen(returnScreen);
  }

  function setSocialStatus(message, isError = false) {
    if (!elements.socialStatus) {
      return;
    }
    elements.socialStatus.textContent = message;
    elements.socialStatus.classList.toggle("error", isError);
  }

  async function loadSocialData() {
    if (!isPermanentAccount()) {
      return;
    }

    setSocialStatus("Loading friends, challenges and match history…");
    const [
      social,
      invitations,
      turnChallenges,
      history,
      leaderboard,
      notifications,
      notificationPreferences
    ] = await Promise.all([
      supabaseClient.rpc("get_social_dashboard"),
      supabaseClient.rpc("get_duel_invitations"),
      supabaseClient.rpc("get_turn_challenges", { p_limit: 30 }),
      supabaseClient.rpc("get_duel_match_history_v2", {
        p_opponent_account_number: parseOptionalAccount(elements.historyOpponentFilter?.value),
        p_match_format: "all",
        p_limit: 30
      }),
      supabaseClient.rpc("get_duel_leaderboard_v2", {
        p_match_format: state.duelLeaderboardFormat,
        p_limit: 20
      }),
      supabaseClient.rpc("get_notifications", { p_limit: 30 }),
      supabaseClient.rpc("get_notification_preferences")
    ]);

    const failed = [
      social,
      invitations,
      turnChallenges,
      history,
      leaderboard,
      notifications,
      notificationPreferences
    ].find((response) => response.error);
    if (failed) {
      console.error("Could not load social data:", failed.error);
      setSocialStatus(failed.error.message || "Friends and duels could not be loaded.", true);
      return;
    }

    renderSocialDashboard(social.data || {});
    renderDuelInvitations(Array.isArray(invitations.data) ? invitations.data : []);
    renderTurnChallenges(turnChallenges.data || {});
    renderDuelHistory(Array.isArray(history.data) ? history.data : []);
    renderDuelLeaderboard(Array.isArray(leaderboard.data) ? leaderboard.data : []);
    renderNotifications(Array.isArray(notifications.data) ? notifications.data : []);
    renderNotificationPreferences(
      Array.isArray(notificationPreferences.data)
        ? notificationPreferences.data[0]
        : notificationPreferences.data
    );
    await updateUnreadNotificationCount();
    setSocialStatus("");
  }

  function parseOptionalAccount(value) {
    const trimmed = String(value || "").trim();
    return /^\d+$/.test(trimmed) ? Number(trimmed) : null;
  }

  function createSocialRow(primary, secondary, actions = []) {
    const row = document.createElement("div");
    row.className = "social-row";
    const copy = document.createElement("div");
    copy.className = "social-row-copy";
    const strong = document.createElement("strong");
    strong.textContent = primary;
    const small = document.createElement("small");
    small.textContent = secondary;
    copy.append(strong, small);
    row.appendChild(copy);

    if (actions.length) {
      const controls = document.createElement("div");
      controls.className = "row-actions";
      actions.forEach(({ label, handler }) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "row-action";
        button.textContent = label;
        button.addEventListener("click", handler);
        controls.appendChild(button);
      });
      row.appendChild(controls);
    }

    return row;
  }

  function renderEmpty(container, message) {
    container.replaceChildren();
    const empty = document.createElement("p");
    empty.className = "social-empty";
    empty.textContent = message;
    container.appendChild(empty);
  }

  function renderSocialDashboard(data) {
    const friends = Array.isArray(data.friends) ? data.friends : [];
    const incoming = Array.isArray(data.incoming) ? data.incoming : [];
    const outgoing = Array.isArray(data.outgoing) ? data.outgoing : [];

    elements.friendRequests.replaceChildren();
    incoming.forEach((request) => {
      elements.friendRequests.appendChild(createSocialRow(
        request.display_name,
        `Account #${request.account_number}`,
        [
          { label: "Accept", handler: () => respondFriendRequest(request.friendship_id, true) },
          { label: "Decline", handler: () => respondFriendRequest(request.friendship_id, false) }
        ]
      ));
    });
    outgoing.forEach((request) => {
      elements.friendRequests.appendChild(createSocialRow(
        request.display_name,
        `Request sent · #${request.account_number}`
      ));
    });
    if (!incoming.length && !outgoing.length) {
      renderEmpty(elements.friendRequests, "No pending requests.");
    }

    elements.friendsList.replaceChildren();
    friends.forEach((friend) => {
      elements.friendsList.appendChild(createSocialRow(
        friend.display_name,
        `Account #${friend.account_number}`,
        [
          { label: "Live", handler: () => prepareFriendChallenge(friend.account_number, "live") },
          { label: "Take turns", handler: () => prepareFriendChallenge(friend.account_number, "turn_based") },
          { label: "Remove", handler: () => removeFriend(friend.player_id) }
        ]
      ));
    });
    if (!friends.length) {
      renderEmpty(elements.friendsList, "Add friends by their account number.");
    }
  }

  function renderDuelInvitations(rows) {
    elements.duelInvitations.replaceChildren();
    rows.forEach((invite) => {
      elements.duelInvitations.appendChild(createSocialRow(
        invite.host_display_name,
        `${invite.duration_seconds}s · ${formatCategory(invite.category_id)} · #${invite.host_account_number}`,
        [{ label: "Accept", handler: () => joinDuel(invite.room_code) }]
      ));
    });
    if (!rows.length) {
      renderEmpty(elements.duelInvitations, "No direct challenges.");
    }
  }

  function renderTurnChallenges(data) {
    const active = Array.isArray(data.active) ? data.active : [];
    const recentClosed = Array.isArray(data.recent_closed) ? data.recent_closed : [];

    elements.turnChallenges.replaceChildren();
    active.forEach((challenge) => {
      const statusCopy = getTurnChallengeStatusCopy(challenge);
      const actions = [];
      if (challenge.can_start) {
        actions.push({ label: "Play", handler: () => openTurnChallenge(challenge.match_id) });
      } else if (["host_turn", "guest_turn"].includes(challenge.status) && challenge.self_round_status !== "completed") {
        actions.push({ label: "Resume", handler: () => openTurnChallenge(challenge.match_id) });
      } else {
        actions.push({ label: "View", handler: () => openTurnChallenge(challenge.match_id) });
      }
      if (challenge.can_decline) {
        actions.push({ label: "Decline", handler: () => declineTurnChallenge(challenge.match_id) });
      }
      if (challenge.can_cancel) {
        actions.push({ label: "Cancel", handler: () => cancelTurnChallenge(challenge.match_id) });
      }

      elements.turnChallenges.appendChild(createSocialRow(
        challenge.opponent_display_name,
        `${statusCopy} · ${challenge.duration_seconds}s ${formatCategory(challenge.category_id)} · #${challenge.opponent_account_number}`,
        actions
      ));
    });
    if (!active.length) {
      renderEmpty(elements.turnChallenges, "No active turn-based challenges.");
    }

    elements.turnChallengeActivity.replaceChildren();
    recentClosed.forEach((challenge) => {
      const reason = challenge.closed_reason === "declined"
        ? "Declined"
        : challenge.closed_reason === "expired"
          ? "Expired"
          : "Cancelled";
      elements.turnChallengeActivity.appendChild(createSocialRow(
        `${reason} · ${challenge.opponent_display_name}`,
        `${challenge.duration_seconds}s ${formatCategory(challenge.category_id)} · ${formatRelativeTime(challenge.closed_at)}`
      ));
    });
    if (!recentClosed.length) {
      renderEmpty(elements.turnChallengeActivity, "No recently closed challenges.");
    }
  }

  function getTurnChallengeStatusCopy(challenge) {
    if (challenge.can_start) {
      return `Your turn · expires ${formatRelativeTime(challenge.response_expires_at)}`;
    }
    if (challenge.status === "host_turn") {
      return "Your round is in progress";
    }
    if (challenge.status === "guest_turn") {
      return challenge.self_round_status === "completed"
        ? "Opponent is playing"
        : "Your round is in progress";
    }
    return `Awaiting response · expires ${formatRelativeTime(challenge.response_expires_at)}`;
  }

  function renderDuelHistory(rows) {
    elements.duelHistory.replaceChildren();
    rows.forEach((match) => {
      const outcome = match.outcome === "forfeit" ? "FORFEIT" : String(match.outcome || "").toUpperCase();
      elements.duelHistory.appendChild(createSocialRow(
        `${outcome} vs ${match.opponent_display_name}`,
        `${match.player_score}–${match.opponent_score} · ${formatDuelFormat(match.match_format)} · ${match.duration_seconds}s ${formatCategory(match.category_id)} · #${match.opponent_account_number}`
      ));
    });
    if (!rows.length) {
      renderEmpty(elements.duelHistory, "No completed matches for this filter.");
    }
  }

  function renderDuelLeaderboard(rows) {
    elements.duelLeaderboard.replaceChildren();
    rows.forEach((player) => {
      const rate = player.is_provisional ? "Provisional" : `${player.win_rate}% wins`;
      elements.duelLeaderboard.appendChild(createSocialRow(
        `#${player.leaderboard_rank} ${player.display_name}`,
        `${player.wins}W ${player.draws}D ${player.losses}L · ${rate} · ${Number(player.total_duel_score).toLocaleString()} pts`
      ));
    });
    if (!rows.length) {
      renderEmpty(elements.duelLeaderboard, "No completed duels yet.");
    }
  }

  async function setDuelLeaderboardFormat(format) {
    const normalised = ["all", "live", "turn_based"].includes(format)
      ? format
      : "all";
    state.duelLeaderboardFormat = normalised;
    elements.duelLeaderboardFormatButtons.forEach((button) => {
      const active = button.dataset.duelLeaderboardFormat === normalised;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    renderEmpty(elements.duelLeaderboard, "Loading multiplayer rankings…");
    const { data, error } = await supabaseClient.rpc("get_duel_leaderboard_v2", {
      p_match_format: normalised,
      p_limit: 20
    });
    if (error) {
      setSocialStatus(error.message || "The multiplayer leaderboard could not be loaded.", true);
      return;
    }
    renderDuelLeaderboard(Array.isArray(data) ? data : []);
  }

  function renderNotifications(rows) {
    elements.notificationList.replaceChildren();
    rows.forEach((notification) => {
      const actions = [];
      if (notification.data?.challenge) {
        actions.push({
          label: "Open",
          handler: () => openNotification(notification, () => openTurnChallenge(notification.data.challenge))
        });
      } else if (notification.data?.duel) {
        actions.push({
          label: "Join",
          handler: () => openNotification(notification, () => joinDuel(notification.data.duel))
        });
      } else if (notification.notification_type === "friend_request") {
        actions.push({
          label: "View",
          handler: () => openNotification(notification)
        });
      }

      const row = createSocialRow(
        notification.title,
        `${notification.body} · ${formatRelativeTime(notification.created_at)}`,
        actions
      );
      row.classList.toggle("unread", !notification.read_at);
      elements.notificationList.appendChild(row);
    });
    if (!rows.length) {
      renderEmpty(elements.notificationList, "No notifications yet.");
    }
  }

  async function openNotification(notification, action = null) {
    if (!notification.read_at) {
      await supabaseClient.rpc("mark_notification_read", {
        p_notification_id: notification.notification_id
      });
      await updateUnreadNotificationCount();
    }
    if (action) {
      await action();
    } else {
      await loadSocialData();
      elements.friendRequests?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  async function openNotifications() {
    openSocialScreen();
    window.setTimeout(() => {
      elements.notificationCard?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
  }

  async function markAllNotificationsRead() {
    const { error } = await supabaseClient.rpc("mark_notification_read", {
      p_notification_id: null
    });
    if (error) {
      setNotificationStatus(error.message || "Notifications could not be updated.", true);
      return;
    }
    await Promise.all([loadSocialData(), updateUnreadNotificationCount()]);
  }

  async function updateUnreadNotificationCount() {
    if (!isPermanentAccount()) {
      setUnreadNotificationCount(0);
      return;
    }
    const { data, error } = await supabaseClient.rpc("get_unread_notification_count");
    if (error) {
      console.warn("Could not load notification count:", error);
      return;
    }
    setUnreadNotificationCount(Number(data || 0));
  }

  function setUnreadNotificationCount(count) {
    const safeCount = Math.max(0, Number.isFinite(count) ? Math.round(count) : 0);
    if (elements.notificationBadge) {
      elements.notificationBadge.hidden = safeCount === 0;
      elements.notificationBadge.textContent = safeCount > 99 ? "99+" : String(safeCount);
    }
    elements.notificationButton?.setAttribute(
      "aria-label",
      safeCount ? `Open ${safeCount} unread notifications` : "Open notifications"
    );
    if ("setAppBadge" in navigator && safeCount) {
      void Promise.resolve(navigator.setAppBadge(safeCount)).catch(() => {});
    } else if ("clearAppBadge" in navigator && safeCount === 0) {
      void Promise.resolve(navigator.clearAppBadge()).catch(() => {});
    }
  }

  async function refreshNotificationRuntime() {
    stopNotificationRuntime();
    if (!isPermanentAccount()) {
      setUnreadNotificationCount(0);
      return;
    }

    await updateUnreadNotificationCount();
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("./sw.js").catch((error) => {
        console.warn("Service worker registration failed:", error);
      });
    }
    if (typeof supabaseClient.channel !== "function") {
      return;
    }
    state.notificationSubscription = supabaseClient
      .channel(`notifications:${state.user.id}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "notifications",
        filter: `recipient_id=eq.${state.user.id}`
      }, () => {
        void updateUnreadNotificationCount();
        if (elements.socialScreen?.classList.contains("active")) {
          void loadSocialData();
        }
      })
      .subscribe();
  }

  function stopNotificationRuntime() {
    if (state.notificationSubscription && typeof supabaseClient.removeChannel === "function") {
      void supabaseClient.removeChannel(state.notificationSubscription);
    }
    state.notificationSubscription = null;
  }

  function renderNotificationPreferences(preferences) {
    const current = preferences || {
      push_enabled: false,
      email_enabled: false,
      challenge_notifications: true,
      friend_request_notifications: true,
      active_push_subscriptions: 0
    };
    state.notificationPreferences = current;
    elements.challengeNotificationsToggle.checked = current.challenge_notifications !== false;
    elements.friendNotificationsToggle.checked = current.friend_request_notifications !== false;
    elements.emailNotificationsToggle.checked = current.email_enabled === true;
    elements.pushNotificationsButton.textContent = current.push_enabled
      ? "Disable phone push"
      : "Enable phone push";
  }

  async function saveNotificationPreferences() {
    if (!state.notificationPreferences) {
      return;
    }
    const { error } = await supabaseClient.rpc("update_notification_preferences", {
      p_push_enabled: state.notificationPreferences.push_enabled === true,
      p_email_enabled: elements.emailNotificationsToggle.checked,
      p_challenge_notifications: elements.challengeNotificationsToggle.checked,
      p_friend_request_notifications: elements.friendNotificationsToggle.checked
    });
    if (error) {
      setNotificationStatus(error.message || "Notification settings could not be saved.", true);
      return;
    }
    state.notificationPreferences = {
      ...state.notificationPreferences,
      email_enabled: elements.emailNotificationsToggle.checked,
      challenge_notifications: elements.challengeNotificationsToggle.checked,
      friend_request_notifications: elements.friendNotificationsToggle.checked
    };
    setNotificationStatus("Notification settings saved.");
  }

  async function togglePushNotifications() {
    if (state.notificationPreferences?.push_enabled) {
      await disablePushNotifications();
    } else {
      await enablePushNotifications();
    }
  }

  async function enablePushNotifications() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setNotificationStatus("Phone push is not supported by this browser. Email alerts can still be enabled.", true);
      return;
    }

    const isiPhoneOrIPad = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isStandalone = window.matchMedia?.("(display-mode: standalone)").matches
      || window.navigator.standalone === true;
    if (isiPhoneOrIPad && !isStandalone) {
      setNotificationStatus("On iPhone or iPad, add Trivia Rush to your Home Screen, open it there, then enable push.", true);
      return;
    }

    elements.pushNotificationsButton.disabled = true;
    try {
      setNotificationStatus("Requesting notification permission…");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setNotificationStatus("Notification permission was not granted.", true);
        return;
      }

      const registration = await navigator.serviceWorker.register("./sw.js");
      let config = null;
      try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        const response = await fetch(`${SUPABASE_URL}/functions/v1/dispatch-notifications`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${session?.access_token || ""}`,
            apikey: SUPABASE_PUBLISHABLE_KEY
          }
        });
        if (!response.ok) {
          throw new Error(`Server responded ${response.status}`);
        }
        config = await response.json();
      } catch (fetchError) {
        console.error("Push config fetch failed:", fetchError);
        setNotificationStatus(`Push config error: ${fetchError.message}`, true);
        return;
      }
      if (!config?.vapid_public_key) {
        setNotificationStatus("Push delivery is not configured on the server yet.", true);
        return;
      }

      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(config.vapid_public_key)
        });
      }
      const serialised = subscription.toJSON();
      const { error: registerError } = await supabaseClient.rpc("register_push_subscription", {
        p_endpoint: subscription.endpoint,
        p_p256dh: serialised.keys?.p256dh,
        p_auth_secret: serialised.keys?.auth,
        p_user_agent: navigator.userAgent
      });
      if (registerError) {
        setNotificationStatus(registerError.message || "This device could not be registered.", true);
        return;
      }

      const { error: preferenceError } = await supabaseClient.rpc("update_notification_preferences", {
        p_push_enabled: true,
        p_email_enabled: elements.emailNotificationsToggle.checked,
        p_challenge_notifications: elements.challengeNotificationsToggle.checked,
        p_friend_request_notifications: elements.friendNotificationsToggle.checked
      });
      if (preferenceError) {
        setNotificationStatus(preferenceError.message || "Push preference could not be saved.", true);
        return;
      }
      state.notificationPreferences = {
        ...(state.notificationPreferences || {}),
        push_enabled: true
      };
      elements.pushNotificationsButton.textContent = "Disable phone push";
      setNotificationStatus("Phone push is enabled on this device.");
    } catch (error) {
      setNotificationStatus(
        error instanceof Error ? error.message : "Phone push could not be enabled on this device.",
        true
      );
    } finally {
      elements.pushNotificationsButton.disabled = false;
    }
  }

  async function disablePushNotifications() {
    const registration = "serviceWorker" in navigator
      ? await navigator.serviceWorker.getRegistration("./")
      : null;
    const subscription = await registration?.pushManager?.getSubscription();
    if (subscription) {
      await supabaseClient.rpc("remove_push_subscription", {
        p_endpoint: subscription.endpoint
      });
      await subscription.unsubscribe();
    }
    const { error } = await supabaseClient.rpc("update_notification_preferences", {
      p_push_enabled: false,
      p_email_enabled: elements.emailNotificationsToggle.checked,
      p_challenge_notifications: elements.challengeNotificationsToggle.checked,
      p_friend_request_notifications: elements.friendNotificationsToggle.checked
    });
    if (error) {
      setNotificationStatus(error.message || "Push could not be disabled.", true);
      return;
    }
    state.notificationPreferences = {
      ...(state.notificationPreferences || {}),
      push_enabled: false
    };
    elements.pushNotificationsButton.textContent = "Enable phone push";
    setNotificationStatus("Phone push is disabled.");
  }

  function setNotificationStatus(message, isError = false) {
    if (!elements.notificationStatus) {
      return;
    }
    elements.notificationStatus.textContent = message;
    elements.notificationStatus.classList.toggle("error", isError);
  }

  function urlBase64ToUint8Array(value) {
    const padding = "=".repeat((4 - value.length % 4) % 4);
    const base64 = (value + padding).replaceAll("-", "+").replaceAll("_", "/");
    const raw = window.atob(base64);
    return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
  }

  async function requestNotificationDispatch(key) {
    if (!isPermanentAccount() || state.notificationDispatchKey === key) {
      return;
    }
    state.notificationDispatchKey = key;
    try {
      const { error } = await supabaseClient.functions.invoke("dispatch-notifications", {
        method: "POST",
        body: {}
      });
      if (error) {
        throw error;
      }
    } catch (error) {
      console.warn("Notification dispatch will be retried later:", error);
      state.notificationDispatchKey = null;
    }
  }

  function formatCategory(categoryId) {
    if (categoryId === "mixed") {
      return "Mixed";
    }
    return state.categories.find((category) => category.id === categoryId)?.label || categoryId;
  }

  function formatDuelFormat(matchFormat) {
    return matchFormat === "turn_based" ? "Turn-based" : "Live";
  }

  function formatRelativeTime(value) {
    const timestamp = Date.parse(value);
    if (!Number.isFinite(timestamp)) {
      return "recently";
    }
    const difference = timestamp - Date.now();
    const absolute = Math.abs(difference);
    if (absolute < 60_000) {
      return difference >= 0 ? "in under a minute" : "just now";
    }
    const units = absolute < 3_600_000
      ? [60_000, "minute"]
      : absolute < 86_400_000
        ? [3_600_000, "hour"]
        : [86_400_000, "day"];
    const amount = Math.max(1, Math.round(absolute / units[0]));
    return difference >= 0
      ? `in ${amount} ${units[1]}${amount === 1 ? "" : "s"}`
      : `${amount} ${units[1]}${amount === 1 ? "" : "s"} ago`;
  }

  async function addFriend() {
    const accountNumber = parseOptionalAccount(elements.friendAccountNumber.value);
    if (!accountNumber) {
      setSocialStatus("Enter a valid account number.", true);
      return;
    }

    const { error } = await supabaseClient.rpc("send_friend_request", {
      p_account_number: accountNumber
    });
    if (error) {
      setSocialStatus(error.message, true);
      return;
    }
    elements.friendAccountNumber.value = "";
    setSocialStatus("Friend request updated.");
    void requestNotificationDispatch("friend-request");
    await loadSocialData();
  }

  async function respondFriendRequest(friendshipId, accept) {
    const { error } = await supabaseClient.rpc("respond_friend_request", {
      p_friendship_id: friendshipId,
      p_accept: accept
    });
    if (error) {
      setSocialStatus(error.message, true);
      return;
    }
    await loadSocialData();
  }

  async function removeFriend(playerId) {
    const { error } = await supabaseClient.rpc("remove_friend", { p_friend_id: playerId });
    if (error) {
      setSocialStatus(error.message, true);
      return;
    }
    await loadSocialData();
  }

  function prepareFriendChallenge(accountNumber, format = "live") {
    elements.duelFormatSelect.value = format;
    updateDuelFormatUI();
    elements.duelInviteAccount.value = String(accountNumber);
    elements.duelInviteAccount.focus();
    setSocialStatus(
      `${format === "turn_based" ? "Turn-based challenge" : "Live duel"} prepared for account #${accountNumber}. Choose the settings and create it.`
    );
  }

  function updateDuelFormatUI() {
    if (!elements.duelFormatSelect) {
      return;
    }
    const turnBased = elements.duelFormatSelect.value === "turn_based";
    elements.duelInviteAccount.required = turnBased;
    elements.duelInviteAccountLabel.textContent = turnBased
      ? "Opponent account number"
      : "Optional account number";
    elements.duelInviteAccount.placeholder = turnBased
      ? "Required for turn-based play"
      : "Leave blank for an open room";
    elements.duelFormatNote.textContent = turnBased
      ? "You play first. Your opponent then has 72 hours to complete the same round."
      : "Live rooms start when both players arrive.";
    elements.createDuelButton.textContent = turnBased
      ? "Play & send challenge"
      : "Create live duel";
  }

  async function loadDuelHistory() {
    const { data, error } = await supabaseClient.rpc("get_duel_match_history_v2", {
      p_opponent_account_number: parseOptionalAccount(elements.historyOpponentFilter.value),
      p_match_format: "all",
      p_limit: 30
    });
    if (error) {
      setSocialStatus(error.message, true);
      return;
    }
    renderDuelHistory(Array.isArray(data) ? data : []);
  }

  async function createDuel() {
    if (!isPermanentAccount()) {
      openSocialScreen();
      return;
    }

    const invitedAccount = parseOptionalAccount(elements.duelInviteAccount.value);
    const matchFormat = elements.duelFormatSelect.value === "turn_based"
      ? "turn_based"
      : "live";
    if (matchFormat === "turn_based" && !invitedAccount) {
      setSocialStatus("Enter the permanent account number of the player you want to challenge.", true);
      return;
    }

    setSocialStatus(matchFormat === "turn_based" ? "Preparing your turn…" : "Creating live duel…");
    const rpcName = matchFormat === "turn_based"
      ? "create_turn_challenge"
      : "create_duel";
    const { data, error } = await supabaseClient.rpc(rpcName, {
      p_category: elements.duelCategorySelect.value,
      p_duration_seconds: Number(elements.duelDurationSelect.value),
      p_invited_account_number: invitedAccount
    });

    if (error) {
      setSocialStatus(error.message || "The duel could not be created.", true);
      return;
    }

    state.rematchSettings = {
      category: data.category_id,
      duration: Number(data.duration_seconds),
      opponentAccount: invitedAccount,
      matchFormat
    };
    if (matchFormat === "live" && invitedAccount) {
      void requestNotificationDispatch(`live:${data.match_id}`);
    }
    enterDuelRoom(data.match_id, data.room_code || "", true, matchFormat);
  }

  async function joinDuel(roomCode) {
    if (!isPermanentAccount()) {
      openSocialScreen();
      setSocialStatus("A permanent account is required to join this duel.", true);
      return;
    }

    const code = String(roomCode || "").trim().toUpperCase();
    if (!/^[A-Z0-9]{8}$/.test(code)) {
      setSocialStatus("Enter the complete eight-character room code.", true);
      return;
    }

    setSocialStatus("Joining duel…");
    const { data, error } = await supabaseClient.rpc("join_duel", {
      p_room_code: code
    });
    if (error) {
      setSocialStatus(error.message || "The duel could not be joined.", true);
      return;
    }

    enterDuelRoom(data.match_id, code, false);
  }

  async function openTurnChallenge(matchId) {
    if (!isPermanentAccount()) {
      openSocialScreen();
      setSocialStatus("A permanent account is required to play turn-based challenges.", true);
      return;
    }
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete("challenge");
    window.history.replaceState({}, "", cleanUrl);
    enterDuelRoom(matchId, "", false, "turn_based");
  }

  async function startTurnChallenge(matchId = state.activeDuelId) {
    if (!matchId) {
      return;
    }
    elements.duelWaitingStatus.textContent = "Preparing your private round…";
    const { data, error } = await supabaseClient.rpc("start_turn_challenge", {
      p_match_id: matchId
    });
    if (error) {
      elements.duelWaitingStatus.textContent = error.message || "This challenge could not be started.";
      return;
    }
    enterDuelRoom(data.match_id, "", false, "turn_based");
  }

  async function declineTurnChallenge(matchId = state.activeDuelId) {
    if (!matchId) {
      return;
    }
    const { error } = await supabaseClient.rpc("decline_turn_challenge", {
      p_match_id: matchId
    });
    if (error) {
      setSocialStatus(error.message || "This challenge could not be declined.", true);
      return;
    }
    stopDuelRuntime();
    openSocialScreen();
    setSocialStatus("Challenge declined.");
  }

  async function cancelTurnChallenge(matchId = state.activeDuelId) {
    if (!matchId) {
      return;
    }
    const { error } = await supabaseClient.rpc("cancel_turn_challenge", {
      p_match_id: matchId
    });
    if (error) {
      setSocialStatus(error.message || "This challenge could not be cancelled.", true);
      return;
    }
    stopDuelRuntime();
    openSocialScreen();
    setSocialStatus("Turn-based challenge cancelled.");
  }

  function resetDuelWaitingUI() {
    elements.duelWaitingEyebrow.textContent = "DUEL ROOM";
    elements.duelWaitingTitle.textContent = "Waiting for an opponent";
    elements.duelWaitingDescription.textContent = "Share this code or link. The match starts automatically when both players arrive.";
    elements.duelWaitingCode.hidden = false;
    elements.copyDuelLinkButton.hidden = false;
    elements.startTurnChallengeButton.hidden = true;
    elements.declineTurnChallengeButton.hidden = true;
    elements.backFromDuelWaitingButton.hidden = true;
  }

  function renderTurnWaitingState(data) {
    showScreen(elements.duelWaitingScreen);
    elements.duelWaitingEyebrow.textContent = "TURN-BASED CHALLENGE";
    elements.duelWaitingCode.hidden = true;
    elements.copyDuelLinkButton.hidden = true;
    elements.startTurnChallengeButton.hidden = !data.can_start;
    elements.declineTurnChallengeButton.hidden = !data.can_decline;
    elements.cancelDuelButton.hidden = !data.can_cancel;
    elements.backFromDuelWaitingButton.hidden = false;
    void requestNotificationDispatch(`turn-waiting:${data.match_id}:${data.status}`);

    const opponent = data.opponent || {};
    if (data.can_start) {
      elements.duelWaitingTitle.textContent = `Your turn against ${opponent.display_name || "an opponent"}`;
      elements.duelWaitingDescription.textContent = `${formatCategory(data.category_id)} · ${getDuelDuration(data)} seconds. Once started, the server timer cannot be paused.`;
      elements.duelWaitingStatus.textContent = `The challenge expires ${formatRelativeTime(data.response_expires_at)}. Their score stays hidden until you finish.`;
      return;
    }

    elements.duelWaitingTitle.textContent = `Waiting for ${opponent.display_name || "your opponent"}`;
    elements.duelWaitingDescription.textContent = data.status === "guest_turn"
      ? "Your opponent is playing now. Your score stays private until their timer finishes."
      : "Your score is saved privately. The result will be revealed after your opponent completes the same round.";
    elements.duelWaitingStatus.textContent = `You scored ${Number(data.self?.score || 0).toLocaleString()} · response window ends ${formatRelativeTime(data.response_expires_at)}.`;
  }

  function getDuelDuration(data) {
    const fromMode = Number(String(data.game_mode || "").split("_")[1]);
    if (Number.isFinite(fromMode)) {
      return fromMode;
    }
    const start = Date.parse(data.starts_at);
    const end = Date.parse(data.ends_at);
    return Number.isFinite(start) && Number.isFinite(end)
      ? Math.round((end - start) / 1000)
      : 60;
  }

  function enterDuelRoom(matchId, roomCode, isHost, matchFormat = "live") {
    stopDuelRuntime();
    state.activeDuelId = matchId;
    state.activeDuelCode = roomCode;
    state.activeDuelFormat = matchFormat;
    state.duelQuestion = null;
    state.duelLocked = true;
    localStorage.setItem("triviaRushActiveDuel", JSON.stringify({
      matchId,
      roomCode,
      isHost,
      matchFormat
    }));
    const cleanUrl = new URL(window.location.href);
    if (cleanUrl.searchParams.has("duel")) {
      cleanUrl.searchParams.delete("duel");
      window.history.replaceState({}, "", cleanUrl);
    }
    resetDuelWaitingUI();
    elements.duelWaitingCode.textContent = roomCode || "";
    elements.cancelDuelButton.hidden = !isHost;
    elements.duelWaitingStatus.textContent = matchFormat === "turn_based"
      ? "Loading challenge…"
      : isHost
        ? "Waiting for an opponent…"
        : "Opponent found. Preparing the match…";
    showScreen(elements.duelWaitingScreen);
    subscribeToDuel(matchId);
    state.duelPollTimer = window.setInterval(() => void refreshDuelState(), 1000);
    void refreshDuelState();
  }

  function subscribeToDuel(matchId) {
    if (typeof supabaseClient.channel !== "function") {
      return;
    }

    state.duelSubscription = supabaseClient
      .channel(`duel:${matchId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "duel_matches",
        filter: `id=eq.${matchId}`
      }, () => void refreshDuelState());
    if (state.activeDuelFormat === "live") {
      state.duelSubscription.on("postgres_changes", {
          event: "*",
          schema: "public",
          table: "duel_live_progress",
          filter: `match_id=eq.${matchId}`
        }, () => void refreshDuelState());
    }
    state.duelSubscription.subscribe();
  }

  async function refreshDuelState() {
    if (!state.activeDuelId || state.duelRefreshPending) {
      return;
    }

    state.duelRefreshPending = true;
    const rpcName = state.activeDuelFormat === "turn_based"
      ? "get_turn_challenge_state"
      : "get_duel_state";
    const { data, error } = await supabaseClient.rpc(rpcName, {
      p_match_id: state.activeDuelId
    });
    state.duelRefreshPending = false;

    if (error) {
      console.warn("Could not refresh duel:", error);
      const target = elements.duelGameScreen.classList.contains("active")
        ? elements.duelFeedback
        : elements.duelWaitingStatus;
      target.textContent = "Connection interrupted — reconnecting…";
      return;
    }

    state.duelState = data;
    state.activeDuelFormat = data.match_format || state.activeDuelFormat;
    syncDuelClock(data.server_now);
    updateDuelScoreboard(data);

    const turnWaiting = state.activeDuelFormat === "turn_based"
      && (
        data.status === "awaiting_response"
        || (data.status === "guest_turn" && data.self?.round_status === "completed")
      );
    if (state.activeDuelFormat === "turn_based" && (turnWaiting || data.status === "cancelled")) {
      if (data.status === "cancelled") {
        stopDuelRuntime();
        openSocialScreen();
        setSocialStatus(`That challenge was ${data.closed_reason || "closed"}.`);
      } else {
        renderTurnWaitingState(data);
      }
      return;
    }

    if (data.status === "waiting") {
      showScreen(elements.duelWaitingScreen);
      elements.duelWaitingCode.textContent = data.room_code;
      elements.duelWaitingStatus.textContent = data.can_accept
        ? "Accept this direct challenge from the Friends & duels screen."
        : "Waiting for an opponent…";
      return;
    }

    if (data.status === "cancelled") {
      stopDuelRuntime();
      openSocialScreen();
      setSocialStatus("That duel room was cancelled or expired.", true);
      return;
    }

    if (data.status === "completed") {
      showDuelResults(data);
      return;
    }

    const timedRound = state.activeDuelFormat === "turn_based"
      ? ["host_turn", "guest_turn"].includes(data.status)
        && ["countdown", "active"].includes(data.self?.round_status)
      : data.status === "countdown" || data.status === "active";
    if (timedRound) {
      showScreen(elements.duelGameScreen);
      startDuelTimer();
    }

    const questionReady = state.activeDuelFormat === "turn_based"
      ? data.self?.round_status === "active"
      : data.status === "active";
    if (questionReady && data.question) {
      const position = Number(data.question.position);
      if (!state.duelQuestion || state.duelQuestion.position !== position) {
        state.duelQuestion = {
          position,
          question: data.question.question,
          answers: Array.isArray(data.question.answers) ? data.question.answers : [],
          categoryLabel: data.question.category_label
        };
        state.duelLocked = false;
        renderDuelQuestion();
      }
    }
  }

  function updateDuelScoreboard(data) {
    const self = data.self || {};
    const opponent = data.opponent || {};
    const hideOpponentProgress = data.match_format === "turn_based"
      && data.status !== "completed";
    elements.duelSelfScore.textContent = Number(self.score || 0).toLocaleString();
    elements.duelSelfProgress.textContent = String(self.questions_answered || 0);
    elements.duelOpponentName.textContent = opponent.display_name || "Opponent";
    elements.duelOpponentScore.textContent = hideOpponentProgress
      ? "—"
      : Number(opponent.score || 0).toLocaleString();
    elements.duelOpponentProgressText.textContent = hideOpponentProgress
      ? "Hidden until finish"
      : `${opponent.questions_answered || 0} answered`;
  }

  function renderDuelQuestion() {
    const question = state.duelQuestion;
    elements.duelCategoryBadge.textContent = question.categoryLabel;
    elements.duelQuestionNumber.textContent = String(question.position);
    elements.duelQuestionText.textContent = question.question;
    elements.duelFeedback.textContent = "";
    elements.duelFeedback.className = "feedback";
    elements.duelAnswerGrid.replaceChildren();
    question.answers.forEach((answer, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "answer-button";
      const key = document.createElement("span");
      key.className = "answer-key";
      key.textContent = String(index + 1);
      const label = document.createElement("span");
      label.textContent = answer;
      button.append(key, label);
      button.addEventListener("click", () => submitDuelAnswer(index));
      elements.duelAnswerGrid.appendChild(button);
    });
  }

  async function submitDuelAnswer(selectedIndex) {
    const roundIsActive = state.activeDuelFormat === "turn_based"
      ? state.duelState?.self?.round_status === "active"
      : state.duelState?.status === "active";
    if (state.duelLocked || !state.duelQuestion || !roundIsActive) {
      return;
    }

    state.duelLocked = true;
    const buttons = [...elements.duelAnswerGrid.querySelectorAll(".answer-button")];
    buttons.forEach((button) => { button.disabled = true; });
    const parameters = {
      p_match_id: state.activeDuelId,
      p_position: state.duelQuestion.position,
      p_selected_index: selectedIndex,
      p_request_id: createRequestId()
    };

    let response = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const rpcName = state.activeDuelFormat === "turn_based"
        ? "submit_turn_challenge_answer"
        : "submit_duel_answer";
      const { data, error } = await supabaseClient.rpc(rpcName, parameters);
      if (!error) {
        response = data;
        break;
      }
      console.warn("Could not submit duel answer:", error);
      if (attempt === 0) {
        await wait(250);
      }
    }

    if (!response) {
      state.duelLocked = false;
      buttons.forEach((button) => { button.disabled = false; });
      elements.duelFeedback.textContent = "Answer not sent — please try again.";
      elements.duelFeedback.className = "feedback wrong";
      return;
    }

    if (response.status === "round_completed" || response.status === "completed") {
      state.duelQuestion = null;
      await refreshDuelState();
      return;
    }

    syncDuelClock(response.server_now);
    if (selectedIndex !== null) {
      buttons[selectedIndex]?.classList.add(response.is_correct ? "correct" : "wrong");
    }
    elements.duelFeedback.textContent = response.is_correct
      ? `Correct! +${response.points_awarded}`
      : `${selectedIndex === null ? "Passed" : "Incorrect"} — the answer was ${response.correct_answer}.`;
    elements.duelFeedback.className = response.is_correct ? "feedback correct" : "feedback wrong";
    elements.duelSelfScore.textContent = Number(response.score || 0).toLocaleString();
    elements.duelSelfProgress.textContent = String(response.questions_answered || 0);
    state.duelQuestion = null;
    window.setTimeout(() => void refreshDuelState(), getDuelDelay(response.next_question_at));
  }

  function syncDuelClock(serverNow) {
    const parsed = Date.parse(serverNow);
    if (Number.isFinite(parsed)) {
      state.duelServerOffsetMs = parsed - Date.now();
    }
  }

  function duelNowMs() {
    return Date.now() + state.duelServerOffsetMs;
  }

  function getDuelDelay(availableAt) {
    const parsed = Date.parse(availableAt);
    return Number.isFinite(parsed) ? Math.max(40, parsed - duelNowMs()) : QUESTION_DELAY_MS;
  }

  function startDuelTimer() {
    if (state.duelTimerFrame !== null) {
      return;
    }

    const draw = () => {
      const duel = state.duelState;
      const roundStatus = state.activeDuelFormat === "turn_based"
        ? duel?.self?.round_status
        : duel?.status;
      if (!duel || !["countdown", "active"].includes(roundStatus)) {
        state.duelTimerFrame = null;
        return;
      }
      const now = duelNowMs();
      if (roundStatus === "countdown") {
        const count = Math.max(0, Math.ceil((Date.parse(duel.starts_at) - now) / 1000));
        elements.duelTimerValue.textContent = String(count);
        elements.duelPhaseLabel.textContent = "GET READY";
      } else {
        const remaining = Math.max(0, Math.ceil((Date.parse(duel.ends_at) - now) / 1000));
        elements.duelTimerValue.textContent = String(remaining);
        elements.duelPhaseLabel.textContent = "SECONDS";
      }
      state.duelTimerFrame = requestAnimationFrame(draw);
    };

    state.duelTimerFrame = requestAnimationFrame(draw);
  }

  async function copyDuelInviteLink() {
    const url = new URL(window.location.href);
    url.searchParams.set("duel", state.activeDuelCode);
    try {
      await navigator.clipboard.writeText(url.toString());
      elements.duelWaitingStatus.textContent = "Invite link copied.";
    } catch {
      elements.duelWaitingStatus.textContent = `${state.activeDuelCode} — share this room code.`;
    }
  }

  async function cancelWaitingDuel() {
    if (state.activeDuelFormat === "turn_based") {
      await cancelTurnChallenge();
      return;
    }
    const { error } = await supabaseClient.rpc("cancel_duel", { p_match_id: state.activeDuelId });
    if (error) {
      elements.duelWaitingStatus.textContent = error.message;
      return;
    }
    stopDuelRuntime();
    openSocialScreen();
  }

  function showDuelResults(data) {
    stopDuelRuntime(false);
    state.duelState = data;
    const self = data.self || {};
    const opponent = data.opponent || {};
    const outcome = self.outcome;
    if (data.match_format === "turn_based") {
      void requestNotificationDispatch(`turn-result:${data.match_id}`);
    }
    elements.duelResultBadge.textContent = data.match_format === "turn_based"
      ? "CHALLENGE COMPLETE"
      : "DUEL COMPLETE";
    elements.duelResultTitle.textContent = outcome === "win"
      ? "You win!"
      : outcome === "draw"
        ? "It's a draw"
        : outcome === "forfeit"
          ? "Connection forfeited"
          : "Opponent wins";
    elements.duelResultMessage.textContent = data.result_reason === "forfeit"
      ? "The match was decided because one player did not reconnect before time expired."
      : data.match_format === "turn_based"
        ? "Both private rounds used the same questions, order and server-validated scoring."
        : "Final scores were validated by the server.";
    elements.duelFinalSelfScore.textContent = Number(self.score || 0).toLocaleString();
    elements.duelFinalOpponentName.textContent = opponent.display_name || "Opponent";
    elements.duelFinalOpponentScore.textContent = Number(opponent.score || 0).toLocaleString();
    state.rematchSettings = {
      category: data.category_id,
      duration: Number(String(data.game_mode || "duel_60").split("_")[1]),
      opponentAccount: opponent.account_number || null,
      matchFormat: data.match_format || "live"
    };
    showScreen(elements.duelResultsScreen);
  }

  function stopDuelRuntime(clearMatch = true) {
    if (state.duelPollTimer !== null) {
      window.clearInterval(state.duelPollTimer);
      state.duelPollTimer = null;
    }
    if (state.duelTimerFrame !== null) {
      cancelAnimationFrame(state.duelTimerFrame);
      state.duelTimerFrame = null;
    }
    if (state.duelSubscription) {
      if (typeof supabaseClient.removeChannel === "function") {
        void supabaseClient.removeChannel(state.duelSubscription);
      }
      state.duelSubscription = null;
    }
    state.duelRefreshPending = false;
    if (clearMatch) {
      state.activeDuelId = null;
      state.activeDuelCode = null;
      state.activeDuelFormat = "live";
      state.duelQuestion = null;
      state.notificationDispatchKey = null;
      localStorage.removeItem("triviaRushActiveDuel");
    }
  }

  async function createRematch() {
    const settings = state.rematchSettings;
    if (!settings) {
      openSocialScreen();
      return;
    }
    openSocialScreen();
    elements.duelCategorySelect.value = settings.category;
    elements.duelDurationSelect.value = String(settings.duration);
    elements.duelFormatSelect.value = settings.matchFormat || "live";
    updateDuelFormatUI();
    elements.duelInviteAccount.value = settings.opponentAccount ? String(settings.opponentAccount) : "";
    await createDuel();
  }

  function showHome() {
    cancelAnimationFrame(state.timerFrame);
    state.timerFrame = null;
    stopRecognition();
    stopSpeaking();
    updateStartStats();
    showScreen(elements.startScreen);
  }

  function updateStartStats() {
    elements.startHighScore.textContent = readNumber("triviaRushHighScore").toLocaleString();
    elements.startBestStreak.textContent = String(readNumber("triviaRushBestStreak"));
  }
  function handleKeyboard(event) {
    if (
      elements.accountDialog?.open ||
      elements.howToDialog?.open
    ) {
      return;
    }

    if (elements.duelGameScreen?.classList.contains("active")) {
      if (["1", "2", "3"].includes(event.key)) {
        void submitDuelAnswer(Number(event.key) - 1);
      } else if (event.key.toLowerCase() === "p") {
        void submitDuelAnswer(null);
      }
      return;
    }

    if (!elements.gameScreen.classList.contains("active")) {
      return;
    }

    if (["1", "2", "3"].includes(event.key)) {
      selectAnswer(Number(event.key) - 1);
    } else if (
      event.key.toLowerCase() === "p"
    ) {
      passQuestion();
    } else if (
      event.key.toLowerCase() === "v"
    ) {
      toggleVoiceRecognition();
    }
  }

  function toggleSound() {
    state.soundEnabled = !state.soundEnabled;
    elements.soundToggle.setAttribute("aria-pressed", String(state.soundEnabled));
    elements.soundToggle.querySelector("span").textContent = state.soundEnabled ? "🔊" : "🔇";
    localStorage.setItem("triviaRushSound", String(state.soundEnabled));
    playTone(500, 0.06);
  }

  function toggleHost() {
    state.hostEnabled = !state.hostEnabled;
    elements.hostToggle.setAttribute("aria-pressed", String(state.hostEnabled));
    localStorage.setItem("triviaRushHost", String(state.hostEnabled));

    if (!state.hostEnabled) {
      stopSpeaking();
    } else {
      speak("Spoken host enabled.");
    }
  }

  function loadPreferences() {
    const savedSound = localStorage.getItem("triviaRushSound");
    const savedHost = localStorage.getItem("triviaRushHost");

    state.soundEnabled = savedSound === null ? true : savedSound === "true";
    state.hostEnabled = savedHost === "true";

    elements.soundToggle.setAttribute("aria-pressed", String(state.soundEnabled));
    elements.soundToggle.querySelector("span").textContent = state.soundEnabled ? "🔊" : "🔇";
    elements.hostToggle.setAttribute("aria-pressed", String(state.hostEnabled));
  }

  function speakQuestion() {
    const question = state.currentQuestion;
    const answerText = question.answers
      .map((answer, index) => `${index + 1}, ${answer}`)
      .join(". ");

    speak(`${question.question}. ${answerText}.`);
  }

  function speak(text) {
    if (!state.hostEnabled || !("speechSynthesis" in window)) {
      return;
    }

    stopSpeaking();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.08;
    utterance.pitch = 1.02;
    utterance.volume = 0.95;
    window.speechSynthesis.speak(utterance);
  }

  function stopSpeaking() {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }

  function configureSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      elements.voiceButton.disabled = true;
      elements.voiceButtonText.textContent = "Voice input unavailable";
      return;
    }

    state.recognition = new SpeechRecognition();
    state.recognition.lang = "en-GB";
    state.recognition.interimResults = false;
    state.recognition.maxAlternatives = 3;

    state.recognition.addEventListener("start", () => {
      state.listening = true;
      elements.voiceButton.classList.add("listening");
      elements.voiceButtonText.textContent = "Listening…";
    });

    state.recognition.addEventListener("end", () => {
      state.listening = false;
      elements.voiceButton.classList.remove("listening");
      elements.voiceButtonText.textContent = "Answer by voice";
    });

    state.recognition.addEventListener("error", (event) => {
      console.warn("Speech recognition error:", event.error);
      elements.feedback.textContent = event.error === "not-allowed"
        ? "Microphone permission was not granted."
        : "I did not catch that. Try a button or number key.";
    });

    state.recognition.addEventListener("result", (event) => {
      const transcript = [...event.results[0]]
        .map((result) => result.transcript)
        .join(" ");

      processVoiceAnswer(transcript);
    });
  }

  function toggleVoiceRecognition() {
    if (!state.recognition || state.locked || state.remainingMs <= 0) {
      return;
    }

    if (state.listening) {
      stopRecognition();
      return;
    }

    stopSpeaking();
    try {
      state.recognition.start();
    } catch (error) {
      console.warn("Speech recognition could not start:", error);
    }
  }

  function stopRecognition() {
    if (state.recognition && state.listening) {
      state.recognition.stop();
    }
  }

  function processVoiceAnswer(transcript) {
    if (!state.currentQuestion || state.locked) {
      return;
    }

    const spoken = normaliseText(transcript);
    const numberMap = {
      "one": 0,
      "1": 0,
      "first": 0,
      "two": 1,
      "2": 1,
      "second": 1,
      "three": 2,
      "3": 2,
      "third": 2
    };

    const numberMatch = Object.entries(numberMap).find(([word]) => spoken.split(" ").includes(word));
    if (numberMatch) {
      selectAnswer(numberMatch[1]);
      return;
    }

    const answerMatches = state.currentQuestion.answers.map((answer, index) => ({
      index,
      normalised: normaliseText(answer)
    }));

    const exact = answerMatches.find((item) => spoken.includes(item.normalised) || item.normalised.includes(spoken));
    if (exact) {
      selectAnswer(exact.index);
      return;
    }

    elements.feedback.textContent = `Heard “${transcript}” — please try again or tap an answer.`;
  }

  function playTone(frequency, duration) {
    if (!state.soundEnabled) {
      return;
    }

    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + duration + 0.02);
      oscillator.addEventListener("ended", () => context.close());
    } catch (error) {
      console.warn("Audio playback unavailable:", error);
    }
  }

  function playSuccessSound() {
    playTone(600, 0.09);
    window.setTimeout(() => playTone(820, 0.12), 80);
  }

  function playWrongSound() {
    playTone(230, 0.12);
    window.setTimeout(() => playTone(170, 0.16), 90);
  }

  function playFinishSound() {
    playTone(440, 0.1);
    window.setTimeout(() => playTone(550, 0.1), 100);
    window.setTimeout(() => playTone(720, 0.18), 200);
  }

  function getResultCopy(correct, accuracy) {
    if (correct >= 15 && accuracy >= 80) {
      return {
        title: "Trivia legend!",
        message: "Fast, accurate and almost impossible to stop."
      };
    }

    if (correct >= 10) {
      return {
        title: "Heroic run!",
        message: "You handled the pressure and built an excellent score."
      };
    }

    if (correct >= 5) {
      return {
        title: "Strong effort!",
        message: "A few quicker answers could send your score soaring."
      };
    }

    return {
      title: "Good warm-up!",
      message: "Now you know the pace. Try again and hunt for a longer streak."
    };
  }

  function readNumber(key) {
    const value = Number(localStorage.getItem(key));
    return Number.isFinite(value) ? value : 0;
  }

  function shuffle(items) {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]];
    }
    return copy;
  }

  function randomItem(items) {
    return items[Math.floor(Math.random() * items.length)];
  }

  function wait(milliseconds) {
    return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
  }

  function normaliseText(value) {
    return value
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  init();
})();
