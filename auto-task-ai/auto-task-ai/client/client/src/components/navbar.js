// client/src/components/Navbar.js
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function Navbar() {
  const { currentUser, logout, userProfile } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Failed to log out:', error);
    }
  }

  return (
    <nav style={{
      backgroundColor: '#282c34',
      padding: '1rem 2rem',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      color: 'white'
    }}>
      <div>
        <Link to="/" style={{ color: 'white', textDecoration: 'none', fontSize: '1.5rem', fontWeight: 'bold' }}>
          Auto Task AI
        </Link>
      </div>
      
      {currentUser ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <Link to="/create-task" style={{ color: 'white', textDecoration: 'none' }}>
            Create Task
          </Link>
          <Link to="/profile" style={{ color: 'white', textDecoration: 'none' }}>
            Profile
          </Link>
          <span>Hello, {userProfile?.displayName || currentUser.email}</span>
          <button
            onClick={handleLogout}
            style={{
              backgroundColor: '#f44336',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Logout
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '10px' }}>
          <Link to="/login" style={{ color: 'white', textDecoration: 'none' }}>
            Login
          </Link>
          <Link to="/register" style={{ color: 'white', textDecoration: 'none' }}>
            Register
          </Link>
        </div>
      )}
    </nav>
  );
}

export default Navbar;