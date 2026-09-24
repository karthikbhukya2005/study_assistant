/** Shown before anything has been generated. */
export function EmptyState() {
  return (
    <section className="state state--empty">
      <div className="empty-stack" aria-hidden>
        <span />
        <span />
        <span />
      </div>
      <p className="state__title">No study set yet</p>
      <p className="state__body">
        Paste notes or type a topic above. You’ll get flashcards to flip through and a quiz that lets you re-test the
        questions you miss.
      </p>
    </section>
  );
}
