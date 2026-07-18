import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserPlus } from 'lucide-react';

const Register = ({ setView }) => {
  const { register } = useAuth();
  
  const [fullName, setFullName] = useState('');
  const [utNo, setUtNo] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [studentType, setStudentType] = useState('blossom');
  const [courseName, setCourseName] = useState('Full Stack Developer');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!fullName || !utNo || !email || !password) return;

    setIsLoading(true);
    const result = await register(email, password, fullName, utNo, studentType, studentType === 'non_blossom' ? courseName : '');
    setIsLoading(false);

    if (result.success) {
      setView('login');
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
      <div className="glass-panel modal-content" style={{ width: '100%', maxWidth: '480px', animation: 'scaleUp 0.3s ease-out' }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--secondary)))',
            display: 'inline-flex',
            padding: '12px',
            borderRadius: '12px',
            marginBottom: '16px'
          }}>
            <UserPlus size={28} color="#fff" />
          </div>
          <h2 style={{ fontSize: '1.8rem', color: 'hsl(var(--text-primary))', marginBottom: '8px' }}>Student Registration</h2>
          <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.9rem' }}>Create your Blossom Trust profile account</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Priyantha Silva"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">UT Number</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. UT/2026/001"
              value={utNo}
              onChange={(e) => setUtNo(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Student Type</label>
            <select
              className="form-select"
              value={studentType}
              onChange={(e) => setStudentType(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid hsla(var(--border-glass))',
                backgroundColor: 'rgba(15, 23, 42, 0.6)',
                color: 'hsl(var(--text-primary))',
                outline: 'none'
              }}
              required
            >
              <option value="blossom">Blossom Trust Student</option>
              <option value="non_blossom">Non-Blossom Student</option>
            </select>
          </div>

          {studentType === 'non_blossom' && (
            <div className="form-group">
              <label className="form-label">Select Course</label>
              <select
                className="form-select"
                value={courseName}
                onChange={(e) => setCourseName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid hsla(var(--border-glass))',
                  backgroundColor: 'rgba(15, 23, 42, 0.6)',
                  color: 'hsl(var(--text-primary))',
                  outline: 'none'
                }}
                required
              >
                <option value="Full Stack Developer">Full Stack Developer</option>
                <option value="Front End Developer">Front End Developer</option>
              </select>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              className="form-input"
              placeholder="e.g. student@blossomtrust.org"
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
              placeholder="Min 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '14px', marginBottom: '20px' }}
            disabled={isLoading}
          >
            {isLoading ? <div className="loader-spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }}></div> : 'Create Account'}
          </button>
        </form>

        <div style={{ textAlign: 'center', fontSize: '0.88rem', color: 'hsl(var(--text-secondary))' }}>
          Already have an account?{' '}
          <span
            onClick={() => setView('login')}
            style={{ color: 'hsl(var(--primary-hover))', cursor: 'pointer', fontWeight: '500', textDecoration: 'underline' }}
          >
            Log In
          </span>
        </div>
      </div>
    </div>
  );
};

export default Register;
