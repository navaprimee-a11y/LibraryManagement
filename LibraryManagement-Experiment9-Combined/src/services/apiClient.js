import axios from 'axios';
import { logLibraryActivity } from '../utils/activityLogger';

export const TOKEN_STORAGE_KEY = 'libraryAuthToken';
export const TOKEN_EXPIRY_KEY = 'libraryAuthExpiresAt';
export const AUTH_STORAGE_KEY = 'libraryManagementAuth';

const apiClient = axios.create({
  baseURL: '/api',
  timeout: 12000,
  headers: { Accept: 'application/json' },
});

const statusLabel = (status) => ({
  200: 'OK', 201: 'Created', 204: 'Deleted', 400: 'Bad Request',
  401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found',
  409: 'Conflict', 422: 'Invalid Data', 500: 'Server Error',
}[status] || 'Completed');

const endpointPath = (config = {}) => {
  const rawUrl = String(config.url || '').split('?')[0];
  if (/^https?:\/\//i.test(rawUrl)) {
    try { return new URL(rawUrl).pathname; } catch { return rawUrl; }
  }
  const base = String(config.baseURL || '').replace(/\/$/, '');
  let path = `${base}/${rawUrl.replace(/^\//, '')}`.replace(/\/+/g, '/');
  if (!path.startsWith('/')) path = `/${path}`;
  if (path !== '/api' && !path.startsWith('/api/')) path = `/api${path}`;
  return path;
};

const requestBody = (config) => {
  const body = config?.data;
  if (!body) return {};
  if (typeof body === 'object') return body;
  try { return JSON.parse(body); } catch { return {}; }
};

const titleOf = (data, config) => String(
  data?.title || data?.book?.title || data?.record?.title || config?.__libraryResourceTitle || '',
).trim();

const describeSuccess = (method, path, data, config) => {
  const body = requestBody(config);
  const title = titleOf(data, config);
  if (path === '/api/auth/register' && method === 'POST') return 'Member registration successful';
  if (path === '/api/auth/login' && method === 'POST') return 'Member login successful';
  if (path === '/api/auth/logout' && method === 'POST') return 'Member logout successful';
  if (path === '/api/auth/me' && method === 'GET') return 'Authentication token verified';
  if (path === '/api/profile' && method === 'GET') return 'Member profile loaded';
  if (path === '/api/profile' && method === 'PATCH') return 'Member profile updated';
  if (path === '/api/history' && method === 'GET') return `Reading history loaded (${Array.isArray(data) ? data.length : 0} record(s))`;
  if (path === '/api/holds' && method === 'GET') return `Hold requests loaded (${Array.isArray(data) ? data.length : 0})`;
  if (path === '/api/holds' && method === 'POST') {
    if (data?.decision === 'borrow_instead') return 'Hold not created: the book is available; borrow it instead';
    if (data?.decision === 'already_borrowed') return 'Hold not created: this book is already checked out to this member';
    return data?.alreadyExists ? `Existing hold reused: ${title || 'book'}` : `Hold request placed: ${title || 'book'}`;
  }
  if (path === '/api/books' && method === 'GET') return `REST API loaded books (${Array.isArray(data) ? data.length : 0})`;
  if (path === '/api/books' && method === 'POST') return `Book added: ${title || 'new book'}`;
  if (/^\/api\/books\/[^/]+$/.test(path)) {
    if (method === 'GET') return `Book details loaded: ${title || 'book'}`;
    if (method === 'PUT' || method === 'PATCH') return `Book updated: ${title || 'book'}`;
    if (method === 'DELETE') return `Book deleted: ${title || config?.__libraryResourceTitle || 'book'}`;
  }
  if (path === '/api/borrowings' && method === 'GET') return `Borrowing records loaded (${Array.isArray(data) ? data.length : 0})`;
  if (path === '/api/borrowings' && method === 'POST') {
    if (data?.decision === 'hold_instead') return 'Checkout stopped: the book is unavailable; place a hold instead';
    return data?.alreadyExists
      ? `Already checked out; duplicate loan prevented: ${title || 'book'}`
      : `Book checked out: ${title || 'book'} (due ${data?.dueDate || 'date returned by API'})`;
  }
  if (/^\/api\/borrowings\/[^/]+$/.test(path)) {
    if (method === 'GET') return `Borrowing record loaded: ${title || 'record'}`;
    if (method === 'PUT' || method === 'PATCH') {
      if (body.status === 'returned' || data?.status === 'returned') return `Book returned: ${title || 'book'}`;
      if (body.dueDate) return `Book renewed: ${title || 'book'} (due ${data?.dueDate || body.dueDate})`;
      return `Borrowing record updated: ${title || 'record'}`;
    }
    if (method === 'DELETE') return `Borrowing record deleted: ${title || config?.__libraryResourceTitle || 'record'}`;
  }
  if (path === '/api/health') return 'Library REST API health check succeeded';
  return `REST request completed: ${method} ${path}`;
};

apiClient.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_STORAGE_KEY) : null;
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
    // A delayed 401 must not clear a newer token from another login.
    config.__libraryAuthToken = token;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    const method = String(response.config?.method || 'GET').toUpperCase();
    const path = endpointPath(response.config);
    const message = describeSuccess(method, path, response.data, response.config);
    logLibraryActivity(`${message} (${method} ${path} -> ${response.status} ${statusLabel(response.status)})`);
    return response;
  },
  (error) => {
    const status = error?.response?.status || 0;
    const config = error?.config || {};
    const method = String(config.method || 'GET').toUpperCase();
    const path = endpointPath(config);
    const message = error?.response?.data?.message || error?.message || 'Network request failed';
    logLibraryActivity(`API request failed (${method} ${path} -> ${status || 'NETWORK ERROR'}): ${message}`, 'warn');

    const failedToken = config.__libraryAuthToken;
    const url = String(config.url || '');
    const isLoginOrRegistration = /\/auth\/(login|register)$/.test(url);
    if (status === 401 && failedToken && !isLoginOrRegistration && typeof window !== 'undefined') {
      const currentToken = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (currentToken === failedToken) {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        localStorage.removeItem(TOKEN_EXPIRY_KEY);
        localStorage.removeItem(AUTH_STORAGE_KEY);
        window.dispatchEvent(new CustomEvent('library:session-expired', {
          detail: { token: failedToken, message: error?.response?.data?.message || 'Your session is invalid or expired. Please sign in again.' },
        }));
      }
    }
    return Promise.reject(error);
  },
);

export default apiClient;
