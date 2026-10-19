export default function BookDetail({ book, onClose, onBorrow }) {
  if (!book) return null;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="book-modal" role="dialog" aria-modal="true" aria-labelledby="detail-title" onMouseDown={(event) => event.stopPropagation()}>
        <button className="modal-close" type="button" onClick={onClose} aria-label="Close book details">×</button>
        <div className="modal-cover" aria-hidden="true">📚</div>
        <p className="book-category">{book.category}</p>
        <h2 id="detail-title">{book.title}</h2>
        <p className="book-author">by {book.author}</p>
        <p className="book-rating">{'★'.repeat(book.rating)}{'☆'.repeat(5 - book.rating)}</p>
        <p>{book.description}</p>
        <dl className="detail-list">
          <div><dt>ISBN</dt><dd>{book.isbn}</dd></div>
          <div><dt>Status</dt><dd>{book.available ? 'Available to borrow' : 'Currently borrowed'}</dd></div>
        </dl>
        <div className="modal-actions">
          <button className="button button-light" onClick={onClose}>Close</button>
          <button className="button button-primary" disabled={!book.available} onClick={() => { onBorrow(book.id); onClose(); }}>
            {book.available ? 'Borrow this book' : 'Not available'}
          </button>
        </div>
      </section>
    </div>
  );
}
