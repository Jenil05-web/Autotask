import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { testFirebaseConnection, checkEnvironmentVariables } from '../utils/firebaseTest';
import './Home.css';

const Home = () => {
  const { isAuthenticated } = useAuth();
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    
    try {
      // Check environment variables first
      const envCheck = checkEnvironmentVariables();
      if (!envCheck) {
        setTestResult({ success: false, error: 'Environment variables not properly configured' });
        return;
      }
      
      // Test Firebase connection
      const result = await testFirebaseConnection();
      setTestResult(result);
    } catch (error) {
      setTestResult({ success: false, error: error.message });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="home">
      <div className="hero-section">
        <div className="hero-content">
          <h1>Auto Task AI</h1>
          <p className="hero-subtitle">
            Automate your daily tasks with the power of artificial intelligence
          </p>
          <p className="hero-description">
            Streamline your workflow, boost productivity, and focus on what matters most. 
            Let AI handle the repetitive tasks while you achieve your goals.
          </p>
          
          <div className="cta-buttons">
            {!isAuthenticated ? (
              <>
                <Link to="/register" className="cta-button primary">
                  Get Started
                </Link>
                <Link to="/login" className="cta-button secondary">
                  Sign In
                </Link>
              </>
            ) : (
              <Link to="/dashboard" className="cta-button primary">
                Go to Dashboard
              </Link>
            )}
          </div>

          {/* Firebase Connection Test */}
          <div className="firebase-test-section">
            <button 
              onClick={handleTestConnection}
              disabled={testing}
              className="test-button"
            >
              {testing ? 'Testing...' : 'Test Firebase Connection'}
            </button>
            
            {testResult && (
              <div className={`test-result ${testResult.success ? 'success' : 'error'}`}>
                <strong>{testResult.success ? '✅ Success:' : '❌ Error:'}</strong>
                <span>{testResult.message || testResult.error}</span>
                {testResult.code && <span> (Code: {testResult.code})</span>}
              </div>
            )}
          </div>
        </div>
        
        <div className="hero-image">
          <div className="feature-cards">
            <div className="feature-card">
              <div className="feature-icon">🤖</div>
              <h3>AI-Powered</h3>
              <p>Advanced algorithms that learn and adapt to your workflow</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">⚡</div>
              <h3>Fast & Efficient</h3>
              <p>Complete tasks in seconds that used to take hours</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🔒</div>
              <h3>Secure</h3>
              <p>Your data is protected with enterprise-grade security</p>
            </div>
          </div>
        </div>
      </div>

      <div className="features-section">
        <h2>Why Choose Auto Task AI?</h2>
        <div className="features-grid">
          <div className="feature">
            <h3>Smart Automation</h3>
            <p>AI that understands context and makes intelligent decisions about task execution.</p>
          </div>
          <div className="feature">
            <h3>Seamless Integration</h3>
            <p>Works with your existing tools and workflows without disruption.</p>
          </div>
          <div className="feature">
            <h3>Real-time Analytics</h3>
            <p>Track performance and optimize your automation strategies.</p>
          </div>
          <div className="feature">
            <h3>24/7 Availability</h3>
            <p>Your AI assistant never sleeps, ensuring tasks are completed on time.</p>
          </div>
        </div>
      </div>

      <div className="cta-section">
        <h2>Ready to Transform Your Productivity?</h2>
        <p>Join thousands of users who have already automated their workflows</p>
        {!isAuthenticated && (
          <Link to="/register" className="cta-button primary large">
            Start Automating Today
          </Link>
        )}
      </div>
    </div>
  );
};

export default Home;