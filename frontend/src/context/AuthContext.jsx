import React, { createContext, useState, useEffect, useContext, useRef } from 'react';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem('bt_token') || null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const authFailureHandledRef = useRef(false);

  const API_URL = '/api';

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => { setToast(null); }, 4000);
  };

  const readApiResponse = async (res) => {
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return res.json();
    }

    const text = await res.text();
    return {
      message: text || `Request failed with status ${res.status}`
    };
  };

  const clearAuthSession = (message = 'Session expired. Please log in again.') => {
    localStorage.removeItem('bt_token');
    setToken(null);
    setUser(null);
    setLoading(false);

    if (!authFailureHandledRef.current) {
      authFailureHandledRef.current = true;
      showToast(message, 'error');
    }
  };

  useEffect(() => {
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input, init) => {
      const res = await originalFetch(input, init);
      const requestUrl = typeof input === 'string' ? input : input?.url || '';
      const isApiRequest = requestUrl.startsWith(API_URL) || requestUrl.includes('/api/');
      const isLoginRequest = requestUrl.includes('/auth/login') || requestUrl.includes('/auth/register');
      const isProtectedRequest = requestUrl.includes('/api/admin/') || requestUrl.includes('/api/student/') || requestUrl.endsWith('/api/auth/me') || requestUrl.endsWith('/auth/me');

      if (isApiRequest && isProtectedRequest && !isLoginRequest && (res.status === 401 || res.status === 403)) {
        let message = '';
        try {
          const data = await readApiResponse(res.clone());
          message = data?.message || '';
        } catch (_) {
          message = '';
        }

        const shouldClearSession = !message || /invalid|expired|access denied|administrator|role|not assigned|not found/i.test(message);
        if (shouldClearSession) {
          clearAuthSession(message || 'Session expired. Please log in again.');
        }
      }

      return res;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  // Fetch current user details if token exists
  const fetchCurrentUser = async (authToken) => {
    try {
      const res = await fetch(`${API_URL}/auth/me`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      const data = await readApiResponse(res);

      if (res.ok) {
        authFailureHandledRef.current = false;
        setUser({
          id: data.id,
          email: data.email,
          role: data.role
        });
      } else {
        clearAuthSession(data.message || 'Session expired. Please log in again.');
      }
    } catch (err) {
      console.error('Error fetching current user:', err);
      logout();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchCurrentUser(token);
    } else {
      setUser(null);
      setLoading(false);
    }
  }, [token]);

  const login = async (email, password) => {
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await readApiResponse(res);

      if (res.ok) {
        authFailureHandledRef.current = false;
        localStorage.setItem('bt_token', data.token);
        setToken(data.token);
        setUser(data.user);
        showToast('Successfully logged in!', 'success');
        return { success: true, role: data.user.role };
      } else {
        showToast(data.message || 'Login failed. Please check credentials.', 'error');
        return { success: false, error: data.message };
      }
    } catch (err) {
      console.error('Login error:', err);
      showToast('Connection error. Server may be offline.', 'error');
      return { success: false, error: 'Connection error' };
    }
  };

  const register = async (email, password, fullName, utNo, studentType = 'blossom', courseName = '') => {
    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, fullName, utNo, studentType, courseName })
      });

      const data = await readApiResponse(res);

      if (res.ok) {
        showToast('Registration successful! You can now log in.', 'success');
        return { success: true };
      } else {
        showToast(data.message || 'Registration failed.', 'error');
        return { success: false, error: data.message };
      }
    } catch (err) {
      console.error('Registration error:', err);
      showToast('Connection error. Server may be offline.', 'error');
      return { success: false, error: 'Connection error' };
    }
  };

  const logout = () => {
    localStorage.removeItem('bt_token');
    setToken(null);
    setUser(null);
    showToast('Logged out successfully.', 'info');
  };

  const refreshProfile = async () => {
    if (token) {
      await fetchCurrentUser(token);
    }
  };

  const value = {
    token,
    user,
    loading,
    toast,
    login,
    register,
    logout,
    refreshProfile,
    showToast,
    API_URL
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      {toast && (
        <div className={`alert-toast alert-${toast.type}`}>
          <span>{toast.message}</span>
        </div>
      )}
    </AuthContext.Provider>
  );
};
