export default function BookCard({ book, onSelect, onBorrow }) {
  return (
    <article className="book-card">
      <button className="book-card-main" type="button" onClick={() => onSelect(book)} aria-label={`View details for ${book.title}`}>
        <span className="book-cover" aria-hidden="true">📖</span>
        <span className="book-category">{book.category}</span>
        <h3>{book.title}</h3>
        <p className="book-author">by {book.author}</p>
        <span className="book-rating" aria-label={`${book.rating} out of 5 stars`}>{'★'.repeat(book.rating)}{'☆'.repeat(5 - book.rating)}</span>
        <span className={`status-pill ${book.available ? 'status-available' : 'status-unavailable'}`}>
          {book.available ? 'Available' : 'Currently borrowed'}
        </span>
      </button>
      <button
        className="button button-primary card-borrow"
        type="button"
        disabled={!book.available}
        onClick={() => onBorrow(book.id)}
      >
        {book.available ? 'Borrow book' : 'Unavailable'}
      </button>
    </article>
  );
}
