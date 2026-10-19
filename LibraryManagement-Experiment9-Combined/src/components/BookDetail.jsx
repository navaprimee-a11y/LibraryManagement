import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import BorrowButton from './common/BorrowButton';
import BookStatus from './common/BookStatus';
import Loading from './common/Loading';
import { fetchOpenLibraryWork, findOpenLibraryWorkKey, mapOpenLibraryWork } from '../services/libraryApi';
import { logLibraryActivity } from '../utils/activityLogger';

const getDescription = (value) => (typeof value === 'string' ? value : value?.value) || '';

const BookDetail = ({ books, borrowedBooks = [], holdRequests = [], onBookFetched }) => {
  const { id } = useParams();
  const book = books.find((item) => String(item.id) === String(id));
  const [apiDetails, setApiDetails] = useState(null);
  const [fetchedBook, setFetchedBook] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setApiDetails(null);
    setFetchedBook(null);
    setDetailsError('');

    const loadDetails = async () => {
      setLoadingDetails(true);
      try {
        let workKey = book?.workKey || (/^OL\d+W$/.test(String(id)) ? id : null);
        if (!workKey && book) {
          workKey = await findOpenLibraryWorkKey(book.title, book.author, controller.signal);
          if (!workKey && !controller.signal.aborted) {
            const message = `Open Library details are unavailable for ${book.title}; showing saved catalogue data.`;
            setDetailsError(message);
            logLibraryActivity(message, 'warn');
            return;
          }
        }
        if (!workKey) return;

        const details = await fetchOpenLibraryWork(workKey, controller.signal);
        if (controller.signal.aborted) return;
        setApiDetails(details);
        logLibraryActivity(`Open Library details loaded for ${book?.title || details.title || id}.`);
        const workId = String(workKey).split('/').filter(Boolean).pop();
        const mappedBook = mapOpenLibraryWork(workId, details);
        if (!book) {
          setFetchedBook(mappedBook);
          onBookFetched?.(mappedBook);
        } else {
          onBookFetched?.({
            ...book,
            workKey: `/works/${workId}`,
            source: 'openlibrary',
            coverUrl: mappedBook.coverUrl || book.coverUrl || '',
          });
        }
      } catch (reason) {
        if (controller.signal.aborted || reason?.name === 'AbortError' || reason?.code === 'ERR_CANCELED') return;
        const message = reason?.message || 'Could not fetch extended book details.';
        setDetailsError(message);
        logLibraryActivity(`Open Library details failed for ${book?.title || id}: ${message}`, 'warn');
      } finally {
        if (!controller.signal.aborted) setLoadingDetails(false);
      }
    };

    loadDetails();

    return () => controller.abort();
    // `id` identifies the requested route. A catalogue record changing availability
    // must not repeatedly trigger the same details request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const displayedBook = book || fetchedBook;
  if (!displayedBook && loadingDetails) {
    return <section className="page-panel"><Loading label="Fetching this title from Open Library…" /></section>;
  }
  if (!displayedBook) {
    return <section className="page-panel"><h2>Book not found</h2><p>No book matches ID {id}.</p>{detailsError && <p className="error-message" role="alert">{detailsError}</p>}<Link to="/books">Back to books</Link></section>;
  }

  const subjects = Array.isArray(apiDetails?.subjects) ? apiDetails.subjects : [];
  const description = getDescription(apiDetails?.description) || displayedBook.description || 'No description is available for this title.';
  const category = subjects.length ? subjects.slice(0, 3).join(', ') : displayedBook.category;
  const publishedYear = apiDetails?.first_publish_date || displayedBook.publishedYear || 'Not listed';
  const coverUrl = displayedBook.coverUrl || (Array.isArray(apiDetails?.covers) && apiDetails.covers[0] > 0
    ? `https://covers.openlibrary.org/b/id/${apiDetails.covers[0]}-L.jpg`
    : '');
  const isBorrowed = borrowedBooks.some((item) => String(item.id) === String(displayedBook.id));
  const isHeld = holdRequests.some((item) => String(item.bookId) === String(displayedBook.id) && item.status === 'Waiting');
  const status = isBorrowed ? 'Borrowed by you' : displayedBook.available ? 'Available' : isHeld ? 'On hold (your request)' : 'Unavailable';

  return (
    <section className="detail-layout page-panel">
      <div className="detail-cover" aria-label={`Cover art for ${displayedBook.title}`}>
        {coverUrl ? <img src={coverUrl} alt={`Cover of ${displayedBook.title}`} onError={(event) => { event.currentTarget.style.display = 'none'; }} /> : <>📖<span>{displayedBook.category}</span></>}
      </div>
      <div className="detail-copy">
        <p className="eyebrow">BOOK ID: {displayedBook.id} · {displayedBook.category}</p>
        <h2>{displayedBook.title}</h2>
        <p className="detail-author">by {displayedBook.author || 'Author not listed'}</p>
        {loadingDetails && <p className="api-status" role="status"><span className="loading-spinner" aria-hidden="true" /> Fetching extended book details…</p>}
        {detailsError && <p className="api-fallback-message" role="status">{detailsError} Showing the available catalogue information instead.</p>}
        <p>{description}</p>
        <dl className="book-metadata">
          <div><dt>Category / subjects</dt><dd>{category}</dd></div>
          <div><dt>Published year</dt><dd>{publishedYear}</dd></div>
          <div><dt>Availability</dt><dd><BookStatus status={displayedBook.available ? 'Available' : 'Unavailable'} /></dd></div>
          <div><dt>Borrowing status</dt><dd><BookStatus status={status} /></dd></div>
          <div><dt>ISBN</dt><dd>{displayedBook.isbn || 'Not listed'}</dd></div>
          <div><dt>Data source</dt><dd>{displayedBook.source === 'openlibrary' ? 'Open Library REST API' : 'Saved library catalogue'}</dd></div>
        </dl>
        {isBorrowed ? <p className="notice">This book is already on your borrowed-books list.</p> : isHeld ? <p className="notice">You already have an active hold request for this title.</p> : <BorrowButton book={displayedBook} />}
        <p><Link to="/books">← Back to catalogue</Link></p>
      </div>
    </section>
  );
};

export default BookDetail;
