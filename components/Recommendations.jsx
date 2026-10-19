export default function Recommendations({ recommendations, onSelect, onBorrow }) {
  return (
    <section className="recommendation-section">
      <div className="section-heading"><div><p className="eyebrow">A LITTLE READING INSPIRATION</p><h2>Recommended for you</h2></div></div>
      {recommendations.length === 0 ? <p className="muted-copy">No recommendations available right now.</p> : (
        <div className="recommendation-grid">
          {recommendations.map((book) => (
            <article className="recommendation-card" key={book.id}>
              <div className="recommendation-cover" aria-hidden="true">📖</div>
              <div className="recommendation-info"><span className="book-category">{book.category}</span><h3>{book.title}</h3><p>{book.author}</p><button type="button" className="text-button" onClick={() => onSelect(book)}>Details</button><button type="button" className="text-button" disabled={!book.available} onClick={() => onBorrow(book.id)}>{book.available ? 'Borrow' : 'Unavailable'}</button></div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
