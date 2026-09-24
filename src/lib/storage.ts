import type { StudySet } from "../types/result";
import { validateResult } from "./validateResult";

/**
 * Save / reload the last study set (stretch goal).
 *
 * Saved data is treated as untrusted too: it goes back through the same
 * validator on load, so a corrupted or outdated entry can't crash the app.
 */

const KEY = "study-deck:last-session:v1";

interface SavedSession {
  input: string;
  data: StudySet;
}

export function saveSession(input: string | null, data: StudySet | null) {
  try {
    if (input === null || data === null) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify({ input, data }));
  } catch {
    // Storage full or blocked (private mode): saving is a nice-to-have.
  }
}

export function loadSession(): SavedSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const result = validateResult(parsed?.data);
    if (!result.ok) return null;
    return { input: typeof parsed.input === "string" ? parsed.input : "", data: result.data };
  } catch {
    return null;
  }
}
