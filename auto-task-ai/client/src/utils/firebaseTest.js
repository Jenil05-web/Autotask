// Firebase connection test utility
import { auth, db } from '../firebase/config';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';

export const testFirebaseConnection = async () => {
  console.log('Testing Firebase connection...');
  
  try {
    // Test authentication
    console.log('Testing authentication...');
    const authResult = await signInAnonymously(auth);
    console.log('Authentication successful:', authResult.user.uid);
    
    // Test Firestore read
    console.log('Testing Firestore read...');
    const testDoc = await getDoc(doc(db, 'test', 'connection'));
    console.log('Firestore read successful');
    
    // Test Firestore write
    console.log('Testing Firestore write...');
    await setDoc(doc(db, 'test', 'connection'), {
      timestamp: new Date().toISOString(),
      test: true
    });
    console.log('Firestore write successful');
    
    // Clean up - sign out
    await auth.signOut();
    console.log('Firebase connection test completed successfully');
    
    return { success: true, message: 'All Firebase services working correctly' };
  } catch (error) {
    console.error('Firebase connection test failed:', error);
    return { 
      success: false, 
      error: error.message,
      code: error.code 
    };
  }
};

export const checkEnvironmentVariables = () => {
  const required = [
    'REACT_APP_FIREBASE_API_KEY',
    'REACT_APP_FIREBASE_AUTH_DOMAIN',
    'REACT_APP_FIREBASE_PROJECT_ID',
    'REACT_APP_FIREBASE_STORAGE_BUCKET',
    'REACT_APP_FIREBASE_MESSAGING_SENDER_ID',
    'REACT_APP_FIREBASE_APP_ID'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('Missing environment variables:', missing);
    return false;
  }
  
  console.log('All environment variables are set');
  return true;
};