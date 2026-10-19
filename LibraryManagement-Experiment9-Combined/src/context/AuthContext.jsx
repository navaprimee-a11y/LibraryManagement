import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { validateLogin, validateRegister } from '../utils/validation';
import {
  AUTH_STORAGE_KEY,
  TOKEN_EXPIRY_KEY,
  TOKEN_STORAGE_KEY,
} from '../services/apiClient';
import {
  getAuthApiError,
  getCurrentMember,
  loginWithApi,
  logoutFromApi,
  registerWithApi,
  updateApiProfile,
} from '../services/authApi';

const AuthContext = createContext(null);

const saveSessionUser = (user) => {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ isAuthenticated: true, user }));
};
const clearSavedSession = () => {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
  localStorage.removeItem(AUTH_STORAGE_KEY);
};
const storeTokenDetails = ({ token, expiresAt }) => {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
  localStorage.setItem(TOKEN_EXPIRY_KEY, String(new Date(expiresAt).getTime()));
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(() => Boolean(localStorage.getItem(TOKEN_STORAGE_KEY)));
  const [authError, setAuthError] = useState('');

  const clearSession = useCallback((message = '') => {
    clearSavedSession();
    setUser(null);
    setAuthLoading(false);
    setAuthError(message);
  }, []);

  useEffect(() => {
    const handleExpiredSession = (event) => {
      const failedToken = event?.detail?.token;
      const currentToken = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (failedToken && currentToken && failedToken !== currentToken) return;
      clearSession(event?.detail?.message || 'Your session has expired. Please sign in again.');
    };
    window.addEventListener('library:session-expired', handleExpiredSession);
    return () => window.removeEventListener('library:session-expired', handleExpiredSession);
  }, [clearSession]);

  useEffect(() => {
    const handleTokenStorageChange = (event) => {
      if (event.key !== TOKEN_STORAGE_KEY || event.oldValue === event.newValue) return;
      if (event.newValue === null) {
        clearSession('You were signed out in another tab. Please sign in again.');
      } else if (user && event.oldValue && event.newValue !== event.oldValue) {
        // Do not delete the newly written token, which may belong to a fresh sign-in
        // in the other tab. This tab drops its in-memory identity to avoid account mix-ups.
        setUser(null);
        setAuthLoading(false);
        setAuthError('The active library session changed in another tab. Sign in again here.');
      }
    };
    window.addEventListener('storage', handleTokenStorageChange);
    return () => window.removeEventListener('storage', handleTokenStorageChange);
  }, [user, clearSession]);

  // Verify stored tokens with the server before treating a restored session as signed in.
  useEffect(() => {
    let active = true;
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    const expiry = Number(localStorage.getItem(TOKEN_EXPIRY_KEY) || 0);
    if (!token) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      setAuthLoading(false);
      return () => { active = false; };
    }
    if (expiry && expiry <= Date.now()) {
      clearSession('Your session has expired. Please sign in again.');
      return () => { active = false; };
    }
    setAuthLoading(true);
    getCurrentMember()
      .then((session) => {
        if (!active) return;
        setUser(session.user);
        if (session.expiresAt) localStorage.setItem(TOKEN_EXPIRY_KEY, String(new Date(session.expiresAt).getTime()));
        saveSessionUser(session.user);
        setAuthError('');
      })
      .catch((error) => {
        if (!active) return;
        clearSession(getAuthApiError(error) || 'Please sign in again.');
      })
      .finally(() => { if (active) setAuthLoading(false); });
    return () => { active = false; };
  }, [clearSession]);

  // Expire the visible session at the server-provided deadline, even if the member is idle.
  useEffect(() => {
    if (!user || authLoading) return undefined;
    const expiry = Number(localStorage.getItem(TOKEN_EXPIRY_KEY) || 0);
    if (!expiry) return undefined;
    const remaining = expiry - Date.now();
    if (remaining <= 0) {
      clearSession('Your session has expired. Please sign in again.');
      return undefined;
    }
    const timer = window.setTimeout(() => {
      clearSession('Your session has expired. Please sign in again.');
    }, Math.min(remaining, 2_147_000_000));
    return () => window.clearTimeout(timer);
  }, [user, authLoading, clearSession]);

  const registerMember = useCallback(async (form) => {
    const errors = validateRegister(form);
    if (Object.keys(errors).length) return { ok: false, errors };
    try {
      const result = await registerWithApi(form);
      setAuthError('');
      return { ok: true, user: result.user };
    } catch (error) {
      const errorsFromServer = error?.response?.data?.errors;
      return { ok: false, errors: errorsFromServer || { form: getAuthApiError(error) } };
    }
  }, []);

  const login = useCallback(async ({ identifier, password }) => {
    const errors = validateLogin({ identifier, password });
    if (Object.keys(errors).length) {
      setAuthError(Object.values(errors)[0]);
      return { ok: false, errors };
    }
    try {
      const session = await loginWithApi({ identifier: identifier.trim(), password });
      storeTokenDetails(session);
      saveSessionUser(session.user);
      setUser(session.user);
      setAuthLoading(false);
      setAuthError('');
      return { ok: true, user: session.user, expiresAt: session.expiresAt };
    } catch (error) {
      const loginErrors = { form: getAuthApiError(error) };
      setAuthError(loginErrors.form);
      return { ok: false, errors: loginErrors };
    }
  }, []);

  const logout = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    // Clear the client immediately. Send the captured token explicitly so the logout
    // request can still revoke it after local token storage has been removed.
    clearSession('');
    if (token) {
      try { await logoutFromApi(token); } catch { /* invalid/expired tokens are already unusable */ }
    }
  }, [clearSession]);

  const updateUser = useCallback(async (nextProfile) => {
    if (!user) return { ok: false, errors: { form: 'Please sign in again before updating your profile.' } };
    try {
      const result = await updateApiProfile(nextProfile);
      const nextUser = result.user;
      setUser(nextUser);
      saveSessionUser(nextUser);
      setAuthError('');
      return { ok: true, user: nextUser };
    } catch (error) {
      return { ok: false, errors: { form: getAuthApiError(error) } };
    }
  }, [user]);

  const clearAuthError = useCallback(() => setAuthError(''), []);
  const isAuthenticated = authLoading ? undefined : Boolean(user);
  const tokenExpiresAt = Number(localStorage.getItem(TOKEN_EXPIRY_KEY) || 0) || null;
  const value = useMemo(() => ({
    user,
    tokenExpiresAt,
    authLoading,
    isAuthenticated,
    authError,
    registerMember,
    login,
    logout,
    updateUser,
    clearAuthError,
  }), [user, tokenExpiresAt, authLoading, isAuthenticated, authError, registerMember, login, logout, updateUser, clearAuthError]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
};
