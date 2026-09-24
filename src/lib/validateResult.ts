import type { Flashcard, QuizQuestion, StudySet } from "../types/result";

/**
 * Turns raw model text into a StudySet, or explains why it can't.
 *
 * Policy:
 *  - Not JSON at all                -> "malformed"
 *  - JSON but not our shape         -> "shape"
 *  - Right shape but nothing usable -> "empty"
 *  - Some items broken              -> keep the good ones, report warnings
 *
 * Salvaging partial output is a product decision: if 7 of 8 cards are fine,
 * showing 7 with a note beats throwing everything away.
 */

export type ValidationResult =
  | { ok: true; data: StudySet; warnings: string[] }
  | { ok: false; kind: "malformed" | "shape" | "empty"; message: string };

const MAX_TEXT = 600; // per field; protects the layout from runaway strings
const MAX_ITEMS = 30;

export function validateResult(raw: unknown): ValidationResult {
  // 1. Parse (raw may already be an object, e.g. when restoring a saved session).
  let data: unknown = raw;
  if (typeof raw === "string") {
    const text = stripCodeFences(raw).trim();
    if (!text) return { ok: false, kind: "empty", message: "The AI returned an empty response." };
    try {
      data = JSON.parse(text);
    } catch {
      return {
        ok: false,
        kind: "malformed",
        message: "The AI's response wasn't valid JSON (it may have been cut off).",
      };
    }
  }

  // 2. Top-level shape.
  if (!isRecord(data)) {
    return { ok: false, kind: "shape", message: "The AI returned JSON, but not an object." };
  }
  const hasCards = Array.isArray(data.flashcards);
  const hasQuiz = Array.isArray(data.quiz);
  if (!hasCards && !hasQuiz) {
    return {
      ok: false,
      kind: "shape",
      message: "The AI's response was missing both the flashcards and the quiz.",
    };
  }

  // 3. Items. Validate each one; collect the good ones.
  const warnings: string[] = [];

  const rawCards = hasCards ? (data.flashcards as unknown[]) : [];
  const flashcards: Flashcard[] = [];
  rawCards.slice(0, MAX_ITEMS).forEach((item, i) => {
    const card = toFlashcard(item, i);
    if (card) flashcards.push(card);
  });
  const droppedCards = Math.min(rawCards.length, MAX_ITEMS) - flashcards.length;
  if (droppedCards > 0) warnings.push(`${plural(droppedCards, "flashcard")} skipped (incomplete).`);

  const rawQuiz = hasQuiz ? (data.quiz as unknown[]) : [];
  const quiz: QuizQuestion[] = [];
  rawQuiz.slice(0, MAX_ITEMS).forEach((item, i) => {
    const q = toQuizQuestion(item, i);
    if (q) quiz.push(q);
  });
  const droppedQuiz = Math.min(rawQuiz.length, MAX_ITEMS) - quiz.length;
  if (droppedQuiz > 0) warnings.push(`${plural(droppedQuiz, "quiz question")} skipped (invalid answer data).`);

  if (!hasCards) warnings.push("No flashcards were returned.");
  if (!hasQuiz) warnings.push("No quiz was returned.");

  // 4. Empty is a failure, not an empty-but-valid result.
  if (flashcards.length === 0 && quiz.length === 0) {
    return {
      ok: false,
      kind: "empty",
      message:
        rawCards.length + rawQuiz.length === 0
          ? "The AI couldn't find anything to study in that input. Try pasting more detailed notes or a clearer topic."
          : "None of the generated items were usable.",
    };
  }

  const title = cleanText(data.title) || "Study set";
  return { ok: true, data: { title: title.slice(0, 80), flashcards, quiz }, warnings };
}

// ---------------------------------------------------------------------------

function toFlashcard(item: unknown, i: number): Flashcard | null {
  if (!isRecord(item)) return null;
  const front = cleanText(item.front);
  const back = cleanText(item.back);
  if (!front || !back) return null;
  return { id: `card-${i}`, front, back };
}

function toQuizQuestion(item: unknown, i: number): QuizQuestion | null {
  if (!isRecord(item)) return null;
  const question = cleanText(item.question);
  if (!question || !Array.isArray(item.options)) return null;

  const options = item.options.map(cleanText);
  // Need at least two real, distinct options for a multiple-choice question.
  if (options.length < 2 || options.length > 6 || options.some((o) => !o)) return null;
  if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) return null;

  // Models sometimes send "2" instead of 2. Accept numeric strings, nothing fuzzier.
  const idx = typeof item.correctIndex === "string" ? Number(item.correctIndex) : item.correctIndex;
  if (typeof idx !== "number" || !Number.isInteger(idx) || idx < 0 || idx >= options.length) return null;

  const explanation = cleanText(item.explanation) || undefined;
  return { id: `q-${i}`, question, options, correctIndex: idx, explanation };
}

/** Some models wrap JSON in ```json fences even when told not to. */
export function stripCodeFences(text: string): string {
  const m = text.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return m ? m[1] : text;
}

function cleanText(v: unknown): string {
  if (typeof v !== "string") return "";
  return v.replace(/\s+/g, " ").trim().slice(0, MAX_TEXT);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}
