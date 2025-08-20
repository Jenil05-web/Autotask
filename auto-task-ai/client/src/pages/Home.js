import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Home.css';

const Home = () => {
  const { isAuthenticated } = useAuth();

  return (
    <div className="home-container">
      <header className="hero-section">
        <div className="hero-content">
          <h1 className="hero-title">
            Automate Your Daily Tasks with <span className="highlight">AI</span>
          </h1>
          <p className="hero-description">
            Streamline your workflow, boost productivity, and let AI handle your repetitive tasks. 
            From email automation to file management, we've got you covered.
          </p>
          <div className="hero-actions">
            {isAuthenticated ? (
              <Link to="/dashboard" className="cta-button primary">
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link to="/register" className="cta-button primary">
                  Get Started Free
                </Link>
                <Link to="/login" className="cta-button secondary">
                  Sign In
                </Link>
              </>
            )}
          </div>
        </div>
        <div className="hero-visual">
          <div className="automation-demo">
            <div className="task-card">
              <div className="task-icon">📧</div>
              <span>Email Reports</span>
            </div>
            <div className="task-card">
              <div className="task-icon">📁</div>
              <span>File Backup</span>
            </div>
            <div className="task-card">
              <div className="task-icon">📊</div>
              <span>Data Analysis</span>
            </div>
            <div className="task-card">
              <div className="task-icon">🔄</div>
              <span>Sync Tasks</span>
            </div>
          </div>
        </div>
      </header>

      <section className="features-section">
        <div className="container">
          <h2 className="section-title">Why Choose Auto Task AI?</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">🤖</div>
              <h3>AI-Powered Automation</h3>
              <p>Leverage advanced AI to understand and automate your complex workflows with minimal setup.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">⚡</div>
              <h3>Lightning Fast</h3>
              <p>Execute tasks in seconds, not hours. Our optimized system handles multiple automations simultaneously.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🔒</div>
              <h3>Secure & Reliable</h3>
              <p>Enterprise-grade security ensures your data and automations are always protected and available.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📈</div>
              <h3>Smart Analytics</h3>
              <p>Track performance, identify bottlenecks, and optimize your automated workflows with detailed insights.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="stats-section">
        <div className="container">
          <div className="stats-grid">
            <div className="stat-item">
              <div className="stat-number">10K+</div>
              <div className="stat-label">Tasks Automated</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">500+</div>
              <div className="stat-label">Happy Users</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">99.9%</div>
              <div className="stat-label">Uptime</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">24/7</div>
              <div className="stat-label">Support</div>
            </div>
          </div>
        </div>
      </section>

      <section className="cta-section">
        <div className="container">
          <h2>Ready to Automate Your Life?</h2>
          <p>Join thousands of users who have already transformed their productivity.</p>
          {!isAuthenticated && (
            <Link to="/register" className="cta-button primary large">
              Start Your Free Trial
            </Link>
          )}
        </div>
      </section>
    </div>
  );
};

export default Home;