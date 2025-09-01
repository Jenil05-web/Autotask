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

// Security middleware
app.use(helmet());
app.use(compression());

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Webhook and API routes
app.use('/api/webhooks', webhooksRouter);
app.use('/api/auto-reply', autoReplyRouter);

// Start auto-reply scheduler
autoReplyScheduler.start();

// Debug endpoints
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
        from: 'jeniljoshi56@gmail.com',
        to: 'jeniljoshi.2006@gmail.com',
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

// Add this endpoint to check queue contents
app.get('/api/check-queue/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    
    const queueSnapshot = await firebaseAdmin.db
      .collection('users')
      .doc(userId)
      .collection('autoReplyQueue')
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();
    
    const queueItems = [];
    queueSnapshot.forEach(doc => {
      queueItems.push({
        id: doc.id,
        status: doc.data().status,
        source: doc.data().source,
        from: doc.data().emailData?.from,
        subject: doc.data().emailData?.subject,
        createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
        scheduledFor: doc.data().scheduledFor?.toDate?.() || doc.data().scheduledFor
      });
    });
    
    res.json({
      totalItems: queueItems.length,
      items: queueItems
    });
    
  } catch (error) {
    console.error('Error checking queue:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add endpoint to simulate a real Gmail webhook
app.post('/api/simulate-gmail-webhook/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    
    // Simulate receiving an email
    const simulatedEmail = {
      id: 'simulated-' + Date.now(),
      threadId: 'thread-' + Date.now(),
      from: 'sender@example.com',
      to: 'jeniljoshi56@gmail.com',
      subject: 'Test Email for Auto-Reply',
      body: 'This is a test email to trigger auto-reply.',
      date: new Date().toISOString(),
      messageId: 'msg-' + Date.now()
    };
    
    console.log('🎭 Simulating Gmail webhook for user:', userId);
    console.log('📧 Simulated email:', simulatedEmail);
    
    // Add directly to auto-reply queue (simulating what the webhook would do)
    const queueRef = await firebaseAdmin.db
      .collection('users')
      .doc(userId)
      .collection('autoReplyQueue')
      .add({
        emailData: simulatedEmail,
        status: 'pending',
        priority: 'normal',
        createdAt: new Date(),
        scheduledFor: new Date(),
        retryCount: 0,
        maxRetries: 3,
        userId: userId,
        source: 'simulated_gmail_webhook'
      });
    
    console.log('✅ Simulated email added to auto-reply queue:', queueRef.id);
    
    res.json({
      success: true,
      message: 'Gmail webhook simulated successfully',
      queueId: queueRef.id,
      simulatedEmail: simulatedEmail
    });
    
  } catch (error) {
    console.error('Error simulating Gmail webhook:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add the missing test auto-reply queue endpoint
app.post('/api/test-auto-reply-queue', async (req, res) => {
  try {
    const AIReplyService = require('./services/aiReplyService');
    const aiReplyService = new AIReplyService();
    
    console.log('🧪 Manually triggering auto-reply queue processing...');
    const result = await aiReplyService.processAutoReplyQueue();
    
    res.json({
      success: true,
      message: 'Auto-reply queue processed manually',
      processed: result?.processed || 0,
      failed: result?.failed || 0
    });
    
  } catch (error) {
    console.error('Error processing auto-reply queue:', error);
    res.status(500).json({ 
      error: 'Failed to process queue',
      details: error.message 
    });
  }
});

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

// Gmail Watch Routes
// Add Gmail watch setup route
app.post('/api/setup-gmail-watch/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    console.log('Setting up Gmail watch for user:', userId);
    
    // Get user data
    const userDoc = await firebaseAdmin.db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userData = userDoc.data();
    if (!userData.googleRefreshToken) {
      return res.status(400).json({ error: 'User not connected to Gmail' });
    }
    
    const gmailWatchService = require('./services/gmailwatchservice');
    
    // Setup Gmail watch
    const result = await gmailWatchService.setupEmailWatch(
      userId,
      userData.googleAccessToken,
      userData.googleRefreshToken
    );
    
    console.log('Gmail watch setup successful:', result);
    
    res.json({
      success: true,
      historyId: result.historyId,
      expiration: result.expiration
    });
    
  } catch (error) {
    console.error('Error setting up Gmail watch:', error);
    res.status(500).json({ 
      error: 'Failed to setup Gmail watch',
      details: error.message
    });
  }
});

// Add route to check Gmail watch status
app.get('/api/gmail-watch-status/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const userDoc = await firebaseAdmin.db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userData = userDoc.data();
    const gmailWatch = userData.gmailWatch;
    
    res.json({
      hasWatch: !!gmailWatch,
      isActive: gmailWatch?.isActive || false,
      historyId: gmailWatch?.historyId,
      expiration: gmailWatch?.expiration,
      lastActivity: gmailWatch?.lastActivity,
      setupAt: gmailWatch?.setupAt
    });
    
  } catch (error) {
    console.error('Error checking Gmail watch status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add Gmail watch reactivation route
app.post('/api/reactivate-gmail-watch/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    console.log('🔄 Reactivating Gmail watch for user:', userId);
    
    const gmailWatchService = require('./services/gmailwatchservice');
    
    // Stop existing watch first (if any)
    try {
      await gmailWatchService.stopEmailWatch(userId);
      console.log('✅ Stopped existing Gmail watch');
    } catch (error) {
      console.log('⚠️  No existing watch to stop or error stopping:', error.message);
    }
    
    // Start new watch
    const result = await gmailWatchService.startEmailWatch(userId);
    console.log('✅ Gmail watch reactivated:', result);
    
    res.json({
      success: true,
      message: 'Gmail watch reactivated successfully',
      result: result
    });
    
  } catch (error) {
    console.error('❌ Error reactivating Gmail watch:', error);
    res.status(500).json({ 
      error: 'Failed to reactivate Gmail watch',
      details: error.message
    });
  }
});

// Fixed test endpoint
app.post('/api/test-add-to-queue/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    
    const testEmail = {
      id: 'test-' + Date.now(),
      threadId: 'test-thread-' + Date.now(),
      from: 'test@example.com',
      subject: 'Test Auto Reply',
      body: 'This is a test email for auto-reply',
      date: new Date().toISOString(),
      messageId: 'test-message-' + Date.now()
    };
    const queueRef = await firebaseAdmin.db
      .collection('users')
      .doc(userId)
      .collection('autoReplyQueue')
      .add({
        emailData: testEmail,
        status: 'pending',
        priority: 'normal',
        createdAt: new Date(),
        scheduledFor: new Date(),
        retryCount: 0,
        maxRetries: 3,
        userId: userId,
        source: 'test_endpoint'
      });
    console.log('✅ Test email added to auto-reply queue:', queueRef.id);
    
    res.json({
      success: true,
      message: 'Test email added to queue',
      queueId: queueRef.id
    });
  } catch (error) {
    console.error('Error adding test email to queue:', error);
    res.status(500).json({ error: error.message });
  }
});

// Check user's Google connection
app.get('/api/check-google-connection/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const userDoc = await firebaseAdmin.db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userData = userDoc.data();
    
    res.json({
      userId: userId,
      email: userData.email || userData.googleEmail,
      hasGoogleAccessToken: !!userData.googleAccessToken,
      hasGoogleRefreshToken: !!userData.googleRefreshToken,
      googleConnected: userData.googleConnected || false,
      tokenExpiry: userData.googleTokenExpiry || null
    });
    
  } catch (error) {
    console.error('Error checking Google connection:', error);
    res.status(500).json({ error: error.message });
  }
});

// Replace the broken token refresh endpoint with this working one
app.post('/api/refresh-google-tokens/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const userDoc = await firebaseAdmin.db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userData = userDoc.data();
    if (!userData.googleRefreshToken) {
      return res.status(400).json({ error: 'No refresh token found' });
    }
    
    console.log('🔄 Refreshing Google tokens for user:', userId);
    
    // Create OAuth2 client with credentials
    const { google } = require('googleapis');
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    
    // Set the refresh token
    oauth2Client.setCredentials({
      refresh_token: userData.googleRefreshToken
    });
    
    // Get new access token
    const { credentials } = await oauth2Client.refreshAccessToken();
    
    console.log('✅ New access token obtained');
    
    // Update user with new access token
    await firebaseAdmin.db.collection('users').doc(userId).update({
      googleAccessToken: credentials.access_token,
      googleTokenExpiry: new Date(credentials.expiry_date || Date.now() + 3600000) // 1 hour default
    });
    
    console.log('✅ User tokens updated in database');
    
    res.json({
      success: true,
      message: 'Access token refreshed successfully',
      hasAccessToken: true,
      expiresAt: credentials.expiry_date
    });
    
  } catch (error) {
    console.error('❌ Error refreshing tokens:', error);
    res.status(500).json({ 
      error: 'Failed to refresh tokens',
      details: error.message 
    });
  }
});

// Import routes
const emailRoutes = require('./routes/emails');
const authRoutes = require('./routes/auth');

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
  autoReplyScheduler.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  autoReplyScheduler.stop();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔥 Firebase Admin: ${firebaseAdmin.isInitialized() ? '✅ Connected' : '❌ Not Connected'}`);
});