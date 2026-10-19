import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { initialBooks } from '../data/booksData';
import {
  mergeCatalogue,
  searchBooksFromApi,
  searchRecommendationsFromApi,
} from '../services/libraryApi';

export const BOOKS_STORAGE_KEY = 'libraryBooks';
export const BORROWING_STORAGE_KEY = 'libraryManagementBorrowingByAccount';

const safeRead = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const readBooks = () => {
  const saved = safeRead(BOOKS_STORAGE_KEY, null);
  return Array.isArray(saved) && saved.length ? saved : initialBooks;
};

const normalizeAccountRecords = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).map(([accountKey, record]) => [accountKey, {
    borrowedBooks: Array.isArray(record?.borrowedBooks) ? record.borrowedBooks : [],
    readingHistory: Array.isArray(record?.readingHistory) ? record.readingHistory : [],
    holdRequests: Array.isArray(record?.holdRequests) ? record.holdRequests : [],
  }]));
};

const emptyAccountRecord = () => ({ borrowedBooks: [], readingHistory: [], holdRequests: [] });

export const fetchBookSearch = createAsyncThunk(
  'library/fetchBookSearch',
  async ({ query = '', limit = 30 } = {}, { signal, rejectWithValue }) => {
    try {
      const books = await searchBooksFromApi(query, { signal, limit });
      return { books, lastFetchedAt: new Date().toISOString() };
    } catch (error) {
      if (signal.aborted) throw error;
      return rejectWithValue(error?.message || 'Could not fetch books from Open Library.');
    }
  },
);

export const fetchApiRecommendations = createAsyncThunk(
  'library/fetchApiRecommendations',
  async ({ category = 'Fiction' } = {}, { signal, rejectWithValue }) => {
    try {
      return await searchRecommendationsFromApi(category, { signal, limit: 6 });
    } catch (error) {
      if (signal.aborted) throw error;
      return rejectWithValue(error?.message || 'Could not load API recommendations.');
    }
  },
  {
    // Prevent duplicate recommendation calls when StrictMode reruns effects.
    // A successful result for the same category is reused for five minutes.
    condition: ({ category = 'Fiction' } = {}, { getState }) => {
      const state = getState()?.library;
      if (!state) return true;
      const requestedCategory = String(category || 'Fiction').trim() || 'Fiction';
      if (state.recommendationsLoading && state.activeRecommendationsCategory === requestedCategory) return false;
      if (state.apiRecommendationsCategory === requestedCategory && state.lastRecommendationsFetchedAt) {
        const age = Date.now() - Date.parse(state.lastRecommendationsFetchedAt);
        if (Number.isFinite(age) && age >= 0 && age < 5 * 60 * 1000) return false;
      }
      return true;
    },
  },
);

export const fetchSampleMember = createAsyncThunk(
  'library/fetchSampleMember',
  async (_, { signal, rejectWithValue }) => {
    try {
      const response = await fetch(
        'https://dummyjson.com/users/1?select=id,firstName,lastName,email,phone,username,image',
        { signal, headers: { Accept: 'application/json' } },
      );
      if (!response.ok) throw new Error(`Member API request failed (HTTP ${response.status}).`);
      const data = await response.json();
      return {
        id: data.id,
        name: [data.firstName, data.lastName].filter(Boolean).join(' '),
        email: data.email || 'Not supplied',
        phone: data.phone || 'Not supplied',
        username: data.username || 'Not supplied',
        image: data.image || '',
      };
    } catch (error) {
      if (signal.aborted) throw error;
      return rejectWithValue(error?.message || 'Unable to fetch the sample member record.');
    }
  },
);

const initialState = {
  books: readBooks(),
  accountRecords: normalizeAccountRecords(safeRead(BORROWING_STORAGE_KEY, {})),
  currentMember: null,
  sampleApiMember: null,
  sampleMemberLoading: false,
  sampleMemberError: '',
  searchKeyword: '',
  selectedCategory: 'All',
  selectedAuthor: 'All',
  booksLoading: true,
  booksError: '',
  lastFetchedAt: null,
  activeBooksRequestId: null,
  apiRecommendations: [],
  apiRecommendationsCategory: null,
  lastRecommendationsFetchedAt: null,
  recommendationsLoading: true,
  recommendationsError: '',
  activeRecommendationsRequestId: null,
  activeRecommendationsCategory: null,
};

const librarySlice = createSlice({
  name: 'library',
  initialState,
  reducers: {
    setCurrentMember(state, action) {
      state.currentMember = action.payload || null;
    },
    setSearchKeyword(state, action) {
      state.searchKeyword = String(action.payload ?? '');
    },
    setSelectedCategory(state, action) {
      state.selectedCategory = action.payload || 'All';
    },
    setSelectedAuthor(state, action) {
      state.selectedAuthor = action.payload || 'All';
    },
    replaceBooks(state, action) {
      state.books = Array.isArray(action.payload) ? action.payload : initialBooks;
    },
    addBooksToCatalogue(state, action) {
      const incoming = Array.isArray(action.payload) ? action.payload : [action.payload];
      state.books = mergeCatalogue(state.books, incoming.filter(Boolean));
    },
    removeBookFromCatalogue(state, action) {
      const id = String(action.payload);
      state.books = state.books.filter((book) => String(book.id) !== id);
    },
    borrowBook(state, action) {
      const { accountKey, bookId, record } = action.payload || {};
      if (!accountKey || !record) return;
      const book = state.books.find((item) => String(item.id) === String(bookId));
      if (!book || !book.available) return;
      const account = (state.accountRecords[accountKey] ||= emptyAccountRecord());
      if (account.borrowedBooks.some((item) => String(item.id) === String(bookId))) return;
      book.available = false;
      account.borrowedBooks.push(record);
    },
    placeBookHold(state, action) {
      const { accountKey, request } = action.payload || {};
      if (!accountKey || !request) return;
      const book = state.books.find((item) => String(item.id) === String(request.bookId));
      if (!book || book.available) return;
      const account = (state.accountRecords[accountKey] ||= emptyAccountRecord());
      const alreadyHeld = account.holdRequests.some((item) =>
        String(item.bookId) === String(request.bookId) && item.status === 'Waiting');
      if (!alreadyHeld) account.holdRequests.push(request);
    },
    returnBorrowedBook(state, action) {
      const { accountKey, bookId, returnedDate } = action.payload || {};
      const account = accountKey ? state.accountRecords[accountKey] : null;
      if (!account) return;
      const record = account.borrowedBooks.find((item) => String(item.id) === String(bookId));
      if (!record) return;
      const catalogueBook = state.books.find((item) => String(item.id) === String(bookId));
      if (catalogueBook) catalogueBook.available = true;
      account.borrowedBooks = account.borrowedBooks.filter((item) => String(item.id) !== String(bookId));
      account.readingHistory.push({ ...record, returnedDate });
    },
    renewBorrowedBook(state, action) {
      const { accountKey, bookId, dueDate, requestDetails = {} } = action.payload || {};
      const account = accountKey ? state.accountRecords[accountKey] : null;
      const record = account?.borrowedBooks.find((item) => String(item.id) === String(bookId));
      if (!record || !dueDate) return;
      record.dueDate = dueDate;
      record.renewalCount = (record.renewalCount || 0) + 1;
      record.lastRenewalRequest = requestDetails;
    },
    syncMemberBorrowingData(state, action) {
      const payload = action.payload || {};
      const { accountKey, borrowedBooks, readingHistory, holdRequests } = payload;
      if (!accountKey) return;
      state.accountRecords[accountKey] = {
        borrowedBooks: Array.isArray(borrowedBooks) ? borrowedBooks : [],
        readingHistory: Array.isArray(readingHistory) ? readingHistory : [],
        holdRequests: Array.isArray(holdRequests) ? holdRequests : [],
      };
      // Do not derive global availability from stale account-specific browser
      // records. useBorrowing synchronizes catalogue availability from GET /api/books.
    },
    hydratePersistedData(state, action) {
      const payload = action.payload || {};
      if (Array.isArray(payload.books)) state.books = payload.books;
      if (payload.accountRecords && typeof payload.accountRecords === 'object') {
        state.accountRecords = normalizeAccountRecords(payload.accountRecords);
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchBookSearch.pending, (state, action) => {
        state.booksLoading = true;
        state.booksError = '';
        state.activeBooksRequestId = action.meta.requestId;
      })
      .addCase(fetchBookSearch.fulfilled, (state, action) => {
        if (state.activeBooksRequestId !== action.meta.requestId) return;
        if (action.payload.books.length) state.books = mergeCatalogue(state.books, action.payload.books);
        state.lastFetchedAt = action.payload.lastFetchedAt;
        state.booksLoading = false;
        state.booksError = '';
        state.activeBooksRequestId = null;
      })
      .addCase(fetchBookSearch.rejected, (state, action) => {
        if (state.activeBooksRequestId !== action.meta.requestId) return;
        state.booksLoading = false;
        state.activeBooksRequestId = null;
        if (!action.meta.aborted) {
          state.booksError = action.payload || 'The live book catalogue is unavailable. Showing saved/local books.';
        }
      })
      .addCase(fetchApiRecommendations.pending, (state, action) => {
        state.recommendationsLoading = true;
        state.recommendationsError = '';
        state.activeRecommendationsRequestId = action.meta.requestId;
        state.activeRecommendationsCategory = String(action.meta.arg?.category || 'Fiction').trim() || 'Fiction';
      })
      .addCase(fetchApiRecommendations.fulfilled, (state, action) => {
        if (state.activeRecommendationsRequestId !== action.meta.requestId) return;
        state.apiRecommendations = action.payload;
        state.apiRecommendationsCategory = state.activeRecommendationsCategory;
        state.lastRecommendationsFetchedAt = new Date().toISOString();
        state.recommendationsLoading = false;
        state.recommendationsError = '';
        state.activeRecommendationsRequestId = null;
        state.activeRecommendationsCategory = null;
      })
      .addCase(fetchApiRecommendations.rejected, (state, action) => {
        // A condition-rejected duplicate is not a failed network request.
        if (action.meta.condition) return;
        if (state.activeRecommendationsRequestId !== action.meta.requestId) return;
        state.recommendationsLoading = false;
        state.activeRecommendationsRequestId = null;
        state.activeRecommendationsCategory = null;
        if (!action.meta.aborted) {
          state.recommendationsError = 'API recommendations could not be loaded. Local recommendations are shown instead.';
          state.apiRecommendations = [];
          state.apiRecommendationsCategory = null;
        }
      })
      .addCase(fetchSampleMember.pending, (state) => {
        state.sampleMemberLoading = true;
        state.sampleMemberError = '';
      })
      .addCase(fetchSampleMember.fulfilled, (state, action) => {
        state.sampleApiMember = action.payload;
        state.sampleMemberLoading = false;
        state.sampleMemberError = '';
      })
      .addCase(fetchSampleMember.rejected, (state, action) => {
        state.sampleMemberLoading = false;
        if (!action.meta.aborted) state.sampleMemberError = action.payload || 'Unable to fetch the sample member record.';
      });
  },
});

export const {
  setCurrentMember,
  setSearchKeyword,
  setSelectedCategory,
  setSelectedAuthor,
  replaceBooks,
  addBooksToCatalogue,
  removeBookFromCatalogue,
  borrowBook,
  placeBookHold,
  returnBorrowedBook,
  renewBorrowedBook,
  syncMemberBorrowingData,
  hydratePersistedData,
} = librarySlice.actions;

export default librarySlice.reducer;
