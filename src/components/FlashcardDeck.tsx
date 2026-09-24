import { useMemo, useState } from "react";
import type { Flashcard } from "../types/result";
import { shuffle } from "../lib/shuffle";
import { useKeyboard } from "../hooks/useKeyboard";

interface Props {
  cards: Flashcard[];
  /** Only the visible tab responds to keyboard shortcuts. */
  active: boolean;
}

type Rating = "known" | "learning";

/**
 * Flip through cards, mark each "Got it" / "Still learning", then review only
 * the ones still being learned. All state is local; the parent remounts this
 * component (via `key`) when a new study set arrives.
 */
export function FlashcardDeck({ cards, active }: Props) {
  const byId = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);

  const [order, setOrder] = useState<string[]>(() => cards.map((c) => c.id));
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [ratings, setRatings] = useState<Record<string, Rating>>({});
  const [reviewing, setReviewing] = useState(false);

  const finished = index >= order.length;
  const card = finished ? null : byId.get(order[index]) ?? null;
  const learningIds = order.filter((id) => ratings[id] === "learning");
  const knownCount = order.filter((id) => ratings[id] === "known").length;

  function go(to: number) {
    setIndex(Math.max(0, Math.min(order.length, to)));
    setFlipped(false);
  }

  function rate(r: Rating) {
    if (!card) return;
    setRatings((prev) => ({ ...prev, [card.id]: r }));
    go(index + 1);
  }

  function startRound(ids: string[], isReview: boolean) {
    setOrder(ids);
    setRatings({});
    setReviewing(isReview);
    setIndex(0);
    setFlipped(false);
  }

  useKeyboard((e) => {
    if (finished) return;
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      setFlipped((f) => !f);
    } else if (e.key === "ArrowRight") go(index + 1);
    else if (e.key === "ArrowLeft") go(index - 1);
    else if (e.key === "1" && flipped) rate("learning");
    else if (e.key === "2" && flipped) rate("known");
  }, active);

  if (cards.length === 0) {
    return <p className="muted center">No flashcards in this set. Try the quiz tab.</p>;
  }

  if (finished || !card) {
    return (
      <div className="summary">
        <p className="summary__score">
          {knownCount} / {order.length}
        </p>
        <p className="summary__label">{reviewing ? "known after review" : "cards you knew"}</p>
        <div className="summary__actions">
          {learningIds.length > 0 && (
            <button type="button" className="btn btn--primary" onClick={() => startRound(learningIds, true)}>
              Review {learningIds.length} still learning
            </button>
          )}
          <button type="button" className="btn" onClick={() => startRound(cards.map((c) => c.id), false)}>
            Start over
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => startRound(shuffle(cards.map((c) => c.id)), false)}>
            Shuffle all
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="deck">
      <div className="deck__meta">
        <span>
          {reviewing && <span className="tag">Review</span>} Card {index + 1} of {order.length}
        </span>
        <button type="button" className="link-btn" onClick={() => startRound(shuffle(order), reviewing)}>
          Shuffle
        </button>
      </div>
      <Progress value={index} max={order.length} />

      <button
        type="button"
        className={flipped ? "flashcard is-flipped" : "flashcard"}
        onClick={() => setFlipped((f) => !f)}
        aria-label={flipped ? `Answer: ${card.back}. Click to show question.` : `Question: ${card.front}. Click to reveal answer.`}
      >
        <span className="flashcard__inner">
          <span className="flashcard__face flashcard__face--front">
            <span className="flashcard__kicker">Question</span>
            <span className="flashcard__text">{card.front}</span>
            <span className="flashcard__hint">Tap or press Space to flip</span>
          </span>
          <span className="flashcard__face flashcard__face--back">
            <span className="flashcard__kicker">Answer</span>
            <span className="flashcard__text">{card.back}</span>
          </span>
        </span>
      </button>

      <div className="deck__controls">
        <button type="button" className="btn btn--icon" onClick={() => go(index - 1)} disabled={index === 0} aria-label="Previous card">
          ←
        </button>
        {flipped ? (
          <div className="deck__rate">
            <button type="button" className="btn btn--warn" onClick={() => rate("learning")}>
              Still learning <kbd>1</kbd>
            </button>
            <button type="button" className="btn btn--ok" onClick={() => rate("known")}>
              Got it <kbd>2</kbd>
            </button>
          </div>
        ) : (
          <button type="button" className="btn" onClick={() => setFlipped(true)}>
            Show answer
          </button>
        )}
        <button type="button" className="btn btn--icon" onClick={() => go(index + 1)} aria-label="Skip card">
          →
        </button>
      </div>
    </div>
  );
}

export function Progress({ value, max }: { value: number; max: number }) {
  const pct = max === 0 ? 0 : Math.round((value / max) * 100);
  return (
    <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <div className="progress__bar" style={{ width: `${pct}%` }} />
    </div>
  );
}
