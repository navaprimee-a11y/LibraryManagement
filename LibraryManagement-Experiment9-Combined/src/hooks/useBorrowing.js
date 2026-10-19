import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  borrowBook,
  placeBookHold,
  renewBorrowedBook,
  returnBorrowedBook,
  syncMemberBorrowingData,
  addBooksToCatalogue,
} from '../store/librarySlice';
import {
  createApiBorrowing,
  getApiBorrowings,
  getApiError,
  updateApiBorrowing,
  getApiBooks,
} from '../services/crudApi';
import { createApiHold, getApiHistory, getApiHolds } from '../services/authApi';
import { logLibraryActivity } from '../utils/activityLogger';

const EMPTY_MEMBER_DATA = Object.freeze({ borrowedBooks: [], readingHistory: [], holdRequests: [] });

const getAccountKey = (user) => {
  if (user?.accountId) return `account:${String(user.accountId).trim().toLowerCase()}`;
  if (user?.memberId) return `member:${String(user.memberId).trim().toLowerCase()}`;
  return null;
};

const asBookRecord = (record, accountKey, returned = false) => ({
  ...record,
  id: record.bookId,
  borrowingRecordId: record.id,
  borrowedByAccount: accountKey,
  available: returned ? true : false,
});

const useBorrowing = (user) => {
  const dispatch = useDispatch();
  const { books, accountRecords } = useSelector((state) => state.library);
  const accountKey = useMemo(() => getAccountKey(user), [user?.accountId, user?.memberId]);
  const [apiLoading, setApiLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const memberData = accountKey ? (accountRecords[accountKey] || EMPTY_MEMBER_DATA) : EMPTY_MEMBER_DATA;
  const { borrowedBooks, readingHistory, holdRequests } = memberData;

  // The server is authoritative for loans, returns, holds, and reading history.
  useEffect(() => {
    if (!accountKey) {
      setApiLoading(false);
      setApiError('');
      return undefined;
    }
    let active = true;
    setApiLoading(true);
    setApiError('');
    const refreshFromServer = () => {
      setApiLoading(true);
      setApiError('');
      Promise.all([getApiBorrowings(), getApiHistory(), getApiHolds(), getApiBooks()])
        .then(([borrowings, history, holds, serverBooks]) => {
          if (!active) return;
          // The local REST API is the source of truth for global availability.
          // Refresh it so stale Open Library/browser cache state cannot cause a
          // misleading Borrow/Hold choice.
          if (Array.isArray(serverBooks) && serverBooks.length) dispatch(addBooksToCatalogue(serverBooks));
          const currentLoans = borrowings
            .filter((record) => record.status === 'borrowed')
            .map((record) => asBookRecord(record, accountKey));
          const returnedHistory = history.map((record) => asBookRecord(record, accountKey, true));
          const currentHolds = holds.filter((hold) => hold.status === 'Waiting').map((hold) => ({ ...hold, bookId: hold.bookId }));
          dispatch(syncMemberBorrowingData({ accountKey, borrowedBooks: currentLoans, readingHistory: returnedHistory, holdRequests: currentHolds }));
        })
        .catch((error) => { if (active) setApiError(getApiError(error)); })
        .finally(() => { if (active) setApiLoading(false); });
    };
    refreshFromServer();
    window.addEventListener('library:borrowing-changed', refreshFromServer);
    return () => {
      active = false;
      window.removeEventListener('library:borrowing-changed', refreshFromServer);
    };
  }, [accountKey, dispatch]);

  const confirmRequest = useCallback(async (bookId, requestType = 'borrow') => {
    if (!accountKey) return { ok: false, message: 'Please sign in before borrowing or placing a hold.' };
    const book = books.find((item) => String(item.id) === String(bookId));
    if (!book) return { ok: false, message: 'Book not found. Return to the catalogue and try again.' };
    if (borrowedBooks.some((item) => String(item.id) === String(book.id))) {
      return { ok: false, message: 'You already have this book checked out.' };
    }

    setApiError('');
    if (requestType === 'hold') {
      if (book.available) return { ok: false, message: 'This book is available now. Choose Borrow instead of Hold.' };
      const alreadyHeld = holdRequests.some((item) => String(item.bookId) === String(book.id) && item.status === 'Waiting');
      if (alreadyHeld) {
        logLibraryActivity(`Hold request already exists for ${book.title}; no duplicate was sent.`);
        return { ok: false, message: 'You already have an active hold request for this book.' };
      }
      try {
        const hold = await createApiHold({
          bookId: book.id, title: book.title, author: book.author, category: book.category, isbn: book.isbn,
        });
        if (hold?.decision === 'already_borrowed' || hold?.code === 'ALREADY_CHECKED_OUT') {
          window.dispatchEvent(new Event('library:borrowing-changed'));
          logLibraryActivity(`Hold not placed for ${book.title}: already checked out to this account.`, 'warn');
          return { ok: false, code: 'ALREADY_CHECKED_OUT', message: 'You already have this title checked out. Open Borrowed Books to manage it.' };
        }
        if (hold?.decision === 'borrow_instead' || hold?.code === 'BOOK_AVAILABLE') {
          const currentBook = hold.book || { ...book, available: true, source: 'local-api' };
          dispatch(addBooksToCatalogue({ ...currentBook, source: 'local-api', available: true }));
          window.dispatchEvent(new Event('library:borrowing-changed'));
          logLibraryActivity(`Hold not placed for ${book.title}: the REST API says it is available; borrow it instead.`, 'warn');
          return { ok: false, code: 'BOOK_AVAILABLE', message: 'The API reports that this book is available now. No hold was created. Choose “Edit request” below, then confirm a Borrow request.' };
        }
        dispatch(placeBookHold({ accountKey, request: { ...hold, requestedDate: hold.requestedDate || new Date().toISOString().slice(0, 10), status: 'Waiting' } }));
        window.dispatchEvent(new Event('library:borrowing-changed'));
        const holdMessage = hold?.alreadyExists
          ? `You already have an active hold for “${book.title}”. No duplicate request was created.`
          : `Your hold request for “${book.title}” has been recorded.`;
        return { ok: true, message: holdMessage };
      } catch (error) {
        return { ok: false, message: getApiError(error) };
      }
    }

    if (!book.available) {
      logLibraryActivity(`Borrow request skipped for ${book.title}: marked unavailable; use Hold instead.`, 'warn');
      return { ok: false, message: 'This book is currently unavailable. You can place a hold instead.' };
    }
    try {
      const apiRecord = await createApiBorrowing({
        bookId: book.id,
        title: book.title,
        author: book.author,
        category: book.category,
        isbn: book.isbn,
        rating: book.rating,
        description: book.description,
        publishedYear: book.publishedYear,
        coverUrl: book.coverUrl,
        source: book.source,
      });
      if (apiRecord?.decision === 'hold_instead' || apiRecord?.code === 'BOOK_UNAVAILABLE') {
        const currentBook = apiRecord.book || { ...book, available: false, source: 'local-api' };
        dispatch(addBooksToCatalogue({ ...currentBook, source: 'local-api', available: false }));
        window.dispatchEvent(new Event('library:borrowing-changed'));
        logLibraryActivity(`Checkout stopped for ${book.title}: the REST API reported that the title is unavailable.`, 'warn');
        return { ok: false, code: 'BOOK_UNAVAILABLE', message: 'The REST API reports that this book is unavailable. No loan was created. Choose “Edit request” below, then select Hold.' };
      }
      const record = { ...book, ...apiRecord, id: book.id, borrowingRecordId: apiRecord.id, borrowedByAccount: accountKey };
      dispatch(borrowBook({ accountKey, bookId: book.id, record }));
      window.dispatchEvent(new Event('library:borrowing-changed'));
      const borrowMessage = apiRecord?.alreadyExists
        ? `“${book.title}” is already checked out to your account. No duplicate loan was created.`
        : `“${book.title}” has been checked out. It is due on ${apiRecord.dueDate}.`;
      return { ok: true, message: borrowMessage };
    } catch (error) {
      setApiError(getApiError(error));
      return { ok: false, message: getApiError(error) };
    }
  }, [accountKey, books, borrowedBooks, holdRequests, dispatch]);

  const returnBook = useCallback(async (bookId) => {
    if (!accountKey) return { ok: false, message: 'Please sign in before returning a book.' };
    const record = borrowedBooks.find((item) => String(item.id) === String(bookId));
    if (!record) return { ok: false, message: 'This book is not part of your account.' };
    setApiError('');
    try {
      let apiId = record.borrowingRecordId;
      if (!apiId) {
        const serverLoans = await getApiBorrowings({ status: 'borrowed' });
        const existing = serverLoans.find((item) => String(item.bookId) === String(bookId));
        if (existing) apiId = existing.id;
      }
      if (!apiId) throw new Error('The server borrowing record was not found. Refresh your borrowed books before returning this title.');
      const returned = await updateApiBorrowing(apiId, { status: 'returned' });
      const returnedDate = returned.returnedDate || new Date().toISOString().slice(0, 10);
      dispatch(returnBorrowedBook({ accountKey, bookId: record.id, returnedDate, title: record.title }));
      window.dispatchEvent(new Event('library:borrowing-changed'));
      return { ok: true, message: `“${record.title}” was returned and added to your reading history.` };
    } catch (error) {
      const message = getApiError(error);
      setApiError(message);
      return { ok: false, message };
    }
  }, [accountKey, borrowedBooks, dispatch]);

  const renewBook = useCallback(async (bookId, additionalDays = 14, requestDetails = {}) => {
    if (!accountKey) return { ok: false, message: 'Please sign in before renewing a book.' };
    const record = borrowedBooks.find((item) => String(item.id) === String(bookId));
    if (!record) return { ok: false, message: 'This book is not part of your account.' };
    if (![7, 14].includes(Number(additionalDays))) return { ok: false, message: 'Choose a valid renewal period.' };
    setApiError('');
    try {
      let apiId = record.borrowingRecordId;
      if (!apiId) {
        const serverLoans = await getApiBorrowings({ status: 'borrowed' });
        const existing = serverLoans.find((item) => String(item.bookId) === String(bookId));
        if (existing) apiId = existing.id;
      }
      if (!apiId) throw new Error('The server borrowing record was not found. Refresh your borrowed books before renewing this title.');
      const currentDue = new Date(`${record.dueDate || new Date().toISOString().slice(0, 10)}T00:00:00`);
      currentDue.setDate(currentDue.getDate() + Number(additionalDays));
      const dueDate = currentDue.toISOString().slice(0, 10);
      const serverRecord = await updateApiBorrowing(apiId, { dueDate, renewalCount: Number(record.renewalCount || 0) + 1 });
      dispatch(renewBorrowedBook({ accountKey, bookId: record.id, dueDate: serverRecord.dueDate || dueDate, title: record.title, requestDetails: { ...requestDetails, requestedAt: new Date().toISOString() } }));
      window.dispatchEvent(new Event('library:borrowing-changed'));
      return { ok: true, message: `Renewal approved for “${record.title}”. The new due date is ${serverRecord.dueDate || dueDate}.` };
    } catch (error) {
      const message = getApiError(error);
      setApiError(message);
      return { ok: false, message };
    }
  }, [accountKey, borrowedBooks, dispatch]);

  return { borrowedBooks, readingHistory, holdRequests, confirmRequest, returnBook, renewBook, apiLoading, apiError };
};

export default useBorrowing;
