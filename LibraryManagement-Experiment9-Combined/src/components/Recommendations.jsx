import React from 'react';

const Recommendations = ({ recommendations = [], onSelect, loading = false, error = '', source = 'Library catalogue' }) => {
  return (
    <section className="recommendations" aria-label="Book recommendations">
      <div className="recommendations-heading">
        <h2>💡 Recommended For You</h2>
        <span className="api-source-label">Source: {source}</span>
      </div>
      {loading && <p className="api-status" role="status"><span className="loading-spinner" aria-hidden="true" /> Fetching recommendations from the REST API…</p>}
      {error && <p className="api-fallback-message" role="status">{error}</p>}
      {!recommendations.length ? <p className="no-books">No recommendations available right now.</p> : (
        <div className="recommendations-list">
          {recommendations.map((book) => (
            <button type="button" className="recommendation-item" key={book.id} onClick={() => onSelect(book)}>
              {book.coverUrl && <img className="recommendation-cover" src={book.coverUrl} alt={`Cover of ${book.title}`} loading="lazy" onError={(event) => { event.currentTarget.style.display = 'none'; }} />}
              <h4>{book.title}</h4>
              <p>{book.author}</p>
              <p>{'⭐'.repeat(Math.max(0, Math.min(5, Number(book.rating) || 0))) || 'No rating'}</p>
            </button>
          ))}
        </div>
      )}
    </section>
  );
};

export default Recommendations;
