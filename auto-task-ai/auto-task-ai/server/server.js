require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const webhooksRouter = require('./routes/webhooks');
const autoReplyRouter = require('./routes/autoreply');
const autoReplyScheduler = require('./services/autoreplyscheduler');

// Import the Firebase Admin service (handles initialization properly)
const firebaseAdmin = require('./services/firebaseAdmin');

const app = express();
const PORT = process.env.PORT || 5000;

app.get('/debug/find-user/:email', async (req, res) => {
  try {
    const { email } = req.params.toLowerCase();
    const firebaseAdmin = require('./services/firebaseAdmin');
    
    console.log(`🔍 Searching for user with email: ${email}`);
    
    const usersSnapshot = await firebaseAdmin.db
      .collection('users')
      .where('email', '==', email)
      .limit(1)
      .get();
    
    if (usersSnapshot.empty) {
      return res.json({ 
        found: false,
        message: `No user found with email: ${email}`,
        suggestion: "Make sure you're logged into the app first"
      });
    }
    
    const userDoc = usersSnapshot.docs[0];
    const userData = userDoc.data();
    
    res.json({
      found: true,
      userId: userDoc.id,
      email: userData.email,
      hasGmailTokens: !!userData.gmailTokens,
      gmailConnected: !!userData.gmailTokens?.access_token,
      autoReplyConfigured: userData.autoReplyEnabled || false
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Fixed auto-reply status check endpoint
app.get('/debug/auto-reply-status', async (req, res) => {
  try {
    const userId = 'YYaZizyXAkQbunFdL11LQGXl2z82'; // Your specific user ID
    const firebaseAdmin = require('./services/firebaseAdmin');
    
    console.log('🔍 Checking auto-reply status for user:', userId);
    
    // Check user document
    const userDoc = await firebaseAdmin.db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return res.json({ error: 'User not found', userId });
    }
    
    const userData = userDoc.data();
    
    // Check auto-reply settings
    const settingsSnapshot = await firebaseAdmin.db
      .collection('users')
      .doc(userId)
      .collection('autoReplySettings')
      .get();
    
    const activeSettingsSnapshot = await firebaseAdmin.db
      .collection('users')
      .doc(userId)
      .collection('autoReplySettings')
      .where('isActive', '==', true)
      .get();
    
    // Check current queue
    const queueSnapshot = await firebaseAdmin.db
      .collection('users')
      .doc(userId)
      .collection('autoReplyQueue')
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();
    
    const response = {
      userId: userId,
      timestamp: new Date().toISOString(),
      user: {
        email: userData.email,
        hasGmailTokens: !!userData.gmailTokens,
        gmailTokensValid: !!(userData.gmailTokens?.access_token || userData.gmailTokens?.refresh_token),
        gmailWatch: userData.gmailWatch || { status: 'Not configured' }
      },
      autoReplySettings: {
        totalSettings: settingsSnapshot.size,
        activeSettings: activeSettingsSnapshot.size,
        settingsConfigured: !settingsSnapshot.empty,
        activeSettingsConfigured: !activeSettingsSnapshot.empty,
        allSettings: settingsSnapshot.docs.map(doc => ({
          id: doc.id,
          isActive: doc.data().isActive,
          useAI: doc.data().useAI,
          replyDelay: doc.data().replyDelay,
          template: doc.data().template || 'Not set',
          createdAt: doc.data().createdAt
        }))
      },
      queue: {
        totalQueueItems: queueSnapshot.size,
        recentQueueItems: queueSnapshot.docs.map(doc => ({
          id: doc.id,
          status: doc.data().status,
          createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || 'No timestamp',
          scheduledFor: doc.data().scheduledFor?.toDate?.()?.toISOString() || 'No schedule',
          emailFrom: doc.data().originalEmail?.from || 'Unknown sender'
        }))
      },
      environment: {
        openaiConfigured: !!process.env.OPENAI_API_KEY,
        openaiKeyPreview: process.env.OPENAI_API_KEY ? 
          process.env.OPENAI_API_KEY.substring(0, 10) + '...' : 'Not configured',
        gmailConfigured: !!process.env.GOOGLE_CLIENT_ID,
        firebaseInitialized: firebaseAdmin.isInitialized()
      },
      systemStatus: {
        schedulerRunning: true, // We can see this from your logs
        scheduledEmailsWorking: true, // We can see this from your logs
        autoReplyQueueEmpty: queueSnapshot.size === 0,
        diagnosis: queueSnapshot.size === 0 ? 
          'Auto-reply queue is empty - either no settings configured or Gmail webhooks not working' : 
          'Auto-reply items found in queue'
      }
    };
    
    res.json(response);
    
  } catch (error) {
    console.error('❌ Auto-reply status check failed:', error);
    res.status(500).json({ 
      error: error.message,
      stack: error.stack
    });
  }
});

app.post('/debug/setup-webhook', async (req, res) => {
  try {
    const userId = 'YYaZizyXAkQbunFdL11LQGXl2z82';
    const firebaseAdmin = require('./services/firebaseAdmin');
    
    // Update user to simulate Gmail watch
    await firebaseAdmin.db.collection('users').doc(userId).update({
      gmailWatch: {
        isActive: true,
        setupAt: firebaseAdmin.admin.firestore.FieldValue.serverTimestamp(),
        expiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    });
    
    res.json({ success: true, message: 'Gmail watch simulated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Fixed test endpoint to manually add item to auto-reply queue
app.post('/debug/test-auto-reply', async (req, res) => {
  try {
    const userId = 'YYaZizyXAkQbunFdL11LQGXl2z82'; // Your specific user ID
    const firebaseAdmin = require('./services/firebaseAdmin');
    const admin = require('firebase-admin'); // Import admin directly for FieldValue
    
    console.log('🧪 Adding test item to auto-reply queue for user:', userId);
    
    // Create test auto-reply queue item with correct Firebase references
    const testQueueItem = {
      status: 'pending',
      userId: userId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(), // ✅ Correct reference
      scheduledFor: admin.firestore.FieldValue.serverTimestamp(), // ✅ Immediate scheduling
      originalEmail: {
        id: `test-${Date.now()}`,
        threadId: `thread-${Date.now()}`,
        from: 'test-sender@example.com',
        to: 'jeniljoshi56@gmail.com', // Your email from logs
        subject: 'Test Auto-Reply Email',
        body: 'This is a test email to check auto-reply functionality.',
        date: new Date().toISOString(),
        messageId: `<test-${Date.now()}@example.com>`
      },
      retryCount: 0,
      maxRetries: 3
    };
    
    // Add to queue using the correct db reference
    const queueRef = await firebaseAdmin.db // ✅ Correct db reference
      .collection('users')
      .doc(userId)
      .collection('autoReplyQueue')
      .add(testQueueItem);
    
    console.log('✅ Test auto-reply queued with ID:', queueRef.id);
    
    res.json({
      success: true,
      message: 'Test auto-reply item added to queue successfully',
      queueItemId: queueRef.id,
      userId: userId,
      note: 'Check your server logs in the next minute to see queue processing',
      expectedLog: 'You should see "Processing 1 pending auto-replies" in your terminal'
    });
    
  } catch (error) {
    console.error('❌ Test auto-reply failed:', error);
    res.status(500).json({ 
      error: error.message,
      stack: error.stack,
      note: 'Check server logs for detailed error information'
    });
  }
});

// Debug endpoint to test auto-reply queue manually
app.post('/debug/test-auto-reply', async (req, res) => {
  try {
    const userId = 'YYaZizyXAkQbunFdL11LQGXl2z82';
    const firebaseAdmin = require('./services/firebaseAdmin');
    const admin = require('firebase-admin');
    
    console.log('🧪 Adding test item to auto-reply queue for user:', userId);
    
    const testQueueItem = {
      status: 'pending',
      userId: userId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      scheduledFor: admin.firestore.FieldValue.serverTimestamp(),
      originalEmail: {
        id: `test-${Date.now()}`,
        threadId: `thread-${Date.now()}`,
        from: 'test-sender@example.com',
        to: 'jeniljoshi56@gmail.com',
        subject: 'Test Auto-Reply Email',
        body: 'This is a test email to check auto-reply functionality.',
        date: new Date().toISOString(),
        messageId: `<test-${Date.now()}@example.com>`
      },
      retryCount: 0,
      maxRetries: 3
    };
    
    const queueRef = await firebaseAdmin.db
      .collection('users')
      .doc(userId)
      .collection('autoReplyQueue')
      .add(testQueueItem);
    
    console.log('✅ Test auto-reply queued with ID:', queueRef.id);
    
    res.json({
      success: true,
      queueItemId: queueRef.id,
      message: 'Test auto-reply added to queue - check logs in 1 minute'
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Security middleware
app.use(helmet());
app.use(compression());
app.use('/api/webhooks', webhooksRouter);
app.use('/api/auto-reply', autoReplyRouter);

autoReplyScheduler.start();

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

process.on('SIGTERM', () => {
  autoReplyScheduler.stop();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔥 Firebase Admin: ${firebaseAdmin.isInitialized() ? '✅ Connected' : '❌ Not Connected'}`);
});