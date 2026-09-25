# Study Deck: AI flashcards & quiz

Paste notes or type a topic. The app asks an LLM (Google Gemini) for a **structured JSON study set**, validates it, and renders it as two interactive tools:

- **Flashcards**: flip, mark each card *Got it* / *Still learning*, then review only the cards you're still learning.
- **Quiz**: multiple choice with instant feedback and explanations, then **re-test only the questions you got wrong**, as many rounds as you need.

It is not a chatbot: the model's text is never shown directly. It is parsed, checked and turned into React state.

> 📹 Demo recording: **https://drive.google.com/file/d/1yq1OTxUKHhyGxkBQfiYGQUipTsB1o0OJ/view?usp=sharing**.

---

## Setup

Requirements: Node 20+ and a free Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey).

```bash
git clone <this repo>
cd flam-frontend-assignment
cp .env.example .env        # then paste your key into GEMINI_API_KEY
npm install && npm start
```

Open **https://study-assistant-ulm1.onrender.com**.

`npm start` runs two processes:

| Process | Port | What it does |
|---|---|---|
| `server` (`server/generate.ts`) | 8787 | Holds the API key, builds the prompt, calls Gemini |
| `web` (Vite) | 5173 | React app; forwards `/api/*` to the server |

**No key yet?** The app still runs. Open *Simulate AI failures* and choose **Sample result (no API call)** to try the full UI.

Other scripts:

```bash
npm test          # validator unit tests (vitest)
npm run build     # type-check + production build
npm run serve     # build, then serve the app and API from one port (8787), for deploying
```

## Usage

1. Paste notes (up to 8,000 characters) or a topic like "The French Revolution". Pick 5, 8 or 12 items.
2. Click **Generate** (or press Ctrl/⌘ + Enter).
3. Switch between the **Flashcards** and **Quiz** tabs. Progress in each tab is kept when you switch.
4. Your last study set is saved in the browser and comes back after a reload. **Clear** removes it.

Keyboard: `Space` flip · `← →` previous/next · `1` / `2` still learning / got it · `1–4` pick an answer · `Enter` next question.

---

## How it works

```
PromptInput ──▶ useStudySet (hook) ──▶ lib/api.ts ──▶ POST /api/generate ──▶ Gemini
                     │                     │
                     │                     └─▶ lib/validateResult.ts  (raw text ─▶ StudySet | error)
                     ▼
               ResultView ──▶ EmptyState | LoadingState | ErrorState | FlashcardDeck + Quiz
```

```
src/
├── components/
│   ├── PromptInput.tsx      free-form text input, item count, examples
│   ├── ResultView.tsx       routes the generation state to the right view
│   ├── FlashcardDeck.tsx    flip cards, rate, review "still learning"
│   ├── Quiz.tsx             multiple choice, results, re-test wrong answers
│   ├── ErrorState.tsx       shared error + retry UI
│   ├── LoadingState.tsx     shared loading UI: elapsed time, slow warning, cancel
│   └── EmptyState.tsx
├── hooks/
│   ├── useStudySet.ts       generation lifecycle + stale-response guard
│   └── useKeyboard.ts       shortcuts that ignore typing in inputs
├── lib/
│   ├── api.ts               the only code that talks to the backend
│   ├── validateResult.ts    parses + shape-checks model output (unit-tested)
│   ├── storage.ts           save / restore last session
│   └── shuffle.ts
├── types/result.ts          the data shape, error kinds, generation state
└── App.tsx
server/generate.ts           Express proxy: key, prompt, Gemini call, failure simulation
```

### The data shape (designed first)

What the model is asked for:

```json
{
  "title": "string",
  "flashcards": [{ "front": "string", "back": "string" }],
  "quiz": [{ "question": "string", "options": ["string"], "correctIndex": 0, "explanation": "string" }]
}
```

The UI never sees this raw object. `validateResult` turns it into the typed `StudySet` in `src/types/result.ts`: strings trimmed and length-capped, stable ids added, broken items removed.

### AI integration

- **Plain REST, no SDK**: `server/generate.ts` calls Gemini's `generateContent` with `fetch`, so nothing is hidden.
- **Two layers asking for the shape**: `responseMimeType: "application/json"` plus a `responseSchema` make Gemini constrain its output, and the prompt spells out the same shape and rules in words.
- **Neither layer is trusted.** Output can still be cut off at the token limit, have empty strings, an out-of-range `correctIndex` or duplicate options. A different model may ignore the schema completely. So the client validates everything again.
- The prompt puts the user's text between markers and tells the model to treat it as material, not instructions. If there's nothing to study, the model is told to return empty arrays, which the app shows as a clear "nothing to study" state.
- **The API key never reaches the browser.** The frontend only calls `/api/generate` on its own origin, and the key is read from `.env` on the server.

### Handling bad AI output

Every failure ends in a visible state. The app never crashes and never hangs silently.

| Failure | Where it's caught | What the user sees |
|---|---|---|
| **Malformed JSON** (for example, truncated) | `validateResult`: `JSON.parse` in try/catch; markdown ```` ```json ```` fences stripped first | "The AI sent back garbled data" + Try again |
| **Wrong shape** (valid JSON, wrong keys or types) | `validateResult`: structural checks, never assumed | "The AI sent back the wrong format" + Try again |
| **Partly broken items** | `validateResult`: each item checked on its own; bad ones dropped | The good items, plus a notice saying how many were skipped |
| **Empty** (no text, `{}`-like, or zero usable items) | `validateResult` treats it as a failure, not a valid empty result | "Nothing to study here" |
| **Slow** | Loading state shows elapsed seconds and a "taking longer than usual" note after 8s. The client aborts at 30s and the server at 25s | "That took too long" + Try again, or **Cancel** at any time |
| **Failed request** (network, 5xx, 429, provider refused) | `api.ts` maps each server error code to a kind; non-JSON error bodies handled | A specific message; **Try again** only when retrying could help (not for invalid input or a missing key) |
| **Stale response** | `useStudySet`: each request gets an id from a `useRef` counter, and a response is applied only if its id is still the latest. The previous `fetch` is also aborted, which lets the server stop the Gemini call too | Only the newest request's result is shown |
| **Corrupted saved session** | `storage.ts` runs saved data back through `validateResult` | Starts fresh instead of crashing |

**Try every failure mode yourself:** in dev, open **Simulate AI failures** under the input and pick *Malformed JSON*, *Wrong shape*, *Empty*, *Partly broken items*, *Slow*, or *Provider error*. The server returns that response instead of calling Gemini (disabled when `NODE_ENV=production`). To see the stale guard, choose *Slow*, click Generate, then switch to *Sample result* and click Generate again. The newer result shows and the slow one never overwrites it.

`src/lib/validateResult.test.ts` covers the validator: truncation, fences, wrong shapes, empty sets, out-of-range, negative and float indexes, duplicate options, numeric-string indexes, partial salvage and text capping.

### Stretch goals included

- Save and reload the last session (validated on load)
- Keyboard navigation, dark mode (follows the system setting), flip animation (turned off for `prefers-reduced-motion`)

---

## AI usage

<!-- Edit this so it matches what you actually did. Being specific and honest counts in your favour. -->
I built this with an AI coding assistant (Claude). It generated most of the first version of the code from my requirements and the assignment's reference structure: the Express proxy, the validator and its tests, the components and the CSS. I then reviewed and ran the code, tested every failure mode with the built-in simulator, and _describe your own changes and decisions here_.

I did not use an AI SDK. The Gemini call is a plain `fetch`, so I can explain every request and response.

## Known limitations

- **Only tested against simulated responses so far** until you run it with your key. _Update this after testing with the real model._
- One-shot generation: no streaming and no "refine this set" follow-up prompts.
- Only the most recent study set is saved (localStorage, this browser only). There's no history.
- Retrying a failed quiz round re-uses the same answer order, so answers can be memorised by position.
- Whitespace in model text is collapsed, so code snippets or line breaks in answers are flattened.
- Rate limits on the Gemini free tier can return 429. The app reports it, but there's no automatic backoff.
- Input is limited to 8,000 characters. There's no file or PDF upload.

**What I'd do next:** stream cards in as they're generated, add a refinement loop ("make these harder", "add 5 more on X"), shuffle options in re-test rounds, and keep a history of saved study sets.

## Time spent

_Fill in honestly, e.g. ~X h total: design & data shape · backend proxy · validation & failure handling · UI · README & recording._
