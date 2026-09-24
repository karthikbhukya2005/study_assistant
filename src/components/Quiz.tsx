import { useMemo, useState } from "react";
import type { QuizQuestion } from "../types/result";
import { shuffle } from "../lib/shuffle";
import { useKeyboard } from "../hooks/useKeyboard";
import { Progress } from "./FlashcardDeck";

interface Props {
  questions: QuizQuestion[];
  /** Only the visible tab responds to keyboard shortcuts. */
  active: boolean;
}

/**
 * One question at a time with instant feedback. At the end, the user can
 * re-test only the questions they got wrong, as many rounds as they like.
 */
export function Quiz({ questions, active }: Props) {
  const byId = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions]);

  const [round, setRound] = useState<string[]>(() => questions.map((q) => q.id));
  const [roundNo, setRoundNo] = useState(1);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({}); // question id -> chosen option

  const finished = index >= round.length;
  const q = finished ? null : byId.get(round[index]) ?? null;
  const chosen = q ? answers[q.id] : undefined;
  const answered = chosen !== undefined;

  const wrongIds = round.filter((id) => answers[id] !== undefined && answers[id] !== byId.get(id)?.correctIndex);
  const correctCount = round.length - wrongIds.length;

  function choose(option: number) {
    if (!q || answered) return;
    setAnswers((prev) => ({ ...prev, [q.id]: option }));
  }

  function next() {
    if (answered) setIndex((i) => i + 1);
  }

  function startRound(ids: string[], isRetest: boolean) {
    setRound(ids);
    setRoundNo((n) => (isRetest ? n + 1 : 1));
    setAnswers({});
    setIndex(0);
  }

  useKeyboard((e) => {
    if (!q) return;
    const n = Number(e.key);
    if (!answered && Number.isInteger(n) && n >= 1 && n <= q.options.length) choose(n - 1);
    else if (answered && (e.key === "Enter" || e.key === "ArrowRight")) next();
  }, active);

  if (questions.length === 0) {
    return <p className="muted center">No quiz questions in this set. Try the flashcards tab.</p>;
  }

  if (finished || !q) {
    return (
      <div className="summary">
        <p className="summary__score">
          {correctCount} / {round.length}
        </p>
        <p className="summary__label">
          {wrongIds.length === 0 ? "Perfect round!" : roundNo > 1 ? `correct in re-test ${roundNo - 1}` : "correct"}
        </p>

        {wrongIds.length > 0 && (
          <ul className="missed">
            {wrongIds.map((id) => {
              const mq = byId.get(id)!;
              return (
                <li key={id} className="missed__item">
                  <p className="missed__q">{mq.question}</p>
                  <p className="small">
                    <span className="bad">Your answer: {mq.options[answers[id]]}</span>
                    <br />
                    <span className="good">Correct: {mq.options[mq.correctIndex]}</span>
                  </p>
                </li>
              );
            })}
          </ul>
        )}

        <div className="summary__actions">
          {wrongIds.length > 0 && (
            <button type="button" className="btn btn--primary" onClick={() => startRound(shuffle(wrongIds), true)}>
              Re-test {wrongIds.length} wrong
            </button>
          )}
          <button type="button" className="btn" onClick={() => startRound(questions.map((x) => x.id), false)}>
            Restart quiz
          </button>
        </div>
      </div>
    );
  }

  const isCorrect = answered && chosen === q.correctIndex;

  return (
    <div className="quiz">
      <div className="deck__meta">
        <span>
          {roundNo > 1 && <span className="tag">Re-test</span>} Question {index + 1} of {round.length}
        </span>
      </div>
      <Progress value={index + (answered ? 1 : 0)} max={round.length} />

      <fieldset className="quiz__card">
        <legend className="quiz__question">{q.question}</legend>
        <div className="quiz__options">
          {q.options.map((opt, i) => {
            let cls = "option";
            if (answered && i === q.correctIndex) cls += " option--correct";
            else if (answered && i === chosen) cls += " option--wrong";
            return (
              <button key={i} type="button" className={cls} onClick={() => choose(i)} disabled={answered} aria-pressed={chosen === i}>
                <span className="option__key">{i + 1}</span>
                <span>{opt}</span>
              </button>
            );
          })}
        </div>

        {answered && (
          <div className={isCorrect ? "feedback feedback--good" : "feedback feedback--bad"} aria-live="polite">
            <strong>{isCorrect ? "Correct." : "Not quite."}</strong> {q.explanation}
          </div>
        )}
      </fieldset>

      <div className="quiz__next">
        <button type="button" className="btn btn--primary" onClick={next} disabled={!answered}>
          {index + 1 === round.length ? "See results" : "Next question"}
        </button>
      </div>
    </div>
  );
}
