import { useState } from "react";
import { PromptInput } from "./components/PromptInput";
import { ResultView } from "./components/ResultView";
import { initialInput, useStudySet } from "./hooks/useStudySet";
import type { Simulation } from "./lib/api";

const SIMULATIONS: { value: Simulation | ""; label: string }[] = [
  { value: "", label: "Off (real model)" },
  { value: "ok", label: "Sample result (no API call)" },
  { value: "malformed", label: "Malformed JSON" },
  { value: "wrong-shape", label: "Wrong shape" },
  { value: "empty", label: "Empty response" },
  { value: "partial", label: "Partly broken items" },
  { value: "slow", label: "Slow (hits timeout)" },
  { value: "error", label: "Provider error" },
];

export default function App() {
  const [input, setInput] = useState(initialInput);
  const [count, setCount] = useState(8);
  const [simulate, setSimulate] = useState<Simulation | "">("");
  const { state, generate, retry, cancel, reset } = useStudySet();

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">
          <span className="logo" aria-hidden />
          Study Deck
        </h1>
        <p className="app__tagline">Turn notes into flashcards and a quiz.</p>
      </header>

      <main className="app__main">
        <PromptInput
          value={input}
          onChange={setInput}
          count={count}
          onCountChange={setCount}
          loading={state.status === "loading"}
          onSubmit={() => generate(input, count, simulate || null)}
        />

        {/* Dev-only: force each failure mode, for demos and testing. The server ignores this in production. */}
        {import.meta.env.DEV && (
          <details className="devtools">
            <summary>Simulate AI failures {simulate && <span className="tag">{simulate}</span>}</summary>
            <label className="devtools__row">
              <span>Next request returns</span>
              <select value={simulate} onChange={(e) => setSimulate(e.target.value as Simulation | "")}>
                {SIMULATIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </details>
        )}

        <ResultView
          state={state}
          onRetry={retry}
          onCancel={cancel}
          onClear={() => {
            reset();
            setInput("");
          }}
        />
      </main>

      <footer className="app__footer muted small">
        Keys: Space flip · ← → move · 1 / 2 rate card · 1–4 answer · Enter next
      </footer>
    </div>
  );
}
