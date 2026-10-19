import { BOOKS_STORAGE_KEY, BORROWING_STORAGE_KEY } from './librarySlice';
import { logLibraryActivity } from '../utils/activityLogger';

const actionsThatPersist = new Set([
  'library/addBooksToCatalogue',
  'library/removeBookFromCatalogue',
  'library/replaceBooks',
  'library/borrowBook',
  'library/placeBookHold',
  'library/returnBorrowedBook',
  'library/renewBorrowedBook',
  'library/syncMemberBorrowingData',
  'library/fetchBookSearch/fulfilled',
]);

const getTitle = (action) => action.payload?.record?.title
  || action.payload?.request?.title
  || action.payload?.book?.title
  || action.payload?.title
  || '';

// Experiment 6 middleware keeps state in browser storage and emits readable
// high-level messages in DevTools. It deliberately avoids raw Redux action dumps.
const libraryMiddleware = (storeApi) => (next) => (action) => {
  const result = next(action);
  const type = action?.type;
  const title = getTitle(action);

  if (typeof type === 'string' && type.startsWith('library/')) {
    if (type === 'library/fetchBookSearch/fulfilled') {
      const query = action.meta?.arg?.query?.trim();
      logLibraryActivity(`Open Library search loaded ${action.payload?.books?.length || 0} result(s)${query ? ` for "${query}"` : ''}.`);
    } else if (type === 'library/fetchBookSearch/rejected' && !action.meta?.aborted) {
      logLibraryActivity('Open Library search failed; saved catalogue data remains available.', 'warn');
    } else if (type === 'library/fetchApiRecommendations/fulfilled') {
      logLibraryActivity(`API recommendations loaded (${action.payload?.length || 0} result(s)).`);
    } else if (type === 'library/fetchApiRecommendations/rejected' && !action.meta?.aborted) {
      logLibraryActivity('API recommendations failed; local recommendations will be shown.', 'warn');
    } else if (type === 'library/fetchSampleMember/fulfilled') {
      logLibraryActivity('Sample member data loaded from the member REST API.');
    } else if (type === 'library/fetchSampleMember/rejected' && !action.meta?.aborted) {
      logLibraryActivity('Sample member API request failed.', 'warn');
    } else if (type === 'library/setSelectedCategory') {
      logLibraryActivity(`Category filter set to "${action.payload || 'All'}".`);
    } else if (type === 'library/setSelectedAuthor') {
      logLibraryActivity(`Author filter set to "${action.payload || 'All'}".`);
    } else if (type === 'library/borrowBook') {
      logLibraryActivity(`Borrowing state updated${title ? ` for "${title}"` : ''}.`);
    } else if (type === 'library/placeBookHold') {
      logLibraryActivity(`Hold state updated${title ? ` for "${title}"` : ''}.`);
    } else if (type === 'library/returnBorrowedBook') {
      logLibraryActivity(`Return state updated${title ? ` for "${title}"` : ''}.`);
    } else if (type === 'library/renewBorrowedBook') {
      logLibraryActivity(`Renewal state updated${title ? ` for "${title}"` : ''}.`);
    }
  }

  if (actionsThatPersist.has(type)) {
    try {
      const { books, accountRecords } = storeApi.getState().library;
      localStorage.setItem(BOOKS_STORAGE_KEY, JSON.stringify(books));
      localStorage.setItem(BORROWING_STORAGE_KEY, JSON.stringify(accountRecords));
    } catch (error) {
      logLibraryActivity(`Browser state could not be saved: ${error?.message || 'storage unavailable'}.`, 'warn');
    }
  }

  if (type === 'library/setCurrentMember') {
    try {
      const currentMember = storeApi.getState().library.currentMember;
      if (currentMember) localStorage.setItem('libraryReduxCurrentMember', JSON.stringify(currentMember));
      else localStorage.removeItem('libraryReduxCurrentMember');
    } catch (error) {
      logLibraryActivity(`Current member state could not be saved: ${error?.message || 'storage unavailable'}.`, 'warn');
    }
  }

  return result;
};

export default libraryMiddleware;
