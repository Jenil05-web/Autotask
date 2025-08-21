// client/src/firebase/config.js
import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
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

// Warn in dev if any Firebase env vars are missing
const missingKeys = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);
if (missingKeys.length > 0 && typeof window !== 'undefined') {
  // eslint-disable-next-line no-console
  console.warn(
    `[Firebase] Missing env vars: ${missingKeys.join(', ')}. ` +
    'Create client/.env and restart the dev server (see FIREBASE_SETUP.md).'
  );
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Auth with persistent session
export const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch(() => {
  // Non-fatal if persistence cannot be set
});

// Firestore with long polling to avoid 400/offline issues in some networks
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
  useFetchStreams: false
});

// Storage
export const storage = getStorage(app);

export default app;