import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { addBooksToCatalogue, removeBookFromCatalogue } from '../../store/librarySlice';
import { createApiBook, deleteApiBook, getApiBook, getApiBooks, getApiError, patchApiBook, replaceApiBook } from '../../services/crudApi';

const emptyForm = { title: '', author: '', category: 'Fiction', isbn: '', rating: '0', description: '', publishedYear: '', available: true };
const BookManagement = () => {
  const dispatch = useDispatch();
  const [books, setBooks] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [detailBook, setDetailBook] = useState(null);

  const loadBooks = useCallback(async () => {
    setLoading(true); setError('');
    try { const apiBooks = await getApiBooks(); setBooks(apiBooks); if (apiBooks.length) dispatch(addBooksToCatalogue(apiBooks)); }
    catch (err) { setError(getApiError(err)); }
    finally { setLoading(false); }
  }, [dispatch]);
  useEffect(() => { loadBooks(); }, [loadBooks]);

  const categories = useMemo(() => ['All', ...new Set(books.map((b) => b.category).filter(Boolean))], [books]);
  const visibleBooks = useMemo(() => books.filter((book) => {
    const text = `${book.title} ${book.author} ${book.isbn || ''}`.toLowerCase();
    return text.includes(query.toLowerCase()) && (category === 'All' || book.category === category);
  }), [books, query, category]);

  const change = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((old) => ({ ...old, [name]: type === 'checkbox' ? checked : value }));
  };
  const resetForm = () => { setForm(emptyForm); setEditingId(null); };
  const editBook = (book) => {
    setEditingId(book.id);
    setForm({ title: book.title || '', author: book.author || '', category: book.category || 'Fiction', isbn: book.isbn || '', rating: String(book.rating ?? 0), description: book.description || '', publishedYear: book.publishedYear ? String(book.publishedYear) : '', available: book.available !== false });
    setMessage(''); setError(''); window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const submit = async (event) => {
    event.preventDefault(); setSaving(true); setError(''); setMessage('');
    const payload = { ...form, rating: Number(form.rating), publishedYear: form.publishedYear ? Number(form.publishedYear) : null };
    try {
      if (editingId !== null) {
        const updated = await replaceApiBook(editingId, payload); dispatch(addBooksToCatalogue(updated)); setMessage('Book updated successfully using PUT.');
      } else {
        const created = await createApiBook(payload); dispatch(addBooksToCatalogue(created)); setMessage('Book added successfully using POST.');
      }
      resetForm(); await loadBooks();
    } catch (err) { setError(getApiError(err)); }
    finally { setSaving(false); }
  };
  const viewApiDetail = async (book) => {
    setError(''); setMessage(''); setDetailBook(null);
    try { setDetailBook(await getApiBook(book.id)); }
    catch (err) { setError(getApiError(err)); }
  };
  const toggleAvailability = async (book) => {
    setError(''); setMessage('');
    try {
      const updated = await patchApiBook(book.id, { available: !book.available });
      dispatch(addBooksToCatalogue(updated));
      setBooks((old) => old.map((item) => item.id === book.id ? updated : item));
      setMessage('Availability updated using PATCH.');
    } catch (err) { setError(getApiError(err)); }
  };
  const removeBook = async (book) => {
    if (!window.confirm(`Delete “${book.title}” from the REST API catalogue?`)) return;
    setError(''); setMessage('');
    try { await deleteApiBook(book.id, book.title); dispatch(removeBookFromCatalogue(book.id)); setBooks((old) => old.filter((item) => item.id !== book.id)); setMessage('Book deleted successfully using DELETE.'); if (editingId === book.id) resetForm(); }
    catch (err) { setError(getApiError(err)); }
  };

  return <section className="page-panel crud-page">
    <p className="eyebrow">EXPERIMENT 7 · REST API</p><h2>Manage Books</h2>
    <p>Book records here are read from the local REST API. Add, replace, and delete operations are persisted in <code>server/db.json</code>.</p>
    {error && <p className="error-message" role="alert">{error}</p>}{message && <p className="notice" role="status">{message}</p>}
    <form className="crud-form" onSubmit={submit}>
      <h3>{editingId !== null ? 'Edit book (PUT)' : 'Add a new book (POST)'}</h3>
      <div className="crud-grid">
        <label>Title<input name="title" value={form.title} onChange={change} required maxLength="160" /></label>
        <label>Author<input name="author" value={form.author} onChange={change} required maxLength="120" /></label>
        <label>Category<input name="category" value={form.category} onChange={change} required maxLength="80" /></label>
        <label>ISBN<input name="isbn" value={form.isbn} onChange={change} /></label>
        <label>Rating (0–5)<input name="rating" type="number" min="0" max="5" value={form.rating} onChange={change} /></label>
        <label>Publication year<input name="publishedYear" type="number" min="0" value={form.publishedYear} onChange={change} /></label>
        <label className="crud-checkbox"><input name="available" type="checkbox" checked={form.available} onChange={change} /> Available to borrow</label>
      </div>
      <label>Description<textarea name="description" rows="3" value={form.description} onChange={change} /></label>
      <div className="crud-actions"><button className="primary-button" disabled={saving}>{saving ? 'Saving…' : editingId !== null ? 'Save changes (PUT)' : 'Add book (POST)'}</button>{editingId !== null && <button type="button" className="secondary-button" onClick={resetForm}>Cancel edit</button>}<button type="button" className="secondary-button" onClick={loadBooks} disabled={loading}>Refresh GET</button></div>
    </form>
    {detailBook && <section className="api-book-detail"><button type="button" className="secondary-button" onClick={() => setDetailBook(null)}>Close details</button><h3>{detailBook.title}</h3><p><strong>Author:</strong> {detailBook.author}</p><p><strong>Category:</strong> {detailBook.category}</p><p><strong>ISBN:</strong> {detailBook.isbn || 'Not listed'}</p><p><strong>Description:</strong> {detailBook.description || 'No description'}</p><p><strong>Status:</strong> {detailBook.available ? 'Available' : 'Borrowed'}</p></section>}
    <div className="crud-toolbar"><input aria-label="Search API books" placeholder="Search title, author, ISBN…" value={query} onChange={(e) => setQuery(e.target.value)} /><select aria-label="Filter API books by category" value={category} onChange={(e) => setCategory(e.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</select></div>
    {loading ? <p className="api-status" role="status"><span className="loading-spinner" /> Loading books from REST API…</p> : visibleBooks.length === 0 ? <p className="no-books">No API books match your search.</p> : <div className="crud-table-wrap"><table className="crud-table"><thead><tr><th>Book</th><th>Category</th><th>Status</th><th>Actions</th></tr></thead><tbody>{visibleBooks.map((book) => <tr key={book.id}><td><strong>{book.title}</strong><small>{book.author}</small></td><td>{book.category}</td><td>{book.available ? 'Available' : 'Borrowed'}</td><td><div className="crud-actions"><button type="button" className="secondary-button" onClick={() => viewApiDetail(book)}>View</button><button type="button" className="secondary-button" onClick={() => editBook(book)}>Edit</button><button type="button" className="secondary-button" onClick={() => toggleAvailability(book)}>PATCH status</button><button type="button" className="danger-button" onClick={() => removeBook(book)}>Delete</button></div></td></tr>)}</tbody></table></div>}
    <p className="crud-footnote">HTTP methods demonstrated: GET list/detail, POST create, PUT replace, PATCH partial update (API endpoint), DELETE remove.</p>
  </section>;
};
export default BookManagement;
