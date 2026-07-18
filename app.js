(() => {
  "use strict";

  const GAME_SECONDS = 60;
  const QUESTION_DELAY_MS = 850;
  const TIMER_CIRCUMFERENCE = 2 * Math.PI * 52;
  const QUESTIONS = Array.isArray(window.TRIVIA_QUESTIONS) ? window.TRIVIA_QUESTIONS : [];
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
    pool: [],
    currentQuestion: null,
    questionIndex: 0,
    score: 0,
    streak: 0,
    bestStreak: 0,
    correct: 0,
    answered: 0,
    remainingMs: GAME_SECONDS * 1000,
    questionStartedAt: 0,
    timerStartedAt: 0,
    timerFrame: null,
    locked: false,
    gameEnded: false,
    pendingQuestionTimer: null,
    soundEnabled: true,
    hostEnabled: false,
    recognition: null,
    listening: false,
    selectedCategory: "All categories",
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
    leaderboardRequestId: 0
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
    validateQuestions();
    populateCategories();
    buildLeaderboardCategoryFilters();
    loadPreferences();
    updateStartStats();
    configureSpeechRecognition();
    setupAuthStateListener();
    bindEvents();
    updateLeaderboardFilterButtons();

    if (elements.timerProgress) {
      elements.timerProgress.style.strokeDasharray =
        `${TIMER_CIRCUMFERENCE}`;
      elements.timerProgress.style.strokeDashoffset = "0";
    }

    await initialisePlayer();
    updateAccountUI();
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

  function validateQuestions() {
    const invalid = QUESTIONS.find((item) => {
      return !item ||
        typeof item.question !== "string" ||
        typeof item.category !== "string" ||
        !Array.isArray(item.answers) ||
        item.answers.length !== 3 ||
        !Number.isInteger(item.correct) ||
        item.correct < 0 ||
        item.correct > 2;
    });

    if (invalid) {
      console.error("Invalid trivia question:", invalid);
      alert("One or more questions in questions.js use an invalid format. Check the browser console.");
    }

    if (QUESTIONS.length < 1) {
      elements.startButton.disabled = true;
      elements.startButton.textContent = "Add questions to questions.js";
    }
  }

  function populateCategories() {
    const categories = [...new Set(QUESTIONS.map((question) => question.category))].sort();
    const options = ["All categories", ...categories];

    elements.categorySelect.innerHTML = options
      .map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`)
      .join("");
  }

  // Phase 3: the leaderboard category filters are generated from the same
  // question bank that populates the start-screen select, so the stored
  // game_sessions.category values and the filter buttons can never drift
  // apart. "Overall" is the unfiltered board and "Mixed" surfaces games
  // played with the "All categories" option, which are saved as "mixed".
  function buildLeaderboardCategoryFilters() {
    if (!elements.leaderboardCategoryFilters) {
      return;
    }

    const questionCategories = [
      ...new Set(
        QUESTIONS.map(
          (question) => question.category
        )
      )
    ].sort();

    const categories = [
      { id: "overall", label: "Overall" },
      { id: "mixed", label: "Mixed" }
    ];

    questionCategories.forEach((category) => {
      const id = category.trim().toLowerCase();

      if (
        !categories.some(
          (existing) => existing.id === id
        )
      ) {
        categories.push({
          id,
          label: category
        });
      }
    });

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
      screen === elements.countdownScreen;

    if (elements.leaderboardButton) {
      elements.leaderboardButton.disabled =
        gameIsRunning;
    }

    if (elements.accountButton) {
      elements.accountButton.disabled =
        gameIsRunning;
    }
  }

  async function beginCountdown() {
    const profileReady =
      await ensurePlayerProfile();

    if (!profileReady) {
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

    startGame();
  }

  function resetGame() {
    const categoryQuestions =
      state.selectedCategory === "All categories"
        ? [...QUESTIONS]
        : QUESTIONS.filter(
            (question) =>
              question.category === state.selectedCategory
          );

    state.pool = shuffle(categoryQuestions);
    state.currentQuestion = null;
    state.questionIndex = 0;
    state.score = 0;
    state.streak = 0;
    state.bestStreak = 0;
    state.correct = 0;
    state.answered = 0;
    state.remainingMs = GAME_SECONDS * 1000;
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

  function startGame() {
    showScreen(elements.gameScreen);
    state.timerStartedAt = performance.now();
    state.questionStartedAt = state.timerStartedAt;
    nextQuestion();
    timerLoop();
  }

  function timerLoop(now = performance.now()) {
    const elapsed = now - state.timerStartedAt;
    state.remainingMs = Math.max(0, GAME_SECONDS * 1000 - elapsed);

    const seconds = Math.ceil(state.remainingMs / 1000);
    const ratio = state.remainingMs / (GAME_SECONDS * 1000);

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
      endGame();
      return;
    }

    state.timerFrame = requestAnimationFrame(timerLoop);
  }

  function nextQuestion() {
    state.pendingQuestionTimer = null;

    if (state.remainingMs <= 0) {
      endGame();
      return;
    }

    stopRecognition();
    state.locked = false;
    elements.feedback.textContent = "";
    elements.feedback.className = "feedback";

    if (state.pool.length === 0) {
      const basePool = state.selectedCategory === "All categories"
        ? [...QUESTIONS]
        : QUESTIONS.filter((question) => question.category === state.selectedCategory);
      state.pool = shuffle(basePool);
    }

    state.currentQuestion = state.pool.pop();
    state.questionIndex += 1;
    state.questionStartedAt = performance.now();

    renderQuestion();
    if (state.hostEnabled) {
      speakQuestion();
    }
  }

  function renderQuestion() {
    const question = state.currentQuestion;
    elements.categoryBadge.textContent = question.category;
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

  function selectAnswer(index) {
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

    const isCorrect =
      index === state.currentQuestion.correct;

    const responseMs = Math.round(
      performance.now() -
        state.questionStartedAt
    );

    state.responseTimes.push(responseMs);
    state.answered += 1;

    buttons.forEach(
      (button, buttonIndex) => {
        button.disabled = true;

        if (
          buttonIndex ===
          state.currentQuestion.correct
        ) {
          button.classList.add("correct");
        }

        if (
          !isCorrect &&
          buttonIndex === index
        ) {
          button.classList.add("wrong");
        }
      }
    );

    if (isCorrect) {
      state.correct += 1;
      state.streak += 1;

      state.bestStreak = Math.max(
        state.bestStreak,
        state.streak
      );

      const speedBonus = Math.max(
        0,
        100 -
          Math.floor(responseMs / 60)
      );

      const multiplier = Math.min(
        3,
        1 +
          Math.floor(
            (state.streak - 1) / 3
          ) *
            0.5
      );

      const points = Math.round(
        (100 + speedBonus) *
          multiplier
      );

      state.score += points;

      elements.feedback.textContent =
        `Correct! +${points}`;

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
        `The answer was ${
          state.currentQuestion.answers[
            state.currentQuestion.correct
          ]
        }.`;

      elements.feedback.className =
        "feedback wrong";

      playWrongSound();

      if (state.hostEnabled) {
        speak(
          `Not this time. The answer was ${
            state.currentQuestion.answers[
              state.currentQuestion.correct
            ]
          }.`
        );
      }
    }

    updateHud();

    state.pendingQuestionTimer =
      window.setTimeout(
        nextQuestion,
        QUESTION_DELAY_MS
      );
  }


  function passQuestion() {
    if (state.locked || state.remainingMs <= 0) {
      return;
    }

    state.locked = true;
    state.streak = 0;
    elements.feedback.textContent = "Passed — next question!";
    elements.feedback.className = "feedback";
    updateHud();
    playTone(260, 0.08);
    state.pendingQuestionTimer = window.setTimeout(nextQuestion, 320);
  }

  function updateHud() {
    elements.scoreValue.textContent = state.score.toLocaleString();
    elements.streakValue.textContent = String(state.streak);
  }

  async function endGame() {
    // Phase 3: if the timer expires while a post-answer delay is still
    // pending, both timerLoop and the delayed nextQuestion call used to run
    // endGame, replaying the finish sound and overwriting the saved-result
    // message. The guard and timer clear below make endGame run exactly once.
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

    elements.newHighScore.hidden =
      !isNewHighScore;

    updateStartStats();

    showScreen(elements.resultsScreen);

    playFinishSound();

    await saveGameResult();

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

    if (!state.user || !state.profile) {
      console.warn(
        "The result was not saved because no player is signed in."
      );

      setResultSaveMessage(
        "Your result could not be saved because no player account was available."
      );

      return;
    }

    if (state.answered < 1) {
      console.warn(
        "The result was not saved because no questions were answered."
      );

      setResultSaveMessage(
        "No result was saved because no questions were answered."
      );

      return;
    }

    state.scoreSaved = true;

    const incorrectAnswers =
      state.answered - state.correct;

    const averageResponseMs =
      state.responseTimes.length === 0
        ? null
        : Math.round(
            state.responseTimes.reduce(
              (total, responseTime) =>
                total + responseTime,
              0
            ) / state.responseTimes.length
          );

    const category =
      state.selectedCategory ===
      "All categories"
        ? "mixed"
        : state.selectedCategory;

    const parameters = {
      p_questions_answered:
        state.answered,
      p_correct_answers:
        state.correct,
      p_incorrect_answers:
        incorrectAnswers,
      p_score:
        state.score,
      p_best_streak:
        state.bestStreak,
      p_average_response_ms:
        averageResponseMs,
      p_duration_seconds:
        GAME_SECONDS,
      p_game_mode:
        "rush_60",
      p_category:
        category
    };

    try {
      const { error } =
        await supabaseClient.rpc(
          "submit_game_result",
          parameters
        );

      if (error) {
        throw error;
      }

      console.log(
        "Game result saved successfully."
      );

      state.leaderboardRows = [];

      setResultSaveMessage(
        "Your result was saved to the global leaderboard."
      );

      if (elements.retrySaveButton) {
        elements.retrySaveButton.hidden =
          true;
      }
    } catch (error) {
      state.scoreSaved = false;

      console.error(
        "Could not save game result:",
        error
      );

      setResultSaveMessage(
        "Your result could not be saved to the global leaderboard."
      );

      if (elements.retrySaveButton) {
        elements.retrySaveButton.hidden =
          false;
      }
    }
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

    if (
      !elements.gameScreen.classList
        .contains("active")
    ) {
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
