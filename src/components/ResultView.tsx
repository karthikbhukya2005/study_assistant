import { useState } from "react";
import type { GenerationState, StudySet } from "../types/result";
import { EmptyState } from "./EmptyState";
import { LoadingState } from "./LoadingState";
import { ErrorState } from "./ErrorState";
import { FlashcardDeck } from "./FlashcardDeck";
import { Quiz } from "./Quiz";

interface Props {
  state: GenerationState;
  onRetry: () => void;
  onCancel: () => void;
  onClear: () => void;
}

/** Routes the generation state to the right view. Nothing else decides what's on screen. */
export function ResultView({ state, onRetry, onCancel, onClear }: Props) {
  switch (state.status) {
    case "idle":
      return <EmptyState />;
    case "loading":
      return <LoadingState startedAt={state.startedAt} onCancel={onCancel} />;
    case "error":
      return <ErrorState error={state.error} onRetry={onRetry} />;
    case "success":
      // key: a new result remounts the study views, resetting their progress.
      return <StudyView key={state.id} data={state.data} warnings={state.warnings} onClear={onClear} />;
  }
}

type Tab = "cards" | "quiz";

function StudyView({ data, warnings, onClear }: { data: StudySet; warnings: string[]; onClear: () => void }) {
  const [tab, setTab] = useState<Tab>(data.flashcards.length > 0 ? "cards" : "quiz");

  return (
    <section className="study">
      <header className="study__header">
        <h2 className="study__title">{data.title}</h2>
        <button type="button" className="link-btn" onClick={onClear}>
          Clear
        </button>
      </header>

      {warnings.length > 0 && (
        <div className="notice" role="status">
          <strong>Heads up:</strong> some of the AI’s output was unusable and was left out. {warnings.join(" ")}
        </div>
      )}

      <div className="tabs" role="tablist" aria-label="Study mode">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "cards"}
          className={tab === "cards" ? "tab is-active" : "tab"}
          onClick={() => setTab("cards")}
        >
          Flashcards <span className="tab__count">{data.flashcards.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "quiz"}
          className={tab === "quiz" ? "tab is-active" : "tab"}
          onClick={() => setTab("quiz")}
        >
          Quiz <span className="tab__count">{data.quiz.length}</span>
        </button>
      </div>

      {/* Both stay mounted so switching tabs doesn't lose progress; only the visible one listens to keys. */}
      <div role="tabpanel" hidden={tab !== "cards"}>
        <FlashcardDeck cards={data.flashcards} active={tab === "cards"} />
      </div>
      <div role="tabpanel" hidden={tab !== "quiz"}>
        <Quiz questions={data.quiz} active={tab === "quiz"} />
      </div>
    </section>
  );
}
