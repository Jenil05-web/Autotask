import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// --- TEMPORARY TEST CONFIGURATION ---
// We are hardcoding the keys to bypass the .env file loading issue for a test.
const firebaseConfig = {
  apiKey: "AIzaSyDNdxPqZoaK3q-c8VU9QQM5ZuiYfBboo7k",
  authDomain: "autotask-ai-51314.firebaseapp.com",
  projectId: "autotask-ai-51314",
  storageBucket: "autotask-ai-51314.appspot.com",
  messagingSenderId: "988691502448",
  appId: "1:988691502448:web:b0f222d6b5c1aec1baabb5",
  measurementId: "G-B6ZC75PH1J"
};
// --- END OF TEST CONFIGURATION ---

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };