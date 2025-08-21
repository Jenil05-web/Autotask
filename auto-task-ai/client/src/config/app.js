// client/src/config/app.js
export const APP_CONFIG = {
  // Set to true to use demo authentication, false to use Firebase auth
  USE_DEMO_AUTH: false,
  
  // App metadata
  APP_NAME: 'AutoTask AI',
  VERSION: '1.0.0',
  
  // API endpoints
  API_BASE_URL: process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001',
  
  // Firebase config (will be overridden by environment variables if present)
  FIREBASE_CONFIG: {
    apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
    authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
    storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.REACT_APP_FIREBASE_APP_ID
  },
  
  // Feature flags
  FEATURES: {
    ENABLE_ANALYTICS: false,
    ENABLE_PUSH_NOTIFICATIONS: false,
    ENABLE_OFFLINE_MODE: false
  },
  
  // UI Configuration
  UI: {
    THEME: 'light',
    PRIMARY_COLOR: '#2196F3',
    SECONDARY_COLOR: '#FF9800'
  }
};

export default APP_CONFIG;