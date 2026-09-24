import { describe, expect, it } from "vitest";
import { validateResult } from "./validateResult";

const good = {
  title: "Cells",
  flashcards: [{ front: "What makes ATP?", back: "Mitochondria" }],
  quiz: [{ question: "Powerhouse of the cell?", options: ["Nucleus", "Mitochondria"], correctIndex: 1, explanation: "ATP." }],
};

describe("validateResult", () => {
  it("accepts a well-formed result and adds ids", () => {
    const r = validateResult(JSON.stringify(good));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.flashcards[0]).toEqual({ id: "card-0", front: "What makes ATP?", back: "Mitochondria" });
    expect(r.data.quiz[0].correctIndex).toBe(1);
    expect(r.warnings).toEqual([]);
  });

  it("strips markdown code fences", () => {
    const r = validateResult("```json\n" + JSON.stringify(good) + "\n```");
    expect(r.ok).toBe(true);
  });

  it("reports malformed JSON (e.g. truncated output)", () => {
    const r = validateResult(JSON.stringify(good).slice(0, 40));
    expect(r).toMatchObject({ ok: false, kind: "malformed" });
  });

  it("treats empty and whitespace-only text as empty", () => {
    expect(validateResult("")).toMatchObject({ ok: false, kind: "empty" });
    expect(validateResult("   \n ")).toMatchObject({ ok: false, kind: "empty" });
  });

  it("rejects valid JSON of the wrong shape", () => {
    expect(validateResult('{"cards":[{"q":"a","a":"b"}]}')).toMatchObject({ ok: false, kind: "shape" });
    expect(validateResult("[1,2,3]")).toMatchObject({ ok: false, kind: "shape" });
    expect(validateResult('"just a string"')).toMatchObject({ ok: false, kind: "shape" });
    expect(validateResult("null")).toMatchObject({ ok: false, kind: "shape" });
  });

  it("treats a correctly-shaped but empty set as empty, not success", () => {
    expect(validateResult('{"title":"","flashcards":[],"quiz":[]}')).toMatchObject({ ok: false, kind: "empty" });
  });

  it("drops broken items but keeps good ones, with warnings", () => {
    const r = validateResult(
      JSON.stringify({
        ...good,
        flashcards: [...good.flashcards, { front: "", back: "x" }, { front: 42, back: "y" }, null],
        quiz: [
          ...good.quiz,
          { question: "Out of range", options: ["a", "b"], correctIndex: 5 },
          { question: "Negative", options: ["a", "b"], correctIndex: -1 },
          { question: "Float", options: ["a", "b"], correctIndex: 0.5 },
          { question: "Dupes", options: ["a", "A"], correctIndex: 0 },
          { question: "One option", options: ["a"], correctIndex: 0 },
          { question: "No options" },
        ],
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.flashcards).toHaveLength(1);
    expect(r.data.quiz).toHaveLength(1);
    expect(r.warnings.join(" ")).toMatch(/3 flashcards skipped/);
    expect(r.warnings.join(" ")).toMatch(/6 quiz questions skipped/);
  });

  it("fails as empty when every item is broken", () => {
    const r = validateResult(JSON.stringify({ title: "x", flashcards: [{ front: "" }], quiz: [{}] }));
    expect(r).toMatchObject({ ok: false, kind: "empty" });
  });

  it("accepts a numeric-string correctIndex but nothing fuzzier", () => {
    const base = { question: "Q", options: ["a", "b"] };
    const ok = validateResult(JSON.stringify({ quiz: [{ ...base, correctIndex: "1" }] }));
    expect(ok.ok && ok.data.quiz[0].correctIndex).toBe(1);
    const bad = validateResult(JSON.stringify({ quiz: [{ ...base, correctIndex: "b" }] }));
    expect(bad.ok).toBe(false);
  });

  it("works with only one of the two sections, and warns", () => {
    const r = validateResult(JSON.stringify({ title: "t", flashcards: good.flashcards }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.quiz).toEqual([]);
    expect(r.warnings).toContain("No quiz was returned.");
  });

  it("trims whitespace, defaults the title and caps long text", () => {
    const r = validateResult(
      JSON.stringify({ flashcards: [{ front: "  a \n b ", back: "x".repeat(2000) }], quiz: [] }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.title).toBe("Study set");
    expect(r.data.flashcards[0].front).toBe("a b");
    expect(r.data.flashcards[0].back.length).toBe(600);
  });

  it("accepts an already-parsed object (restored sessions)", () => {
    expect(validateResult(good).ok).toBe(true);
  });
});
