// firebase.config.local.js - Updated to export auth instance
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

// This file contains the secret Firebase keys for local development.
// It is git-ignored to prevent secrets from being committed.

export const localFirebaseConfig = {
  apiKey: "AIzaSyDNdxPqZoaK3q-c8VU9QQM5ZuiYfBboo7k",
  authDomain: "autotask-ai-51314.firebaseapp.com",
  projectId: "autotask-ai-51314",
  storageBucket: "autotask-ai-51314.appspot.com",
  messagingSenderId: "988691502448",
  appId: "1:988691502448:web:b0f222d6b5c1aec1baabb5",
  measurementId: "G-B6ZC75PH1J"
};

// Initialize Firebase
const app = initializeApp(localFirebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Export the app as default
export default app;