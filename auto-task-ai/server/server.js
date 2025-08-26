const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
require('dotenv').config();

// Import the Firebase Admin service (handles initialization properly)
const firebaseAdmin = require('./services/firebaseAdmin');

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet());
app.use(compression());

// Logging middleware
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Import routes
const emailRoutes = require('./routes/emails');
const authRoutes = require('./routes/auth');

// Basic routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'Auto Task AI Server is running!',
    firebase: firebaseAdmin.isInitialized() ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/tasks', (req, res) => {
  res.json({
    tasks: [
      { id: 1, name: 'Send daily email report', status: 'active' },
      { id: 2, name: 'Backup files to cloud', status: 'paused' }
    ]
  });
});

// Debug route for environment variables
app.get('/debug/env', (req, res) => {
  res.json({
    hasClientId: !!process.env.GOOGLE_CLIENT_ID,
    hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
    hasRedirectUri: !!process.env.GOOGLE_REDIRECT_URI,
    hasFirebaseProjectId: !!process.env.FIREBASE_PROJECT_ID,
    hasFirebaseServiceAccount: !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
    clientIdPreview: process.env.GOOGLE_CLIENT_ID ? process.env.GOOGLE_CLIENT_ID.substring(0, 20) + '...' : 'MISSING',
    redirectUri: process.env.GOOGLE_REDIRECT_URI,
    firebaseInitialized: firebaseAdmin.isInitialized()
  });
});

// API routes
app.use('/api/emails', emailRoutes);
app.use('/api/auth', authRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'Something went wrong!' 
      : err.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔥 Firebase Admin: ${firebaseAdmin.isInitialized() ? '✅ Connected' : '❌ Not Connected'}`);
});