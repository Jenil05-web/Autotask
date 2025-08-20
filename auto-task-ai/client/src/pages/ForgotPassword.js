import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import './Auth.css';

function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { resetPassword } = useAuth();

  async function handleSubmit(e) {
    e.preventDefault();
    
    if (!email) {
      setError('Please enter your email address');
      return;
    }
    
    try {
      setError('');
      setSuccess('');
      setLoading(true);
      const result = await resetPassword(email);
      
      if (result.success) {
        setSuccess('Password reset email sent! Check your inbox for further instructions.');
        setEmail('');
      } else {
        setError(result.error);
      }
    } catch (error) {
      setError('Failed to send reset email. Please try again.');
    }
    
    setLoading(false);
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="logo-container">
            <span className="logo-icon">🤖</span>
            <h1>Auto Task AI</h1>
          </div>
          <h2>Reset Password</h2>
          <p>Enter your email to receive password reset instructions</p>
        </div>

        {error && (
          <div className="error-message">
            <span className="error-icon">⚠️</span>
            {error}
          </div>
        )}

        {success && (
          <div className="success-message">
            <span className="success-icon">✅</span>
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              placeholder="Enter your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
              'Send Reset Email'
            )}
          </button>
        </form>

        <div className="auth-footer">
          <p className="signup-prompt">
            Remember your password?{' '}
            <Link to="/login" className="signup-link">
              Sign in here
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

export default ForgotPassword;