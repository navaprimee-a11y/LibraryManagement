export default function ReadingHistory({ history }) {
  if (history.length === 0) {
    return <div className="empty-state"><span>📝</span><h3>Your reading history is empty</h3><p>Returned books will appear here.</p></div>;
  }

  return (
    <section className="content-panel">
      <div className="section-heading"><div><p className="eyebrow">BOOKS YOU HAVE FINISHED</p><h2>Reading history</h2></div><span className="count-chip">{history.length} returned</span></div>
      <div className="history-list">
        {[...history].reverse().map((book, index) => (
          <article className="history-row" key={`${book.id}-${book.returnedDate}-${index}`}>
            <span className="history-check" aria-hidden="true">✓</span>
            <div><h3>{book.title}</h3><p>{book.author} · {book.category}</p><small>Borrowed {book.borrowedDate} · Returned {book.returnedDate}</small></div>
          </article>
        ))}
      </div>
    </section>
  );
}
