// Demo Authentication Context for development/testing
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
  const [loading, setLoading] = useState(false);

  // Demo login function
  const login = async (email, password) => {
    setLoading(true);
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (email && password) {
      setUser({
        uid: 'demo-user-123',
        email,
        displayName: email.split('@')[0],
        photoURL: null
      });
      setLoading(false);
      return { success: true };
    }
    
    setLoading(false);
    return { success: false, error: 'Invalid credentials' };
  };

  // Demo signup function
  const signup = async (email, password, displayName) => {
    setLoading(true);
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (email && password && displayName) {
      setUser({
        uid: 'demo-user-' + Date.now(),
        email,
        displayName,
        photoURL: null
      });
      setLoading(false);
      return { success: true };
    }
    
    setLoading(false);
    return { success: false, error: 'Invalid data' };
  };

  // Demo Google sign in
  const signInWithGoogle = async () => {
    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    setUser({
      uid: 'demo-google-user-123',
      email: 'demo@example.com',
      displayName: 'Demo User',
      photoURL: null
    });
    setLoading(false);
    return { success: true };
  };

  // Demo logout
  const logout = async () => {
    setUser(null);
    return { success: true };
  };

  // Demo password reset
  const resetPassword = async (email) => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    return { success: true };
  };

  // Demo profile update
  const updateUserProfile = async (data) => {
    if (user) {
      setUser({ ...user, ...data });
      return { success: true };
    }
    return { success: false, error: 'No user logged in' };
  };

  const value = {
    user,
    loading,
    signup,
    login,
    signInWithGoogle,
    resetPassword,
    logout,
    updateUserProfile,
    isAuthenticated: !!user
  };

  return (
    <DemoAuthContext.Provider value={value}>
      {children}
    </DemoAuthContext.Provider>
  );
};