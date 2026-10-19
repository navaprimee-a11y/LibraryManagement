export default function BorrowedBooks({ borrowedBooks, onReturn, onRenew }) {
  if (borrowedBooks.length === 0) {
    return <div className="empty-state"><span>📚</span><h3>No borrowed books yet</h3><p>Browse the collection and borrow your first book.</p></div>;
  }

  return (
    <section className="content-panel">
      <div className="section-heading"><div><p className="eyebrow">YOUR CURRENT LOANS</p><h2>My borrowed books</h2></div><span className="count-chip">{borrowedBooks.length} book(s)</span></div>
      <div className="loan-list">
        {borrowedBooks.map((book) => {
          const overdue = new Date(`${book.dueDate}T23:59:59`) < new Date();
          return (
            <article className="loan-row" key={book.id}>
              <div className="loan-icon" aria-hidden="true">📘</div>
              <div className="loan-info"><h3>{book.title}</h3><p>{book.author}</p><p>Borrowed: {book.borrowedDate}</p><p className={overdue ? 'overdue-text' : 'due-text'}>Due: {book.dueDate}{overdue ? ' · Overdue' : ''}</p></div>
              <div className="loan-actions"><button className="button button-light" onClick={() => onRenew(book.id)}>Renew 14 days</button><button className="button button-primary" onClick={() => onReturn(book.id)}>Return</button></div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
