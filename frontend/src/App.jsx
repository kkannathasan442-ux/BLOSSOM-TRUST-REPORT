import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import StudentProfile from './pages/StudentProfile';
import AdminDashboard from './pages/AdminDashboard';
import './styles/design.css';

const AppContent = () => {
  const { user, loading } = useAuth();
  const [view, setView] = useState('login');

  // Sync state view if user session is loaded
  useEffect(() => {
    if (!loading) {
      if (user) {
        if (user.role === 'admin') {
          setView('admin');
        } else {
          setView('student');
        }
      } else {
        // Safe redirect
        if (view !== 'login' && view !== 'register') {
          setView('login');
        }
      }
    }
  }, [user, loading]);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'hsl(var(--bg-base))'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div className="loader-spinner"></div>
          <span style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.9rem', fontFamily: 'var(--font-title)' }}>
            Restoring session...
          </span>
        </div>
      </div>
    );
  }

  // Guest view routing
  if (!user) {
    if (view === 'register') {
      return <Register setView={setView} />;
    }
    return <Login setView={setView} />;
  }

  // Authenticated view routing
  if (user.role === 'admin') {
    return <AdminDashboard setView={setView} />;
  }

  return <StudentProfile setView={setView} />;
};

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
