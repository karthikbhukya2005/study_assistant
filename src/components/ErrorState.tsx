import type { AppError, ErrorKind } from "../types/result";

interface Props {
  error: AppError;
  onRetry?: () => void;
}

const TITLES: Record<ErrorKind, string> = {
  network: "Can’t reach the server",
  timeout: "That took too long",
  server: "Something went wrong on the server",
  rate_limited: "Too many requests",
  bad_input: "Couldn’t use that input",
  malformed: "The AI sent back garbled data",
  shape: "The AI sent back the wrong format",
  empty: "Nothing to study here",
};

/** Shared error UI: same look and retry behaviour for every failure mode. */
export function ErrorState({ error, onRetry }: Props) {
  return (
    <section className="state state--error" role="alert">
      <div className="state__icon" aria-hidden>
        !
      </div>
      <p className="state__title">{TITLES[error.kind]}</p>
      <p className="state__body">{error.message}</p>
      {error.retryable && onRetry && (
        <button type="button" className="btn btn--primary" onClick={onRetry}>
          Try again
        </button>
      )}
      {!error.retryable && <p className="muted small">Edit your input above and generate again.</p>}
    </section>
  );
}
