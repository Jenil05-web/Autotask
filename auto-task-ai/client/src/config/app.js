// Application configuration
export const APP_CONFIG = {
  // Set to true to use demo authentication (no Firebase required)
  USE_DEMO_AUTH: !process.env.REACT_APP_FIREBASE_PROJECT_ID || process.env.REACT_APP_FIREBASE_PROJECT_ID === 'demo-project',
  
  // Firebase configuration check
  FIREBASE_CONFIGURED: !!(
    process.env.REACT_APP_FIREBASE_API_KEY &&
    process.env.REACT_APP_FIREBASE_PROJECT_ID &&
    process.env.REACT_APP_FIREBASE_PROJECT_ID !== 'demo-project'
  ),
  
  // API endpoints
  API_BASE_URL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
  
  // App settings
  APP_NAME: 'Auto Task AI',
  VERSION: '1.0.0'
};