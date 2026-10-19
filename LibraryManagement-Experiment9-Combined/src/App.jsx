import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import useProducts from './hooks/useProducts';
import useBorrowing from './hooks/useBorrowing';
import useApiRecommendations from './hooks/useApiRecommendations';
import { useAuth } from './context/AuthContext';
import Header from './components/Header';
import Home from './components/Home';
import BookList from './components/BookList';
import BookDetail from './components/BookDetail';
import SearchBar from './components/SearchBar';
import FilterPanel from './components/FilterPanel';
import BorrowedBooks from './components/BorrowedBooks';
import ReadingHistory from './components/ReadingHistory';
import Profile from './components/Profile';
import Recommendations from './components/Recommendations';
import BorrowRequest from './components/BorrowRequest';
import BorrowConfirmation from './components/BorrowConfirmation';
import Login from './components/Login';
import Register from './components/Register';
import ProtectedRoute from './components/ProtectedRoute';
import { MemberLayout, MemberOverview } from './components/MemberLayout';
import Footer from './components/Footer';
import BookManagement from './components/admin/BookManagement';
import BorrowingManagement from './components/admin/BorrowingManagement';
import { memberData } from './data/booksData';
import { setCurrentMember } from './store/librarySlice';
import './App.css';

const SiteLayout = ({ borrowedCount }) => (
  <div className="app">
    <Header borrowedCount={borrowedCount} />
    <main className="main-content"><Outlet /></main>
    <Footer />
  </div>
);

const NotFound = () => (
  <section className="page-panel narrow-panel">
    <p className="eyebrow">404 · PAGE NOT FOUND</p>
    <h2>This page isn’t in the catalogue.</h2>
    <p>The address does not match a library page. Check the URL or return to the home screen.</p>
    <Link to="/">Return home →</Link>
  </section>
);

function LibraryAppRoutes() {
  const dispatch = useDispatch();
  const currentMember = useSelector((state) => state.library.currentMember);
  const products = useProducts();
  const { books, filteredBooks } = products;
  const { user } = useAuth();
  useEffect(() => {
    dispatch(setCurrentMember(user || null));
  }, [dispatch, user]);
  const borrowing = useBorrowing(user);
  const { borrowedBooks, readingHistory, holdRequests, confirmRequest, returnBook, renewBook } = borrowing;
  const recommendationCategory = borrowedBooks[0]?.category || readingHistory[0]?.category || 'Fiction';
  const { recommendations: apiRecommendations, loading: recommendationsLoading, error: recommendationsError } = useApiRecommendations(recommendationCategory);
  const location = useLocation();
  const navigate = useNavigate();
  const searchInputRef = useRef(null);

  // Keep the earlier useRef/useEffect search-focus behaviour with URL-based navigation.
  useEffect(() => {
    if (location.pathname === '/books') searchInputRef.current?.focus();
  }, [location.pathname]);

  const availableBooks = useMemo(() => books.filter((book) => book.available).length, [books]);
  const overdueBooks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return borrowedBooks.filter((book) => book.dueDate && new Date(`${book.dueDate}T00:00:00`) < today);
  }, [borrowedBooks]);
  const localRecommendations = useMemo(() => {
    const borrowedIds = new Set(borrowedBooks.map((book) => String(book.id)));
    const borrowedCategories = new Set(borrowedBooks.map((book) => book.category));
    const candidates = books.filter((book) => book.available && !borrowedIds.has(String(book.id)));
    const matched = candidates.filter((book) => borrowedCategories.has(book.category));
    return (matched.length ? matched : candidates).slice(0, 3);
  }, [books, borrowedBooks]);

  // Recommendation results are also registered in the catalogue so that their
  // detail, borrow-request, and confirmation routes can resolve the selected ID.
  useEffect(() => {
    if (apiRecommendations.length) products.addBooks(apiRecommendations);
  }, [apiRecommendations, products.addBooks]);

  const apiRecommendationsForDisplay = useMemo(() => {
    const borrowedIds = new Set(borrowedBooks.map((book) => String(book.id)));
    return apiRecommendations.filter((book) => !borrowedIds.has(String(book.id))).slice(0, 3);
  }, [apiRecommendations, borrowedBooks]);
  const recommendations = apiRecommendationsForDisplay.length ? apiRecommendationsForDisplay : localRecommendations;

  const selectBook = useCallback((book) => navigate(`/book/${book.id}`), [navigate]);
  const handleConfirmRequest = useCallback((bookId, requestType) => confirmRequest(bookId, requestType), [confirmRequest]);
  const handleReturn = useCallback((bookId) => returnBook(bookId), [returnBook]);
  const handleRenew = useCallback((bookId, days, details) => renewBook(bookId, days, details), [renewBook]);

  const browsePage = (
    <>
      <div className="page-intro"><p className="eyebrow">THE CATALOGUE</p><h2>Browse Books</h2><p>Search by title or author, filter the catalogue, then open a title to borrow it or place a hold.</p></div>
      <SearchBar searchInputRef={searchInputRef} searchKeyword={products.searchKeyword} setSearchKeyword={products.setSearchKeyword} />
      {products.loading && <p className="api-status" role="status"><span className="loading-spinner" aria-hidden="true" /> Fetching book data from Open Library…</p>}
      {products.apiError && <p className="error-message" role="alert">{products.apiError}</p>}
      <FilterPanel filters={products} />
      <p className="catalogue-count">Showing {filteredBooks.length} of {books.length} catalogue titles{products.lastFetchedAt ? ' · Updated from API ' + new Date(products.lastFetchedAt).toLocaleTimeString() : ''}.</p>
      <BookList books={filteredBooks} borrowedBooks={borrowedBooks} holdRequests={holdRequests} />
    </>
  );

  const borrowedPage = (
    <>
      {borrowing.apiLoading && <p className="api-status" role="status"><span className="loading-spinner" aria-hidden="true" /> Loading your protected borrowing records…</p>}
      {borrowing.apiError && <p className="error-message" role="alert">{borrowing.apiError}</p>}
      <BorrowedBooks borrowedBooks={borrowedBooks} onReturn={handleReturn} onRenew={handleRenew} />
      {overdueBooks.length > 0 && <p className="error-message" role="alert">You have {overdueBooks.length} overdue book(s). Please return or renew them.</p>}
      <section className="page-panel hold-list">
        <h3>Hold Requests</h3>
        {holdRequests.length === 0 ? <p>No active hold requests.</p> : holdRequests.map((item, index) => (
          <div className="hold-row" key={`${item.bookId}-${index}`}><span><strong>{item.title}</strong><small>Requested {item.requestedDate}</small></span><span className="hold-status">{item.status}</span></div>
        ))}
      </section>
    </>
  );

  const historyPage = (
    <section>
      {borrowing.apiLoading && <p className="api-status" role="status"><span className="loading-spinner" aria-hidden="true" /> Loading your protected reading history…</p>}
      {borrowing.apiError && <p className="error-message" role="alert">{borrowing.apiError}</p>}
      <ReadingHistory history={readingHistory} />
    </section>
  );
  const profilePage = <Profile memberInfo={currentMember || user || memberData} />;
  const recommendationsPage = <Recommendations recommendations={recommendations} onSelect={selectBook} loading={recommendationsLoading} error={recommendationsError} source={apiRecommendationsForDisplay.length ? 'Open Library API' : 'Local catalogue'} />;

  return (
    <Routes>
      <Route element={<SiteLayout borrowedCount={borrowedBooks.length} />}>
        <Route index element={
          <>
            <Home totalBooks={books.length} availableBooks={availableBooks} borrowedCount={borrowedBooks.length} />
            <div className="home-actions"><Link className="primary-button button-link" to="/books">Explore catalogue →</Link><Link to="/member">Open member dashboard</Link></div>
            <Recommendations recommendations={recommendations} onSelect={selectBook} loading={recommendationsLoading} error={recommendationsError} source={apiRecommendationsForDisplay.length ? 'Open Library API' : 'Local catalogue'} />
          </>
        } />
        <Route path="books" element={browsePage} />
        <Route path="manage/books" element={<ProtectedRoute />}><Route index element={<BookManagement />} /></Route>
        <Route path="manage/borrowings" element={<ProtectedRoute />}><Route index element={<BorrowingManagement />} /></Route>
        <Route path="book/:id" element={<BookDetail books={books} borrowedBooks={borrowedBooks} holdRequests={holdRequests} onBookFetched={products.addBooks} />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />

        {/* Experiment 8: member pages require a server-verified bearer token. */}
        <Route element={<ProtectedRoute />}>
          <Route path="borrowed" element={borrowedPage} />
          <Route path="history" element={historyPage} />
          <Route path="profile" element={profilePage} />
          <Route path="borrow-request/:id" element={<BorrowRequest books={books} borrowedBooks={borrowedBooks} holdRequests={holdRequests} />} />
          <Route path="confirmation/:id" element={<BorrowConfirmation books={books} onConfirm={handleConfirmRequest} />} />
          <Route path="member" element={<MemberLayout />}>
            <Route index element={<MemberOverview memberInfo={currentMember || user || memberData} borrowedBooks={borrowedBooks} holdRequests={holdRequests} books={books} confirmationMessage={location.state?.confirmationMessage} />} />
            <Route path="borrowed" element={borrowedPage} />
            <Route path="history" element={historyPage} />
            <Route path="recommendations" element={recommendationsPage} />
            <Route path="profile" element={profilePage} />
            </Route>
        </Route>
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

function App() {
  return <LibraryAppRoutes />;
}

export default App;
