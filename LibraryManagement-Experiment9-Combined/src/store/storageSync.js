import { BOOKS_STORAGE_KEY, BORROWING_STORAGE_KEY, hydratePersistedData } from './librarySlice';

// Keep open tabs in sync when another tab borrows/returns a book or updates the catalogue.
export const setupLibraryStorageSync = (store) => {
  if (typeof window === 'undefined') return () => {};

  const handleStorage = (event) => {
    if (![BOOKS_STORAGE_KEY, BORROWING_STORAGE_KEY].includes(event.key)) return;
    try {
      const books = JSON.parse(localStorage.getItem(BOOKS_STORAGE_KEY) || 'null');
      const accountRecords = JSON.parse(localStorage.getItem(BORROWING_STORAGE_KEY) || '{}');
      store.dispatch(hydratePersistedData({
        books: Array.isArray(books) ? books : undefined,
        accountRecords: accountRecords && typeof accountRecords === 'object' ? accountRecords : {},
      }));
    } catch (error) {
      console.warn('Could not synchronize library storage changes from another tab.', error);
    }
  };

  window.addEventListener('storage', handleStorage);
  return () => window.removeEventListener('storage', handleStorage);
};
