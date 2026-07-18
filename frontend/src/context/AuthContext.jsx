import React, { createContext, useState, useEffect, useContext } from 'react';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem('bt_token') || null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const API_URL = '/api';

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => { setToast(null); }, 4000);
  };

  // Fetch current user details if token exists
  const fetchCurrentUser = async (authToken) => {
    try {
      const res = await fetch(`${API_URL}/auth/me`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      const data = await res.json();

      if (res.ok) {
        setUser({
          id: data.id,
          email: data.email,
          role: data.role
        });
      } else {
        logout();
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

      const data = await res.json();

      if (res.ok) {
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

      const data = await res.json();

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
