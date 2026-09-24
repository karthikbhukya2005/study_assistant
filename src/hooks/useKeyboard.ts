import { useEffect, useRef } from "react";

/**
 * Global keyboard shortcuts that stay out of the way while the user is typing.
 * The handler is kept in a ref so callers don't need to memoise it.
 */
export function useKeyboard(handler: (e: KeyboardEvent) => void, enabled = true) {
  const ref = useRef(handler);
  ref.current = handler;

  useEffect(() => {
    if (!enabled) return;
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      const typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      // A focused button already "clicks" on Space/Enter; don't handle it twice.
      if (el?.tagName === "BUTTON" && (e.key === " " || e.key === "Enter")) return;
      ref.current(e);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}
