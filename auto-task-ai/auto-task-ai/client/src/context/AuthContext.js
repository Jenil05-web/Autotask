import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider,
  signOut, 
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/firebase.config.local.js';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Get additional user data from Firestore
        try {
          console.log('📋 Fetching user data from Firestore for:', user.uid);
          
          // Check if db is properly imported and initialized
          if (!db) {
            console.error('❌ Firestore db is not initialized');
            throw new Error('Firestore is not properly configured');
          }
          
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setUser({
              uid: user.uid,
              email: user.email,
              displayName: user.displayName,
              photoURL: user.photoURL,
              ...userData
            });
            console.log('📋 User data loaded from Firestore');
          } else {
            console.log('📋 No Firestore document found, using basic Firebase data');
            setUser({
              uid: user.uid,
              email: user.email,
              displayName: user.displayName,
              photoURL: user.photoURL
            });
          }
        } catch (error) {
          console.error('📋 Error fetching user data from Firestore:', error);
          // Fallback to basic user data if Firestore fails
          setUser({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL
          });
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Sign up with email and password
  const signup = async (email, password, displayName) => {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      
      // Update profile with display name
      await updateProfile(result.user, { displayName });
      
      // Create user document in Firestore
      try {
        if (db) {
          await setDoc(doc(db, 'users', result.user.uid), {
            email,
            displayName,
            createdAt: new Date().toISOString(),
            lastLogin: new Date().toISOString(),
            preferences: {
              theme: 'light',
              notifications: true
            }
          });
          console.log('📋 User document created in Firestore');
        }
      } catch (firestoreError) {
        console.error('📋 Error creating user document:', firestoreError);
        // Continue with signup even if Firestore write fails
      }

      return { success: true };
    } catch (error) {
      console.error('📋 Signup error:', error);
      return { 
        success: false, 
        error: getFirebaseErrorMessage(error.code) 
      };
    }
  };

  // Sign in with email and password
  const login = async (email, password) => {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      
      // Update last login time
      if (result.user && db) {
        try {
          await setDoc(doc(db, 'users', result.user.uid), {
            lastLogin: new Date().toISOString()
          }, { merge: true });
          console.log('📋 Last login time updated');
        } catch (firestoreError) {
          console.error('📋 Error updating login time:', firestoreError);
          // Continue with login even if Firestore write fails
        }
      }

      return { success: true };
    } catch (error) {
      console.error('📋 Login error:', error);
      return { 
        success: false, 
        error: getFirebaseErrorMessage(error.code) 
      };
    }
  };

  // Sign in with Google
  const signInWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      
      // Check if user document exists, if not create one
      if (db) {
        try {
          const userDoc = await getDoc(doc(db, 'users', result.user.uid));
          if (!userDoc.exists()) {
            await setDoc(doc(db, 'users', result.user.uid), {
              email: result.user.email,
              displayName: result.user.displayName,
              photoURL: result.user.photoURL,
              createdAt: new Date().toISOString(),
              lastLogin: new Date().toISOString(),
              preferences: {
                theme: 'light',
                notifications: true
              }
            });
            console.log('📋 New Google user document created');
          } else {
            // Update last login time
            await setDoc(doc(db, 'users', result.user.uid), {
              lastLogin: new Date().toISOString()
            }, { merge: true });
            console.log('📋 Google user login time updated');
          }
        } catch (firestoreError) {
          console.error('📋 Error handling Google user document:', firestoreError);
          // Continue with login even if Firestore operations fail
        }
      }

      return { success: true };
    } catch (error) {
      console.error('📋 Google sign-in error:', error);
      return { 
        success: false, 
        error: getFirebaseErrorMessage(error.code) 
      };
    }
  };

  // Reset password
  const resetPassword = async (email) => {
    try {
      await sendPasswordResetEmail(auth, email);
      return { success: true };
    } catch (error) {
      console.error('📋 Password reset error:', error);
      return { 
        success: false, 
        error: getFirebaseErrorMessage(error.code) 
      };
    }
  };

  // Sign out
  const logout = async () => {
    try {
      await signOut(auth);
      return { success: true };
    } catch (error) {
      console.error('📋 Logout error:', error);
      return { 
        success: false, 
        error: getFirebaseErrorMessage(error.code) 
      };
    }
  };

  // Update user profile
  const updateUserProfile = async (updates) => {
    try {
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, updates);
        
        // Update Firestore document
        if (db) {
          try {
            await setDoc(doc(db, 'users', auth.currentUser.uid), updates, { merge: true });
            console.log('📋 User profile updated in Firestore');
          } catch (firestoreError) {
            console.error('📋 Error updating Firestore document:', firestoreError);
            // Continue with profile update even if Firestore write fails
          }
        }
        
        // Update local state
        setUser(prev => ({ ...prev, ...updates }));
        
        return { success: true };
      }
      return { success: false, error: 'No user logged in' };
    } catch (error) {
      console.error('📋 Profile update error:', error);
      return { 
        success: false, 
        error: getFirebaseErrorMessage(error.code) 
      };
    }
  };

  // Helper function to get user-friendly error messages
  const getFirebaseErrorMessage = (errorCode) => {
    switch (errorCode) {
      case 'auth/user-not-found':
        return 'No account found with this email address.';
      case 'auth/wrong-password':
        return 'Incorrect password. Please try again.';
      case 'auth/email-already-in-use':
        return 'An account with this email already exists.';
      case 'auth/weak-password':
        return 'Password should be at least 6 characters long.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/too-many-requests':
        return 'Too many failed attempts. Please try again later.';
      case 'auth/popup-closed-by-user':
        return 'Sign-in was cancelled. Please try again.';
      case 'auth/popup-blocked':
        return 'Pop-up was blocked. Please allow pop-ups and try again.';
      default:
        return 'An error occurred. Please try again.';
    }
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
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};