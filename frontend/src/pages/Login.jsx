import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogIn } from 'lucide-react';

const Login = ({ setView }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return;

    setIsLoading(true);
    const result = await login(email, password);
    setIsLoading(false);

    if (result.success) {
      if (result.role === 'admin') {
        setView('admin');
      } else {
        setView('student');
      }
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '20px'
    }}>
      <div className="glass-panel modal-content" style={{ width: '100%', maxWidth: '420px', animation: 'scaleUp 0.3s ease-out' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--secondary)))',
            display: 'inline-flex',
            padding: '12px',
            borderRadius: '12px',
            marginBottom: '16px'
          }}>
            <LogIn size={28} color="#fff" />
          </div>
          <h2 style={{ fontSize: '1.8rem', color: 'hsl(var(--text-primary))', marginBottom: '8px' }}>Blossom Trust</h2>
          <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.9rem' }}>Centralized Student Reporting Portal</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              className="form-input"
              placeholder="e.g. name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: '28px' }}>
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '14px', marginBottom: '20px' }}
            disabled={isLoading}
          >
            {isLoading ? <div className="loader-spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }}></div> : 'Sign In'}
          </button>
        </form>

        <div style={{ textAlign: 'center', fontSize: '0.88rem', color: 'hsl(var(--text-secondary))' }}>
          Don't have a student account?{' '}
          <span
            onClick={() => setView('register')}
            style={{ color: 'hsl(var(--primary-hover))', cursor: 'pointer', fontWeight: '500', textDecoration: 'underline' }}
          >
            Register Here
          </span>
        </div>
      </div>
    </div>
  );
};

export default Login;
