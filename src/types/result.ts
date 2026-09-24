/**
 * The structured shape designed up front (step 1 of the guide).
 *
 * What the model is asked to return (see server/generate.ts):
 *   { title, flashcards: [{ front, back }], quiz: [{ question, options, correctIndex, explanation }] }
 *
 * What the UI receives is the *validated* version below: trimmed strings,
 * stable ids added, broken items removed. Components never see raw model output.
 */

export interface Flashcard {
  id: string;
  front: string;
  back: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
}

export interface StudySet {
  title: string;
  flashcards: Flashcard[];
  quiz: QuizQuestion[];
}

/** Every way a generation can fail. Each one maps to a visible error state. */
export type ErrorKind =
  | "network" // browser couldn't reach our server
  | "timeout" // took longer than the client allows
  | "server" // our server or the AI provider returned an error
  | "rate_limited"
  | "bad_input"
  | "malformed" // the model's text isn't parseable JSON
  | "shape" // valid JSON, but not the shape we asked for
  | "empty"; // nothing usable came back

export interface AppError {
  kind: ErrorKind;
  message: string;
  /** Whether trying the same request again might help. */
  retryable: boolean;
}

export type GenerationState =
  | { status: "idle" }
  | { status: "loading"; startedAt: number }
  /** `id` changes on every new result, so views can reset their local state (used as a React key). */
  | { status: "success"; id: number; data: StudySet; warnings: string[] }
  | { status: "error"; error: AppError };
