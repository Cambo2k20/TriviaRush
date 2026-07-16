(() => {
  "use strict";

  const GAME_SECONDS = 60;
  const QUESTION_DELAY_MS = 850;
  const TIMER_CIRCUMFERENCE = 2 * Math.PI * 52;
  const QUESTIONS = Array.isArray(window.TRIVIA_QUESTIONS) ? window.TRIVIA_QUESTIONS : [];

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
    selectedCategory: "All categories"
  };

  const elements = {
    screens: [...document.querySelectorAll(".screen")],
    startScreen: document.querySelector("#startScreen"),
    countdownScreen: document.querySelector("#countdownScreen"),
    gameScreen: document.querySelector("#gameScreen"),
    resultsScreen: document.querySelector("#resultsScreen"),
    startButton: document.querySelector("#startButton"),
    playAgainButton: document.querySelector("#playAgainButton"),
    homeButton: document.querySelector("#homeButton"),
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
    howToButton: document.querySelector("#howToButton"),
    howToDialog: document.querySelector("#howToDialog"),
    closeDialogButton: document.querySelector("#closeDialogButton")
  };

  function init() {
    validateQuestions();
    populateCategories();
    loadPreferences();
    updateStartStats();
    configureSpeechRecognition();
    bindEvents();

    elements.timerProgress.style.strokeDasharray = `${TIMER_CIRCUMFERENCE}`;
    elements.timerProgress.style.strokeDashoffset = "0";
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
    elements.startButton.addEventListener("click", beginCountdown);
    elements.playAgainButton.addEventListener("click", beginCountdown);
    elements.homeButton.addEventListener("click", showHome);
    elements.passButton.addEventListener("click", passQuestion);
    elements.voiceButton.addEventListener("click", toggleVoiceRecognition);
    elements.soundToggle.addEventListener("click", toggleSound);
    elements.hostToggle.addEventListener("click", toggleHost);
    elements.howToButton.addEventListener("click", () => elements.howToDialog.showModal());
    elements.closeDialogButton.addEventListener("click", () => elements.howToDialog.close());

    elements.howToDialog.addEventListener("click", (event) => {
      if (event.target === elements.howToDialog) {
        elements.howToDialog.close();
      }
    });

    document.addEventListener("keydown", handleKeyboard);
  }

  function showScreen(screen) {
    elements.screens.forEach((item) => item.classList.toggle("active", item === screen));
  }

  async function beginCountdown() {
    state.selectedCategory = elements.categorySelect.value;
    resetGame();
    showScreen(elements.countdownScreen);

    stopSpeaking();
    if (state.hostEnabled) {
      speak("Get ready.");
    }

    const values = ["3", "2", "1", "GO!"];
    for (const value of values) {
      elements.countdownNumber.textContent = value;
      playTone(value === "GO!" ? 660 : 440, value === "GO!" ? 0.16 : 0.09);
      await wait(value === "GO!" ? 450 : 650);
    }

    startGame();
  }

  function resetGame() {
    const categoryQuestions = state.selectedCategory === "All categories"
      ? [...QUESTIONS]
      : QUESTIONS.filter((question) => question.category === state.selectedCategory);

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
    if (state.locked || !state.currentQuestion || state.remainingMs <= 0) {
      return;
    }

    state.locked = true;
    stopRecognition();
    stopSpeaking();

    const buttons = [...elements.answerGrid.querySelectorAll(".answer-button")];
    const isCorrect = index === state.currentQuestion.correct;
    state.answered += 1;

    buttons.forEach((button, buttonIndex) => {
      button.disabled = true;
      if (buttonIndex === state.currentQuestion.correct) {
        button.classList.add("correct");
      }
      if (!isCorrect && buttonIndex === index) {
        button.classList.add("wrong");
      }
    });

    if (isCorrect) {
      state.correct += 1;
      state.streak += 1;
      state.bestStreak = Math.max(state.bestStreak, state.streak);

      const responseMs = performance.now() - state.questionStartedAt;
      const speedBonus = Math.max(0, 100 - Math.floor(responseMs / 60));
      const multiplier = Math.min(3, 1 + Math.floor((state.streak - 1) / 3) * 0.5);
      const points = Math.round((100 + speedBonus) * multiplier);
      state.score += points;

      elements.feedback.textContent = `Correct! +${points}`;
      elements.feedback.className = "feedback correct";
      playSuccessSound();

      if (state.hostEnabled) {
        speak(randomItem(["Correct.", "That's right.", "Nice one.", "You got it."]));
      }
    } else {
      state.streak = 0;
      elements.feedback.textContent = `The answer was ${state.currentQuestion.answers[state.currentQuestion.correct]}.`;
      elements.feedback.className = "feedback wrong";
      playWrongSound();

      if (state.hostEnabled) {
        speak(`Not this time. The answer was ${state.currentQuestion.answers[state.currentQuestion.correct]}.`);
      }
    }

    updateHud();
    window.setTimeout(nextQuestion, QUESTION_DELAY_MS);
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

  function endGame() {
    cancelAnimationFrame(state.timerFrame);
    state.timerFrame = null;
    state.remainingMs = 0;
    state.locked = true;
    stopRecognition();
    stopSpeaking();

    const previousHighScore = readNumber("triviaRushHighScore");
    const previousBestStreak = readNumber("triviaRushBestStreak");
    const isNewHighScore = state.score > previousHighScore;

    if (isNewHighScore) {
      localStorage.setItem("triviaRushHighScore", String(state.score));
    }
    if (state.bestStreak > previousBestStreak) {
      localStorage.setItem("triviaRushBestStreak", String(state.bestStreak));
    }

    const accuracy = state.answered === 0 ? 0 : Math.round((state.correct / state.answered) * 100);
    const resultCopy = getResultCopy(state.correct, accuracy);

    elements.finalScore.textContent = state.score.toLocaleString();
    elements.correctTotal.textContent = String(state.correct);
    elements.answeredTotal.textContent = String(state.answered);
    elements.accuracyTotal.textContent = `${accuracy}%`;
    elements.bestStreakTotal.textContent = String(state.bestStreak);
    elements.resultTitle.textContent = resultCopy.title;
    elements.resultMessage.textContent = resultCopy.message;
    elements.newHighScore.hidden = !isNewHighScore;

    updateStartStats();
    showScreen(elements.resultsScreen);
    playFinishSound();

    if (state.hostEnabled) {
      speak(`Time. You scored ${state.score} points with ${state.correct} correct answers.`);
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
