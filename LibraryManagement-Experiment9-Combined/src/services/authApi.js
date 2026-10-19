import apiClient from './apiClient';

export const registerWithApi = async (member) => (await apiClient.post('/auth/register', member)).data;
export const loginWithApi = async (credentials) => (await apiClient.post('/auth/login', credentials)).data;
export const getCurrentMember = async () => (await apiClient.get('/auth/me')).data;
export const logoutFromApi = async (token) => (await apiClient.post('/auth/logout', {}, {
  headers: token ? { Authorization: `Bearer ${token}` } : {},
})).data;
export const getApiProfile = async () => (await apiClient.get('/profile')).data;
export const updateApiProfile = async (profile) => (await apiClient.patch('/profile', profile)).data;
export const getApiHistory = async () => (await apiClient.get('/history')).data;
export const getApiHolds = async () => (await apiClient.get('/holds')).data;
export const createApiHold = async (hold) => (await apiClient.post('/holds', hold)).data;
export const getAuthApiError = (error) => error?.response?.data?.message || error?.message || 'The authentication API request failed.';
