import { useId, type FormEvent, type KeyboardEvent } from "react";
import { MAX_INPUT_CHARS } from "../lib/api";

interface Props {
  value: string;
  onChange: (value: string) => void;
  count: number;
  onCountChange: (count: number) => void;
  onSubmit: () => void;
  loading: boolean;
}

const EXAMPLES = [
  "The French Revolution",
  "Big-O notation: O(1), O(log n), O(n), O(n log n), O(n²) and when each shows up",
  "Mitochondria are the powerhouse of the cell. They produce ATP through cellular respiration, which has three stages: glycolysis (in the cytoplasm), the Krebs cycle, and the electron transport chain.",
];

export function PromptInput({ value, onChange, count, onCountChange, onSubmit, loading }: Props) {
  const inputId = useId();
  const trimmed = value.trim();
  const tooLong = value.length > MAX_INPUT_CHARS;
  const canSubmit = trimmed.length > 0 && !tooLong;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (canSubmit) onSubmit();
  }

  // Ctrl/Cmd + Enter submits from inside the textarea.
  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (canSubmit) onSubmit();
    }
  }

  return (
    <form className="prompt" onSubmit={handleSubmit}>
      <label htmlFor={inputId} className="prompt__label">
        Paste your notes, or type a topic
      </label>
      <textarea
        id={inputId}
        className="prompt__textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="e.g. “Photosynthesis” or a page of lecture notes…"
        rows={6}
        aria-invalid={tooLong}
        aria-describedby={`${inputId}-count`}
      />

      {!trimmed && (
        <div className="prompt__examples" aria-label="Example inputs">
          <span className="muted">Try:</span>
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" className="chip" onClick={() => onChange(ex)}>
              {ex.length > 38 ? `${ex.slice(0, 36)}…` : ex}
            </button>
          ))}
        </div>
      )}

      <div className="prompt__footer">
        <span id={`${inputId}-count`} className={tooLong ? "prompt__count prompt__count--over" : "prompt__count"}>
          {value.length.toLocaleString()} / {MAX_INPUT_CHARS.toLocaleString()}
        </span>

        <label className="prompt__select">
          <span className="muted">Items</span>
          <select value={count} onChange={(e) => onCountChange(Number(e.target.value))}>
            <option value={5}>5</option>
            <option value={8}>8</option>
            <option value={12}>12</option>
          </select>
        </label>

        <button type="submit" className="btn btn--primary" disabled={!canSubmit}>
          {loading ? "Regenerate" : "Generate"}
          <kbd className="btn__kbd" aria-hidden>
            Ctrl ↵
          </kbd>
        </button>
      </div>
    </form>
  );
}
