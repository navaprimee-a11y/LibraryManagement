import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import RenewalRequest from './forms/RenewalRequest';
import BookStatus from './common/BookStatus';

const BorrowedBooks = ({ borrowedBooks, onReturn, onRenew }) => {
  const [renewingId, setRenewingId] = useState(null);
  const [actionMessage, setActionMessage] = useState('');
  const { user } = useAuth();
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [actionIsError, setActionIsError] = useState(false);

  if (borrowedBooks.length === 0) {
    return <section className="page-panel"><h2>📖 My Borrowed Books</h2>{actionMessage && <p className={actionIsError ? 'error-message' : 'notice'} role={actionIsError ? 'alert' : 'status'}>{actionMessage}</p>}<p className="no-books">No borrowed books yet.</p><p><Link to="/books">Browse books to start a loan →</Link></p></section>;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const handleRenew = async (bookId, days, details) => {
    setActionLoadingId(bookId);
    setActionMessage('');
    setActionIsError(false);
    try {
      const result = await onRenew(bookId, days, details);
      if (result?.ok) { setActionMessage(result.message); setRenewingId(null); }
      else { setActionMessage(result?.message || 'Renewal failed. Please try again.'); setActionIsError(true); }
      return result;
    } finally { setActionLoadingId(null); }
  };
  const handleReturn = async (book) => {
    setActionLoadingId(book.id);
    setActionMessage('');
    setActionIsError(false);
    try {
      const result = await onReturn(book.id);
      setActionMessage(result?.message || (result?.ok ? `“${book.title}” was returned.` : 'Return failed. Please try again.'));
      setActionIsError(!result?.ok);
      setRenewingId(null);
    } finally { setActionLoadingId(null); }
  };

  return (
    <div className="borrowed-books">
      <h2>📖 My Borrowed Books</h2>
      {actionMessage && <p className={actionIsError ? 'error-message' : 'notice'} role={actionIsError ? 'alert' : 'status'}>{actionMessage}</p>}
      {borrowedBooks.map((book) => {
        const dueDate = book.dueDate ? new Date(`${book.dueDate}T00:00:00`) : null;
        const isOverdue = dueDate && dueDate < today;
        return (
          <article key={book.id} className="borrowed-book-card">
            <div className="borrowed-book-item">
              <div className="borrowed-book-details">
                <h4>{book.title}</h4>
                <p>{book.author}</p>
                <div className="borrowed-date-row"><span>Borrowed: {book.borrowedDate || 'Date not recorded'}</span><span>Due: {book.dueDate || 'Not set'}</span></div>
                <BookStatus status={isOverdue ? 'Overdue' : 'Checked out'} />
                {isOverdue && <span className="overdue">⚠️ Overdue. Please return or renew this book.</span>}
              </div>
              <div className="borrowed-actions">
                <button onClick={() => { setActionMessage(''); setRenewingId(renewingId === book.id ? null : book.id); }} className="btn-renew" aria-expanded={renewingId === book.id} disabled={actionLoadingId === book.id}>{actionLoadingId === book.id ? 'Saving…' : 'Request renewal'}</button>
                <button onClick={() => handleReturn(book)} className="btn-return" disabled={actionLoadingId === book.id}>{actionLoadingId === book.id ? 'Saving…' : 'Return book'}</button>
              </div>
            </div>
            {renewingId === book.id && <RenewalRequest book={book} user={user} onCancel={() => setRenewingId(null)} onSubmit={handleRenew} />}
          </article>
        );
      })}
    </div>
  );
};

export default BorrowedBooks;
