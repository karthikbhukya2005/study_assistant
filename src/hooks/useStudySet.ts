import { useCallback, useEffect, useRef, useState } from "react";
import type { GenerationState } from "../types/result";
import { generateStudySet, type Simulation } from "../lib/api";
import { loadSession, saveSession } from "../lib/storage";

interface Request {
  input: string;
  count: number;
  simulate: Simulation | null;
}

/**
 * Owns the generation lifecycle: idle -> loading -> success | error.
 *
 * Stale-response protection, two layers:
 *  1. requestId: every call gets an id; a response only lands if its id is
 *     still the latest. This is the guarantee.
 *  2. AbortController: starting a new request (or cancelling) aborts the old
 *     fetch, which also lets the server stop calling the model. This saves
 *     quota but isn't relied on for correctness.
 */
export function useStudySet() {
  const [state, setState] = useState<GenerationState>(() => {
    const saved = loadSession();
    return saved ? { status: "success", id: 0, data: saved.data, warnings: [] } : { status: "idle" };
  });

  const requestId = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const lastRequest = useRef<Request | null>(null);

  const run = useCallback(async (req: Request) => {
    const id = ++requestId.current;
    controller.current?.abort();
    const ac = new AbortController();
    controller.current = ac;
    lastRequest.current = req;

    setState({ status: "loading", startedAt: Date.now() });

    try {
      const outcome = await generateStudySet(req.input, {
        count: req.count,
        simulate: req.simulate,
        signal: ac.signal,
      });
      if (id !== requestId.current) return; // a newer request has started since

      if (outcome.ok) {
        setState({ status: "success", id, data: outcome.data, warnings: outcome.warnings });
        saveSession(req.input, outcome.data);
      } else {
        setState({ status: "error", error: outcome.error });
      }
    } catch {
      // Only reached on abort; whoever aborted has already set the next state.
    }
  }, []);

  const generate = useCallback(
    (input: string, count: number, simulate: Simulation | null = null) => run({ input, count, simulate }),
    [run],
  );

  const retry = useCallback(() => {
    if (lastRequest.current) run(lastRequest.current);
  }, [run]);

  const cancel = useCallback(() => {
    requestId.current++; // invalidate whatever is in flight
    controller.current?.abort();
    setState({ status: "idle" });
  }, []);

  const reset = useCallback(() => {
    cancel();
    saveSession(null, null);
  }, [cancel]);

  // Abort any in-flight request if the component unmounts.
  useEffect(() => () => controller.current?.abort(), []);

  return { state, generate, retry, cancel, reset, canRetry: lastRequest.current !== null };
}

/** The input that produced the saved session, used to prefill the textarea. */
export function initialInput(): string {
  return loadSession()?.input ?? "";
}
