import apiClient from './apiClient';

const markLocalApi = (book) => ({ ...book, source: 'local-api' });
const ensureArray = (data, label) => {
  if (!Array.isArray(data)) throw new Error(`The REST API returned an invalid ${label} response.`);
  return data;
};

export const getApiBooks = async (params = {}) => ensureArray((await apiClient.get('/books', { params })).data, 'book list').map(markLocalApi);
export const getApiBook = async (id) => markLocalApi((await apiClient.get(`/books/${encodeURIComponent(id)}`)).data);
export const createApiBook = async (book) => markLocalApi((await apiClient.post('/books', book)).data);
export const replaceApiBook = async (id, book) => markLocalApi((await apiClient.put(`/books/${encodeURIComponent(id)}`, book)).data);
export const patchApiBook = async (id, changes) => markLocalApi((await apiClient.patch(`/books/${encodeURIComponent(id)}`, changes)).data);
export const deleteApiBook = async (id, title = '') => apiClient.delete(`/books/${encodeURIComponent(id)}`, { __libraryResourceTitle: title });
export const getApiBorrowings = async (params = {}) => ensureArray((await apiClient.get('/borrowings', { params })).data, 'borrowing list');
export const createApiBorrowing = async (record) => (await apiClient.post('/borrowings', record)).data;
export const updateApiBorrowing = async (id, changes) => (await apiClient.patch(`/borrowings/${encodeURIComponent(id)}`, changes)).data;
export const replaceApiBorrowing = async (id, record) => (await apiClient.put(`/borrowings/${encodeURIComponent(id)}`, record)).data;
export const deleteApiBorrowing = async (id, title = '') => apiClient.delete(`/borrowings/${encodeURIComponent(id)}`, { __libraryResourceTitle: title });
export const getApiError = (error) => error?.response?.data?.message || error?.message || 'The API request failed. Check that the REST server is running.';
