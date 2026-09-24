import type { AppError, StudySet } from "../types/result";
import { validateResult } from "./validateResult";

/**
 * The only place the frontend talks to the backend. The LLM is never called
 * from the browser, so the API key never reaches it.
 *
 * Never throws for expected failures: every outcome comes back as a value the
 * UI can render. The one exception is cancellation (AbortError), which the
 * caller triggered on purpose and should simply ignore.
 */

export const CLIENT_TIMEOUT_MS = 30_000;
export const MAX_INPUT_CHARS = 8_000;

export type Simulation = "ok" | "malformed" | "wrong-shape" | "empty" | "partial" | "slow" | "error";

export type GenerateOutcome =
  | { ok: true; data: StudySet; warnings: string[] }
  | { ok: false; error: AppError };

interface GenerateOptions {
  count: number;
  signal: AbortSignal;
  simulate?: Simulation | null;
}

export async function generateStudySet(input: string, opts: GenerateOptions): Promise<GenerateOutcome> {
  const url = opts.simulate ? `/api/generate?simulate=${opts.simulate}` : "/api/generate";

  // Our own timeout, combined with the caller's signal (cancel / newer request).
  const timeout = AbortSignal.timeout(CLIENT_TIMEOUT_MS);
  const signal = AbortSignal.any([opts.signal, timeout]);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input, count: opts.count }),
      signal,
    });
  } catch (err) {
    if (opts.signal.aborted) throw err; // caller cancelled: not an error to show
    if (timeout.aborted) return fail("timeout", "The AI took too long to respond. Try again, or shorten your notes.");
    return fail("network", "Couldn't reach the server. Check your connection and that the backend is running.");
  }

  // The body of a non-2xx response should be { error: { code, message } },
  // but a proxy or crash could send HTML, so parse defensively.
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    if (opts.signal.aborted) throw new DOMException("Aborted", "AbortError");
    if (timeout.aborted) return fail("timeout", "The AI took too long to respond. Try again.");
    return fail("server", `The server sent an unreadable response (HTTP ${res.status}).`);
  }

  if (!res.ok) return fromServerError(res.status, body);

  const text = isRecord(body) && typeof body.text === "string" ? body.text : null;
  if (text === null) return fail("server", "The server response was missing the AI output.");

  const result = validateResult(text);
  if (!result.ok) {
    // Malformed / wrong-shape output is often a one-off; retrying usually helps.
    return { ok: false, error: { kind: result.kind, message: result.message, retryable: true } };
  }
  return { ok: true, data: result.data, warnings: result.warnings };
}

function fromServerError(status: number, body: unknown): GenerateOutcome {
  const err = isRecord(body) && isRecord(body.error) ? body.error : {};
  const code = typeof err.code === "string" ? err.code : "";
  const message = typeof err.message === "string" ? err.message : `Request failed (HTTP ${status}).`;

  if (code === "bad_input" || code === "blocked") return fail("bad_input", message, false);
  if (code === "rate_limited" || status === 429) return fail("rate_limited", message);
  if (code === "upstream_timeout" || status === 504) return fail("timeout", message);
  if (code === "missing_key" || code === "upstream_rejected") return fail("server", message, false);
  return fail("server", message);
}

function fail(kind: AppError["kind"], message: string, retryable = true): GenerateOutcome {
  return { ok: false, error: { kind, message, retryable } };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
