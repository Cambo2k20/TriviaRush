(() => {
  "use strict";

  const GAME_SECONDS = 60;
  const QUESTION_DELAY_MS = 850;
  const TIMER_CIRCUMFERENCE = 2 * Math.PI * 52;
  const QUESTIONS = Array.isArray(window.TRIVIA_QUESTIONS) ? window.TRIVIA_QUESTIONS : [];
  const SUPABASE_URL = "https://kgdnuzasbeavpqharbpf.supabase.co";
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
    soundEnabled: true,
    hostEnabled: false,
    recognition: null,
    listening: false,
    selectedCategory: "All categories",
    user: null,
    profile: null,
    scoreSaved: false,
    responseTimes: []
  };

  const elements = {
    screens: [...document.querySelectorAll(".screen")],

    startScreen:
      document.querySelector("#startScreen"),

    countdownScreen:
      document.querySelector("#countdownScreen"),

    gameScreen:
      document.querySelector("#gameScreen"),

    resultsScreen:
      document.querySelector("#resultsScreen"),

    startButton:
      document.querySelector("#startButton"),

    playAgainButton:
      document.querySelector("#playAgainButton"),

    homeButton:
      document.querySelector("#homeButton"),

    categorySelect:
      document.querySelector("#categorySelect"),

    startHighScore:
      document.querySelector("#startHighScore"),

    startBestStreak:
      document.querySelector("#startBestStreak"),

    countdownNumber:
      document.querySelector("#countdownNumber"),

    scoreValue:
      document.querySelector("#scoreValue"),

    streakValue:
      document.querySelector("#streakValue"),

    timerValue:
      document.querySelector("#timerValue"),

    timerProgress:
      document.querySelector("#timerProgress"),

    categoryBadge:
      document.querySelector("#categoryBadge"),

    questionNumber:
      document.querySelector("#questionNumber"),

    questionText:
      document.querySelector("#questionText"),

    answerGrid:
      document.querySelector("#answerGrid"),

    passButton:
      document.querySelector("#passButton"),

    voiceButton:
      document.querySelector("#voiceButton"),

    voiceButtonText:
      document.querySelector("#voiceButtonText"),

    feedback:
      document.querySelector("#feedback"),

    finalScore:
      document.querySelector("#finalScore"),

    correctTotal:
      document.querySelector("#correctTotal"),

    answeredTotal:
      document.querySelector("#answeredTotal"),

    accuracyTotal:
      document.querySelector("#accuracyTotal"),

    bestStreakTotal:
      document.querySelector("#bestStreakTotal"),

    resultTitle:
      document.querySelector("#resultTitle"),

    resultMessage:
      document.querySelector("#resultMessage"),

    newHighScore:
      document.querySelector("#newHighScore"),

    soundToggle:
      document.querySelector("#soundToggle"),

    hostToggle:
      document.querySelector("#hostToggle"),

    accountButton:
      document.querySelector("#accountButton"),

    accountButtonText:
      document.querySelector("#accountButtonText"),

    accountDialog:
      document.querySelector("#accountDialog"),

    closeAccountDialogButton:
      document.querySelector(
        "#closeAccountDialogButton"
      ),

    accountDescription:
      document.querySelector(
        "#accountDescription"
      ),

    accountPlayerName:
      document.querySelector(
        "#accountPlayerName"
      ),
    
    accountIdentifier:
      document.querySelector(
        "#accountIdentifier"
      ),

    accountUsername:
      document.querySelector(
        "#accountUsername"
      ),

    accountEmail:
      document.querySelector("#accountEmail"),

    accountPassword:
      document.querySelector(
        "#accountPassword"
      ),

    createAccountButton:
      document.querySelector(
        "#createAccountButton"
      ),

    signInButton:
      document.querySelector("#signInButton"),

    signOutButton:
      document.querySelector("#signOutButton"),

    accountStatus:
      document.querySelector("#accountStatus"),

    howToButton:
      document.querySelector("#howToButton"),

    howToDialog:
      document.querySelector("#howToDialog"),

    closeDialogButton:
      document.querySelector(
        "#closeDialogButton"
      )
  };

  async function init() {
    validateQuestions();
    populateCategories();
    loadPreferences();
    updateStartStats();
    configureSpeechRecognition();

    elements.timerProgress.style.strokeDasharray =
      `${TIMER_CIRCUMFERENCE}`;

    elements.timerProgress.style.strokeDashoffset =
      "0";

    /*
    * Initialise authentication before attaching the
    * account controls. This prevents the account window
    * opening before state.user is ready.
    */
    await initialisePlayer();

    updateAccountUI();
    bindEvents();

    await testSupabaseConnection();
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

    while (!state.profile) {
      const displayName =
        requestPlayerName();

      if (!displayName) {
        return false;
      }

      const {
        data: createdProfile,
        error
      } =
        await supabaseClient
          .from("profiles")
          .insert({
            id: state.user.id,
            display_name: displayName
          })
          .select("id, display_name")
          .single();

      if (error?.code === "23505") {
        localStorage.removeItem(
          "triviaRushPlayerName"
        );

        alert(
          "That player name is already being used. Choose another name."
        );

        continue;
      }

      if (error) {
        console.error(
          "Could not create player profile:",
          error
        );

        alert(
          `The player profile could not be created.\n\n` +
          `${error.message}`
        );

        return false;
      }

      state.profile = createdProfile;
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

  function openAccountDialog() {
    if (!elements.accountDialog) {
      console.error(
        "The #accountDialog element is missing."
      );

      alert(
        "The account window could not be opened."
      );

      return;
    }

    if (elements.accountStatus) {
      elements.accountStatus.textContent = "";
      elements.accountStatus.className =
        "account-status";
    }

    updateAccountUI();

    elements.accountDialog.showModal();
  }

  function closeAccountDialog() {
    if (!elements.accountDialog) {
      return;
    }

    elements.accountDialog.close();
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

    return `#${String(
      parsedNumber
    ).padStart(4, "0")}`;
  }

  function updateAccountUI() {
    const isPermanentAccount =
      Boolean(
        state.user?.email &&
        !state.user?.is_anonymous
      );

    const passwordSetupPending =
      localStorage.getItem(
        "triviaRushPendingPasswordSetup"
      ) === "true";

    const playerName =
      state.profile?.display_name ||
      "Guest player";

    const accountIdentifier =
      formatAccountIdentifier(
        state.profile?.account_number
      );

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
        accountIdentifier;
    }

    if (
      elements.accountUsername &&
      !elements.accountUsername.value
    ) {
      elements.accountUsername.value =
        state.profile?.display_name || "";
    }

    if (!elements.accountDescription) {
      return;
    }

    if (isPermanentAccount) {
      elements.accountDescription.textContent =
        passwordSetupPending
          ? "Your email has been verified. Enter a password to finish creating your account."
          : "Your leaderboard progress is protected by your account.";

      if (elements.accountEmail) {
        elements.accountEmail.value =
          state.user.email || "";

        elements.accountEmail.disabled =
          true;
      }

      if (elements.accountUsername) {
        elements.accountUsername.disabled =
          false;
      }

      if (elements.accountPassword) {
        elements.accountPassword.disabled =
          false;
      }

      if (elements.createAccountButton) {
        elements.createAccountButton.hidden =
          false;

        elements.createAccountButton.textContent =
          passwordSetupPending
            ? "Finish account setup"
            : "Update account";
      }

      if (elements.signInButton) {
        elements.signInButton.hidden =
          true;
      }

      if (elements.signOutButton) {
        elements.signOutButton.hidden =
          false;
      }

      if (
        elements.accountStatus &&
        !elements.accountStatus.textContent
      ) {
        setAccountStatus(
          passwordSetupPending
            ? "Email verified. Choose your password to complete account setup."
            : `Signed in as ${state.user.email}.`
        );
      }

      return;
    }

    elements.accountDescription.textContent =
      "Create an account to protect your leaderboard progress, or sign in to an existing account.";

    if (elements.accountUsername) {
      elements.accountUsername.disabled =
        false;
    }

    if (elements.accountEmail) {
      elements.accountEmail.disabled =
        false;
    }

    if (elements.accountPassword) {
      elements.accountPassword.disabled =
        false;
    }

    if (elements.createAccountButton) {
      elements.createAccountButton.hidden =
        false;

      elements.createAccountButton.textContent =
        "Create account";
    }

    if (elements.signInButton) {
      elements.signInButton.hidden =
        false;
    }

    if (elements.signOutButton) {
      elements.signOutButton.hidden =
        true;
    }

    if (
      elements.accountStatus &&
      !elements.accountStatus.textContent
    ) {
      setAccountStatus(
        "You are currently playing as a guest."
      );
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
      /*
      * Only update the display name.
      * account_number is deliberately untouched.
      */
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
      /*
      * Supabase assigns account_number automatically
      * from the database sequence.
      */
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
      if (isError) {
        console.error(message);
      } else {
        console.log(message);
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


  function readAccountEmail() {
    if (!elements.accountEmail) {
      setAccountStatus(
        "The email field is missing from index.html.",
        true
      );

      return null;
    }

    const email =
      elements.accountEmail.value
        .trim()
        .toLowerCase();

    elements.accountEmail.value =
      email;

    if (
      !email ||
      !elements.accountEmail.checkValidity()
    ) {
      setAccountStatus(
        "Enter a valid email address.",
        true
      );

      return null;
    }

    return email;
  }
  function readAccountUsername() {
    if (!elements.accountUsername) {
      setAccountStatus(
        "The username field is missing from index.html.",
        true
      );

      return null;
    }

    const username =
      elements.accountUsername.value.trim();

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
  function readAccountPassword() {
    if (!elements.accountPassword) {
      setAccountStatus(
        "The password field is missing from index.html.",
        true
      );

      return null;
    }

    const password =
      elements.accountPassword.value;

    if (password.length < 8) {
      setAccountStatus(
        "Password must contain at least 8 characters.",
        true
      );

      return null;
    }

    return password;
  }
  function setAccountBusy(isBusy) {
    const isPermanentAccount =
      Boolean(
        state.user?.email &&
        !state.user?.is_anonymous
      );

    if (elements.accountUsername) {
      elements.accountUsername.disabled =
        isBusy;
    }

    if (elements.accountEmail) {
      elements.accountEmail.disabled =
        isBusy || isPermanentAccount;
    }

    if (elements.accountPassword) {
      elements.accountPassword.disabled =
        isBusy;
    }

    if (elements.createAccountButton) {
      elements.createAccountButton.disabled =
        isBusy;
    }

    if (elements.signInButton) {
      elements.signInButton.disabled =
        isBusy;
    }

    if (elements.signOutButton) {
      elements.signOutButton.disabled =
        isBusy;
    }
  }

  function isNetworkLoadError(error) {
      const message =
        String(
          error?.message ||
          error ||
          ""
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

  async function runAuthRequest(
    operation
  ) {
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

        /*
        * Retry once after a short delay in case
        * Safari or the network dropped the request.
        */
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

    if (!navigator.onLine) {
      setAccountStatus(
        "Your device appears to be offline. Reconnect to the internet and try again.",
        true
      );

      return;
    }

    const username =
      readAccountUsername();

    if (!username) {
      return;
    }

    const isPermanentAccount =
      Boolean(
        state.user.email &&
        !state.user.is_anonymous
      );

    if (isPermanentAccount) {
      const password =
        readAccountPassword();

      if (!password) {
        return;
      }

      setAccountBusy(true);

      setAccountStatus(
        "Saving your account…"
      );

      try {
        const { data, error } =
          await runAuthRequest(
            () =>
              supabaseClient.auth.updateUser({
                password,
                data: {
                  display_name: username
                }
              })
          );

        if (error) {
          throw error;
        }

        state.user =
          data.user || state.user;

        await saveProfileUsername(
          username
        );

        localStorage.removeItem(
          "triviaRushPendingPasswordSetup"
        );

        if (elements.accountPassword) {
          elements.accountPassword.value =
            "";
        }

        setAccountStatus(
          "Account saved successfully. Your leaderboard progress is protected."
        );

        updateAccountUI();
      } catch (error) {
        console.error(
          "Could not finish account setup:",
          error
        );

        if (isNetworkLoadError(error)) {
          setAccountStatus(
            "Trivia Rush could not contact Supabase. Open the game directly in Safari or Chrome, disable any content blocker or VPN for this site, switch network if possible, reload and try again.",
            true
          );
        } else {
          setAccountStatus(
            `Account could not be saved: ${
              error?.message ||
              String(error)
            }`,
            true
          );
        }
      } finally {
        setAccountBusy(false);
      }

      return;
    }

    const email =
      readAccountEmail();

    const password =
      readAccountPassword();

    if (!email || !password) {
      return;
    }

    setAccountBusy(true);

    setAccountStatus(
      "Sending your verification email…"
    );

    try {
      await saveProfileUsername(
        username
      );

      localStorage.setItem(
        "triviaRushPendingPasswordSetup",
        "true"
      );

      const { error } =
        await runAuthRequest(
          () =>
            supabaseClient.auth.updateUser(
              {
                email,
                data: {
                  display_name: username
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

      if (elements.accountPassword) {
        elements.accountPassword.value =
          "";
      }

      setAccountStatus(
        "Verification email sent. Open the link in your email, return to Trivia Rush, enter your password again and press “Finish account setup”."
      );

      if (elements.createAccountButton) {
        elements.createAccountButton.textContent =
          "Waiting for email verification";
      }
    } catch (error) {
      console.error(
        "Could not create account:",
        error
      );

      localStorage.removeItem(
        "triviaRushPendingPasswordSetup"
      );

      if (isNetworkLoadError(error)) {
        setAccountStatus(
          "The connection to Supabase failed. Open Trivia Rush directly in Safari or Chrome rather than an in-app browser, disable content blockers or VPNs temporarily, switch between Wi-Fi and mobile data, then reload and retry.",
          true
        );
      } else {
        const message =
          error?.message ||
          String(error);

        setAccountStatus(
          message
            .toLowerCase()
            .includes("already")
            ? "That email is already linked to an account. Use Sign in instead."
            : `Account could not be created: ${message}`,
          true
        );
      }
    } finally {
      setAccountBusy(false);
    }
  }
  async function signInToAccount() {
    const email =
      readAccountEmail();

    const password =
      readAccountPassword();

    if (!email || !password) {
      return;
    }

    setAccountBusy(true);
    setAccountStatus("Signing in…");

    try {
      const { data, error } =
        await supabaseClient.auth
          .signInWithPassword({
            email,
            password
          });

      if (error) {
        throw error;
      }

      state.user = data.user;
      state.profile = null;

      /*
       * A successful password sign-in proves that this
       * account has completed password setup. Store that
       * fact in user metadata so the account UI can show
       * the correct state on future visits.
       */
      if (
        !state.user?.user_metadata
          ?.password_setup_complete
      ) {
        const {
          data: updatedData,
          error: metadataError
        } =
          await supabaseClient.auth.updateUser({
            data: {
              ...state.user.user_metadata,
              password_setup_complete: true
            }
          });

        if (!metadataError && updatedData.user) {
          state.user = updatedData.user;
        }
      }

      await loadPlayerProfile();

      if (elements.accountPassword) {
        elements.accountPassword.value =
          "";
      }

      setAccountStatus(
        "Signed in successfully. Your saved leaderboard progress has been restored."
      );

      updateAccountUI();
    } catch (error) {
      console.error(
        "Could not sign in:",
        error
      );

      setAccountStatus(
        "Sign-in failed. Check your email address, password and whether your email has been verified.",
        true
      );
    } finally {
      setAccountBusy(false);
    }
  }
  async function signOutAccount() {
    setAccountBusy(true);

    try {
      const { error } =
        await supabaseClient.auth.signOut();

      if (error) {
        throw error;
      }

      state.user = null;
      state.profile = null;

      localStorage.removeItem(
        "triviaRushPlayerName"
      );

      await initialisePlayer();

      if (elements.accountUsername) {
        elements.accountUsername.value = "";
      }

      if (elements.accountEmail) {
        elements.accountEmail.value = "";
      }

      if (elements.accountPassword) {
        elements.accountPassword.value = "";
      }

      setAccountStatus(
        "Signed out. You are now playing as a new guest."
      );

      updateAccountUI();
    } catch (error) {
      console.error(
        "Could not sign out:",
        error
      );

      setAccountStatus(
        `Could not sign out: ${
          error?.message || String(error)
        }`,
        true
      );
    } finally {
      setAccountBusy(false);
    }
  }

  async function testSupabaseConnection() {
    try {
      const { error } = await supabaseClient
        .from("leaderboard")
        .select("display_name")
        .limit(1);
  
      if (error) {
        console.error("Supabase connection failed:", error);
        return;
      }
  
      console.log("Supabase connection successful");
    } catch (error) {
      console.error("Unable to contact Supabase:", error);
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

    elements.accountButton?.addEventListener(
      "click",
      openAccountDialog
    );

    elements.closeAccountDialogButton
      ?.addEventListener(
        "click",
        closeAccountDialog
      );

    elements.createAccountButton
      ?.addEventListener(
        "click",
        createAccount
      );

    elements.signInButton?.addEventListener(
      "click",
      signInToAccount
    );

    elements.signOutButton?.addEventListener(
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
    elements.screens.forEach((item) => item.classList.toggle("active", item === screen));
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
    state.scoreSaved = false;
    state.responseTimes = [];

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
    window.setTimeout(nextQuestion, 320);
  }

  function updateHud() {
    elements.scoreValue.textContent = state.score.toLocaleString();
    elements.streakValue.textContent = String(state.streak);
  }

  async function endGame() {
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

    elements.newHighScore.hidden =
      !isNewHighScore;

    updateStartStats();

    showScreen(elements.resultsScreen);

    playFinishSound();

    await saveGameResult();

    await loadLeaderboard();

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

      elements.resultMessage.textContent +=
        " Your result could not be saved because no player account was available.";

      return;
    }

    if (state.answered < 1) {
      console.warn(
        "The result was not saved because no questions were answered."
      );

      elements.resultMessage.textContent +=
        " No result was saved because no questions were answered.";

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

    try {
      const { error } =
        await supabaseClient.rpc(
          "submit_game_result",
          {
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
          }
        );

      if (error) {
        throw error;
      }

      console.log(
        "Game result saved successfully."
      );

      elements.resultMessage.textContent +=
        " Your result was saved to the global leaderboard.";
    } catch (error) {
      state.scoreSaved = false;

      console.error(
        "Could not save game result:",
        error
      );

      elements.resultMessage.textContent +=
        " Your result could not be saved to the global leaderboard.";
    }
  }

  async function loadLeaderboard() {
    try {
      const { data, error } =
        await supabaseClient
          .from("leaderboard")
          .select(`
            leaderboard_rank,
            display_name,
            games_played,
            total_questions,
            total_correct,
            total_incorrect,
            accuracy_percent,
            total_score,
            high_score,
            best_streak
          `)
          .order(
            "leaderboard_rank",
            { ascending: true }
          )
          .limit(20);

      if (error) {
        throw error;
      }

      console.log(
        "Global leaderboard loaded successfully."
      );

      console.table(data);

      return data;
    } catch (error) {
      console.error(
        "Could not load the global leaderboard:",
        error
      );

      return [];
    }
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
    if (!elements.gameScreen.classList.contains("active")) {
      return;
    }

    if (["1", "2", "3"].includes(event.key)) {
      selectAnswer(Number(event.key) - 1);
    } else if (event.key.toLowerCase() === "p") {
      passQuestion();
    } else if (event.key.toLowerCase() === "v") {
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
