 // client/src/firebase/config.js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
};

// Basic runtime validation for env vars to avoid silent crashes
const requiredKeys = [
  'REACT_APP_FIREBASE_API_KEY',
  'REACT_APP_FIREBASE_AUTH_DOMAIN',
  'REACT_APP_FIREBASE_PROJECT_ID',
  'REACT_APP_FIREBASE_STORAGE_BUCKET',
  'REACT_APP_FIREBASE_MESSAGING_SENDER_ID',
  'REACT_APP_FIREBASE_APP_ID'
];

export const isFirebaseConfigured = requiredKeys.every((key) => !!process.env[key]);

if (!isFirebaseConfigured) {
  // eslint-disable-next-line no-console
  console.warn('[Firebase] Missing environment variables. Firebase will not initialize.');
}

// Initialize Firebase
const app = isFirebaseConfigured ? initializeApp(firebaseConfig) : undefined;

// Initialize Firebase services (with long polling fallback for stricter networks)
let auth, db, storage;
if (app) {
  auth = getAuth(app);
  // Use initializeFirestore to enable long polling fallback
  try {
    db = initializeFirestore(app, {
      experimentalForceLongPolling: true,
      useFetchStreams: false
    });
  } catch (e) {
    // Fallback to default if initializeFirestore fails
    db = getFirestore(app);
  }
  storage = getStorage(app);
}

export { auth, db, storage };
export default app;
