// client/src/context/DemoAuthContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';

const DemoAuthContext = createContext();

export const useDemoAuth = () => {
  const context = useContext(DemoAuthContext);
  if (!context) {
    throw new Error('useDemoAuth must be used within a DemoAuthProvider');
  }
  return context;
};

export const DemoAuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Demo user data
  const demoUser = {
    uid: 'demo-user-123',
    email: 'demo@example.com',
    displayName: 'Demo User',
    photoURL: null,
    emailVerified: true
  };

  const demoUserProfile = {
    uid: 'demo-user-123',
    displayName: 'Demo User',
    email: 'demo@example.com',
    createdAt: {
      toDate: () => new Date('2024-01-01')
    },
    tasksCount: 5,
    subscription: 'Demo Account'
  };

  // Initialize with demo user
  useEffect(() => {
    setUser(demoUser);
    setUserProfile(demoUserProfile);
  }, []);

  const login = async (email, password) => {
    setLoading(true);
    setError(null);
    
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // For demo, accept any email/password
      setUser(demoUser);
      setUserProfile(demoUserProfile);
      return { user: demoUser };
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const register = async (email, password, displayName) => {
    setLoading(true);
    setError(null);
    
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const newUser = {
        ...demoUser,
        email,
        displayName: displayName || 'Demo User'
      };
      
      const newUserProfile = {
        ...demoUserProfile,
        email,
        displayName: displayName || 'Demo User'
      };
      
      setUser(newUser);
      setUserProfile(newUserProfile);
      return { user: newUser };
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 500));
      setUser(null);
      setUserProfile(null);
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (email) => {
    setLoading(true);
    setError(null);
    
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      // For demo, just return success
      return { success: true, message: 'Password reset email sent (demo)' };
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (updates) => {
    setLoading(true);
    setError(null);
    
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const updatedUser = { ...user, ...updates };
      const updatedProfile = { ...userProfile, ...updates };
      
      setUser(updatedUser);
      setUserProfile(updatedProfile);
      return { user: updatedUser };
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const value = {
    user,
    userProfile,
    loading,
    error,
    login,
    register,
    logout,
    resetPassword,
    updateProfile,
    isAuthenticated: !!user
  };

  return (
    <DemoAuthContext.Provider value={value}>
      {children}
    </DemoAuthContext.Provider>
  );
};

export default DemoAuthProvider;