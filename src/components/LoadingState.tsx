import { useEffect, useState } from "react";
import { CLIENT_TIMEOUT_MS } from "../lib/api";

interface Props {
  startedAt: number;
  onCancel: () => void;
}

const SLOW_AFTER_S = 8;

/** Shared loading UI. Shows elapsed time so a slow request never looks like a silent hang. */
export function LoadingState({ startedAt, onCancel }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));
  const slow = elapsed >= SLOW_AFTER_S;

  return (
    <section className="state state--loading" aria-live="polite" aria-busy="true">
      <div className="skeleton-card" aria-hidden>
        <div className="skeleton-line skeleton-line--wide" />
        <div className="skeleton-line" />
        <div className="skeleton-line skeleton-line--short" />
      </div>
      <p className="state__title">Building your study set… {elapsed > 0 && <span className="muted">{elapsed}s</span>}</p>
      {slow && (
        <p className="state__body">
          This is taking longer than usual. It will stop automatically after {CLIENT_TIMEOUT_MS / 1000}s.
        </p>
      )}
      <button type="button" className="btn btn--ghost" onClick={onCancel}>
        Cancel
      </button>
    </section>
  );
}
