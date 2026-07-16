# Trivia Rush — GitHub Pages Trivia Game

A responsive, dependency-free browser trivia game inspired by the **fast 60-second voice-trivia format**. It runs entirely in the browser and can be hosted free with GitHub Pages.

## Included

- 60-second game loop
- Three-answer multiple choice questions
- Score, speed bonus and streak multiplier
- Category selector
- Keyboard controls (`1`, `2`, `3`, `P`, `V`)
- Optional spoken host using the browser Speech Synthesis API
- Optional microphone answers using the browser Speech Recognition API
- Responsive mobile/desktop design
- Local high score and best streak using `localStorage`
- 60 original starter questions across six categories
- No framework, package manager, database or API key required

## Run it locally

The simplest option is to open `index.html`.

For the most reliable microphone behaviour, run a local web server:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Publish with GitHub Pages

1. Create a new GitHub repository.
2. Upload all files from this folder to the repository root.
3. Commit the files.
4. Open **Settings → Pages**.
5. Under **Build and deployment**, choose **Deploy from a branch**.
6. Select the `main` branch and `/ (root)`, then save.
7. GitHub will show the public Pages URL after deployment.

## Change the questions

Open `questions.js`. Each question uses this structure:

```js
{
  category: "Science",
  question: "Which planet is the largest in our solar system?",
  answers: ["Earth", "Jupiter", "Saturn"],
  correct: 1
}
```

The `correct` value is zero-based:

- `0` = first answer
- `1` = second answer
- `2` = third answer

Keep exactly three answers for each question.

## Change the game duration

In `app.js`, change:

```js
const GAME_SECONDS = 60;
```

## Change the name

Search for `Trivia Rush` in:

- `index.html`
- `README.md`

## Voice support

Spoken questions use the widely available browser Speech Synthesis API.

Microphone recognition uses `SpeechRecognition` / `webkitSpeechRecognition`. Support varies by browser and device. The game automatically disables the microphone button where it is unavailable, while buttons and keyboard controls continue to work.

Microphone access generally requires HTTPS. GitHub Pages provides HTTPS automatically.

## Important production upgrades

The current version is intentionally static and simple. For a fuller public game, consider:

- Store questions in JSON or a headless CMS
- Add difficulty levels
- Add a daily challenge seeded by date
- Use Firebase or Supabase for online leaderboards
- Add user accounts
- Add multiplayer rooms
- Add automated question validation
- Add an admin question editor
- Add accessible reduced-motion and colour-contrast testing
- Add automated browser tests

## Intellectual property note

This project uses an original name, interface and question set. It reproduces a general timed-trivia mechanic rather than Amazon Alexa branding, audio, artwork or proprietary question content.
