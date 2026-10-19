import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { addBooksToCatalogue } from '../../store/librarySlice';
import { createApiBorrowing, deleteApiBorrowing, getApiBooks, getApiBorrowings, getApiError, updateApiBorrowing } from '../../services/crudApi';
import { useAuth } from '../../context/AuthContext';

const BorrowingManagement = () => {
  const { user } = useAuth();
  const dispatch = useDispatch();
  const accountKey = user?.accountId ? `account:${String(user.accountId).trim().toLowerCase()}` : user?.memberId ? `member:${String(user.memberId).trim().toLowerCase()}` : '';
  const [books, setBooks] = useState([]); const [records, setRecords] = useState([]);
  const [bookId, setBookId] = useState(''); const selectedBookIdRef = useRef(''); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false);
  const [error, setError] = useState(''); const [message, setMessage] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [allBooks, allRecords] = await Promise.all([getApiBooks(), getApiBorrowings()]);
      setBooks(allBooks);
      if (allBooks.length) dispatch(addBooksToCatalogue(allBooks));
      setRecords(allRecords);
      const available = allBooks.filter((book) => book.available);
      const selectedStillAvailable = available.some((book) => String(book.id) === String(selectedBookIdRef.current));
      if ((!selectedBookIdRef.current || !selectedStillAvailable) && available.length) {
        const nextId = String(available[0].id);
        selectedBookIdRef.current = nextId;
        setBookId(nextId);
      }
      if (!available.length) { selectedBookIdRef.current = ''; setBookId(''); }
    }
    catch (err) { setError(getApiError(err)); }
    finally { setLoading(false); }
  }, [accountKey, dispatch]);
  useEffect(() => { load(); }, [load]);
  const createRecord = async (event) => {
    event.preventDefault(); if (!accountKey) { setError('Sign in to create a borrowing record.'); return; }
    const book = books.find((item) => String(item.id) === String(bookId)); if (!book) { setError('Select a valid book.'); return; }
    setSaving(true); setError(''); setMessage('');
    try {
      const result = await createApiBorrowing({ bookId: book.id, title: book.title, author: book.author, category: book.category, isbn: book.isbn, accountKey, memberName: user?.name || user?.memberId || 'Library member' });
      if (result?.decision === 'hold_instead' || result?.code === 'BOOK_UNAVAILABLE') {
        setError('This book became unavailable before the loan was created. No borrowing record was added. Refresh and choose another available title, or place a hold from the book page.');
      } else if (result?.alreadyExists) {
        setMessage('This title is already checked out to your account. The existing borrowing record was kept; no duplicate was created.');
      } else {
        setMessage('Borrowing record created using POST.');
      }
      window.dispatchEvent(new Event('library:borrowing-changed'));
      await load();
    }
    catch (err) { setError(getApiError(err)); }
    finally { setSaving(false); }
  };
  const updateStatus = async (record, status) => {
    setError(''); setMessage('');
    try { await updateApiBorrowing(record.id, { status }); setMessage(`Borrowing record ${status === 'returned' ? 'returned' : 'updated'} using PATCH.`); window.dispatchEvent(new Event('library:borrowing-changed')); await load(); }
    catch (err) { setError(getApiError(err)); }
  };
  const renew = async (record) => {
    const due = new Date(`${record.dueDate}T00:00:00`); due.setDate(due.getDate() + 14);
    setError(''); setMessage('');
    try { await updateApiBorrowing(record.id, { dueDate: due.toISOString().slice(0, 10), renewalCount: Number(record.renewalCount || 0) + 1 }); setMessage('Borrowing due date updated using PATCH.'); window.dispatchEvent(new Event('library:borrowing-changed')); await load(); }
    catch (err) { setError(getApiError(err)); }
  };
  const remove = async (record) => {
    if (!window.confirm(`Delete borrowing record for “${record.title}”?`)) return;
    try { await deleteApiBorrowing(record.id, record.title); setRecords((old) => old.filter((r) => r.id !== record.id)); setMessage('Borrowing record deleted using DELETE.'); window.dispatchEvent(new Event('library:borrowing-changed'));  }
    catch (err) { setError(getApiError(err)); }
  };
  const ownRecords = records.filter((record) => record.accountKey === accountKey);
  return <section className="page-panel crud-page"><p className="eyebrow">EXPERIMENT 7 · BORROWING API</p><h2>Manage Borrowing Records</h2><p>Create, renew, return, and delete borrowing records through REST endpoints. Records are scoped to the signed-in account in this view.</p>
    {error && <p className="error-message" role="alert">{error}</p>}{message && <p className="notice" role="status">{message}</p>}
    <form className="crud-form compact-form" onSubmit={createRecord}><h3>Create borrowing record (POST)</h3><label>Book<select value={bookId} onChange={(e) => { selectedBookIdRef.current = e.target.value; setBookId(e.target.value); }} required>{books.filter((book) => book.available).map((book) => <option key={book.id} value={book.id}>{book.title} · {book.author}</option>)}</select></label>{!books.some((book) => book.available) && <small>No available books to borrow.</small>}<button className="primary-button" disabled={saving || loading || !accountKey || !bookId}>{saving ? 'Creating…' : 'Create borrowing record'}</button>{!accountKey && <small>Sign in to create a record.</small>}</form>
    {loading ? <p className="api-status" role="status"><span className="loading-spinner" /> Loading borrowing records from REST API…</p> : ownRecords.length === 0 ? <p className="no-books">No borrowing records for this account yet.</p> : <div className="crud-table-wrap"><table className="crud-table"><thead><tr><th>Book / member</th><th>Borrowed</th><th>Due date</th><th>Status</th><th>Actions</th></tr></thead><tbody>{ownRecords.map((record) => <tr key={record.id}><td><strong>{record.title}</strong><small>{record.memberName}</small></td><td>{record.borrowedDate}</td><td>{record.dueDate}</td><td>{record.status}</td><td><div className="crud-actions">{record.status === 'borrowed' && <><button className="secondary-button" onClick={() => renew(record)}>Renew +14 days</button><button className="secondary-button" onClick={() => updateStatus(record, 'returned')}>Return</button></>}<button className="danger-button" onClick={() => remove(record)}>Delete</button></div></td></tr>)}</tbody></table></div>}
    <p className="crud-footnote">Endpoints: GET /api/borrowings, POST /api/borrowings, PATCH /api/borrowings/:id, PUT /api/borrowings/:id, DELETE /api/borrowings/:id.</p>
  </section>;
};
export default BorrowingManagement;
