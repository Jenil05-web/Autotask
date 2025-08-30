// client/src/pages/Login.js
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import './Auth.css';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  
  const { login, signInWithGoogle } = useAuth();
  const navigate = useNavigate();

  async function handleEmailLogin(e) {
    e.preventDefault();
    
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }
    
    try {
      setError('');
      setLoading(true);
      const result = await login(email, password);
      
      if (result.success) {
        navigate('/dashboard');
      } else {
        setError(result.error);
      }
    } catch (error) {
      setError('Failed to log in. Please try again.');
    }
    
    setLoading(false);
  }

  async function handleGoogleLogin() {
    try {
      setError('');
      setGoogleLoading(true);
      const result = await signInWithGoogle();
      
      if (result.success) {
        navigate('/dashboard');
      } else {
        setError(result.error);
      }
    } catch (error) {
      setError('Failed to sign in with Google. Please try again.');
    }
    
    setGoogleLoading(false);
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="logo-container">
            <span className="logo-icon">🤖</span>
            <h1>Auto Task AI</h1>
          </div>
          <h2>Welcome Back</h2>
          <p>Sign in to continue managing your automated tasks</p>
        </div>

        {error && (
          <div className="error-message">
            <span className="error-icon">⚠️</span>
            {error}
          </div>
        )}

        <form onSubmit={handleEmailLogin} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="form-input"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="form-input"
            />
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="auth-button primary"
          >
            {loading ? (
              <span className="loading-spinner">⏳</span>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div className="divider">
          <span>or</span>
        </div>

        <button
          onClick={handleGoogleLogin}
          disabled={googleLoading}
          className="auth-button google"
        >
          {googleLoading ? (
            <span className="loading-spinner">⏳</span>
          ) : (
            <>
              <span className="google-icon">🔍</span>
              Continue with Google
            </>
          )}
        </button>

        <div className="auth-footer">
          <Link to="/forgot-password" className="forgot-password">
            Forgot your password?
          </Link>
          <p className="signup-prompt">
            Don't have an account?{' '}
            <Link to="/register" className="signup-link">
              Sign up here
            </Link>
          </p>
        </div>
      </div>

      <div className="auth-background">
        <div className="floating-shapes">
          <div className="shape shape-1"></div>
          <div className="shape shape-2"></div>
          <div className="shape shape-3"></div>
          <div className="shape shape-4"></div>
        </div>
      </div>
    </div>
  );
}

export default Login;