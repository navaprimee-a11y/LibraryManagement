import BookCard from './BookCard.jsx';

export default function BookList({ books, onSelect, onBorrow }) {
  if (books.length === 0) {
    return <div className="empty-state"><span>🔎</span><h3>No books found</h3><p>Try another search or reset the filters.</p></div>;
  }

  return (
    <div className="book-grid">
      {books.map((book) => <BookCard key={book.id} book={book} onSelect={onSelect} onBorrow={onBorrow} />)}
    </div>
  );
}
