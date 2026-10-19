import { useCallback, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { filterBooks } from '../utils/bookFilters';
import {
  addBooksToCatalogue,
  fetchBookSearch,
  setSearchKeyword as setSearchKeywordAction,
  setSelectedAuthor as setSelectedAuthorAction,
  setSelectedCategory as setSelectedCategoryAction,
} from '../store/librarySlice';

// The hook keeps the old component API, while all durable catalogue/filter state
// now lives in the Redux Toolkit store.
const useProducts = () => {
  const dispatch = useDispatch();
  const {
    books, searchKeyword, selectedCategory, selectedAuthor,
    booksLoading: loading, booksError: apiError, lastFetchedAt,
  } = useSelector((state) => state.library);

  useEffect(() => {
    let request;
    const delay = searchKeyword.trim() ? 450 : 0;
    const timer = setTimeout(() => {
      request = dispatch(fetchBookSearch({ query: searchKeyword.trim(), limit: 30 }));
    }, delay);

    return () => {
      clearTimeout(timer);
      request?.abort();
    };
  }, [dispatch, searchKeyword]);

  const setSearchKeyword = useCallback((value) => dispatch(setSearchKeywordAction(value)), [dispatch]);
  const setSelectedCategory = useCallback((value) => dispatch(setSelectedCategoryAction(value)), [dispatch]);
  const setSelectedAuthor = useCallback((value) => dispatch(setSelectedAuthorAction(value)), [dispatch]);
  const addBooks = useCallback((incoming) => dispatch(addBooksToCatalogue(incoming)), [dispatch]);

  const categories = useMemo(
    () => [...new Set(books.map((book) => book.category).filter(Boolean))].sort(),
    [books],
  );
  const authors = useMemo(
    () => [...new Set(books.map((book) => book.author).filter(Boolean))].sort(),
    [books],
  );
  const filteredBooks = useMemo(
    () => filterBooks(books, { searchKeyword, selectedCategory, selectedAuthor }),
    [books, searchKeyword, selectedCategory, selectedAuthor],
  );

  return {
    books,
    addBooks,
    searchKeyword,
    setSearchKeyword,
    selectedCategory,
    setSelectedCategory,
    selectedAuthor,
    setSelectedAuthor,
    categories,
    authors,
    filteredBooks,
    loading,
    apiError,
    lastFetchedAt,
  };
};

export default useProducts;
