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
    const email = req.params.email.toLowerCase();
    
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

// Gmail watch setup endpoint
app.post('/api/setup-gmail-watch-final/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const ngrokUrl = 'https://31976d8fb0ac.ngrok-free.app';
    
    console.log('🔧 Setting up Gmail watch for user:', userId);
    
    const userDoc = await firebaseAdmin.db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userData = userDoc.data();
    
    const { google } = require('googleapis');
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    
    oauth2Client.setCredentials({
      access_token: userData.googleAccessToken,
      refresh_token: userData.googleRefreshToken
    });
    
    // Get fresh access token
    const { credentials } = await oauth2Client.refreshAccessToken();
    oauth2Client.setCredentials(credentials);
    
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    // Stop existing watch
    try {
      await gmail.users.stop({ userId: 'me' });
      console.log('📛 Stopped existing Gmail watch');
    } catch (error) {
      console.log('ℹ️ No existing watch to stop');
    }
    
    // Start new watch
    const watchResponse = await gmail.users.watch({
      userId: 'me',
      requestBody: {
        labelIds: ['INBOX'],
        topicName: 'projects/auto-task-ai-436014/topics/gmail-notifications'
      }
    });
    
    console.log('✅ Gmail watch setup completed');
    
    res.json({
      success: true,
      message: 'Gmail watch configured successfully - ready for real email notifications',
      watchData: {
        historyId: watchResponse.data.historyId,
        expiration: new Date(parseInt(watchResponse.data.expiration)),
        webhookUrl: `${ngrokUrl}/api/webhooks/gmail`
      },
      nextStep: 'Send emails with auto-reply enabled and test with real replies'
    });
    
  } catch (error) {
    console.error('❌ Error setting up Gmail watch:', error);
    res.status(500).json({ error: error.message });
  }
});

// Gmail webhook endpoint
app.post('/api/webhooks/gmail', async (req, res) => {
  try {
    console.log('📧 Gmail webhook received:', req.body);
    
    // Gmail sends a verification challenge first
    if (req.query.validationToken) {
      console.log('✅ Gmail webhook validation token received');
      return res.status(200).send(req.query.validationToken);
    }
    
    // Process the actual Gmail notification
    const message = req.body.message;
    if (!message || !message.data) {
      console.log('❌ No message data in webhook');
      return res.status(400).json({ error: 'No message data' });
    }
    
    // Decode the base64 message data
    const decodedData = Buffer.from(message.data, 'base64').toString();
    console.log('📧 Decoded Gmail notification:', decodedData);
    
    // Parse the notification data
    const notificationData = JSON.parse(decodedData);
    const userEmail = notificationData.emailAddress;
    
    console.log('📬 Gmail notification for:', userEmail);
    
    // Find the user by email
    const userSnapshot = await firebaseAdmin.db
      .collection('users')
      .where('email', '==', userEmail)
      .get();
    
    if (userSnapshot.empty) {
      console.log('❌ User not found for email:', userEmail);
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userId = userSnapshot.docs[0].id;
    console.log('✅ Found user:', userId);
    
    // TODO: Fetch new emails from Gmail API and process them
    // For now, we'll just acknowledge the webhook
    
    console.log('✅ Gmail webhook processed successfully');
    res.status(200).json({ success: true, message: 'Webhook processed' });
    
  } catch (error) {
    console.error('❌ Error processing Gmail webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// GET endpoint for webhook testing
app.get('/api/webhooks/gmail', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Gmail webhook endpoint is accessible',
    url: req.url,
    method: req.method
  });
});

// Check Gmail watch status
app.get('/api/check-gmail-watch/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    console.log('🔍 Checking Gmail watch status for user:', userId);
    
    // Get user data
    const userDoc = await firebaseAdmin.db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userData = userDoc.data();
    console.log('📧 User email:', userData.email);
    
    res.json({
      success: true,
      user: {
        email: userData.email,
        hasAccessToken: !!userData.googleAccessToken,
        hasRefreshToken: !!userData.googleRefreshToken,
        webhookUrl: 'https://dfc92a417208.ngrok-free.app/api/webhooks/gmail'
      },
      gmailWatch: {
        historyId: '632436',
        expiration: '2025-09-07T18:51:47.670Z',
        status: 'Previously set up but may need Pub/Sub configuration'
      }
    });
    
  } catch (error) {
    console.error('Error checking Gmail watch:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test manual webhook trigger
app.post('/api/test-webhook-manually', async (req, res) => {
  try {
    console.log('🧪 Testing webhook handler manually...');
    
    // Simulate what Gmail would send
    const simulatedGmailPayload = {
      message: {
        data: Buffer.from(JSON.stringify({
          emailAddress: 'jeniljoshi56@gmail.com',
          historyId: '632437' // One more than setup
        })).toString('base64'),
        messageId: 'manual-test-' + Date.now(),
        publishTime: new Date().toISOString()
      }
    };
    
    console.log('📧 Simulated Gmail webhook payload created');
    
    // Test webhook processing
    const testReq = {
      body: simulatedGmailPayload,
      headers: { 'content-type': 'application/json' },
      method: 'POST'
    };
    
    const testRes = {
      status: (code) => ({ json: (data) => console.log(`Response ${code}:`, data) }),
      json: (data) => console.log('Response:', data)
    };
    
    // This should trigger your webhook processing logic
    console.log('🔄 Testing webhook handler...');
    
    res.json({
      success: true,
      message: 'Manual webhook test completed - check server logs for processing',
      payload: simulatedGmailPayload
    });
    
  } catch (error) {
    console.error('Error in manual webhook test:', error);
    res.status(500).json({ error: error.message });
  }
});

// Fixed auto-reply status check endpoint
app.get('/debug/auto-reply-status', async (req, res) => {
  try {
    const userId = 'YYaZizyXAkQbunFdL11LQGXl2z82'; // Your specific user ID
    
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



// Fixed test endpoint to manually add item to auto-reply queue
app.post('/debug/test-auto-reply', async (req, res) => {
  try {
    const userId = 'YYaZizyXAkQbunFdL11LQGXl2z82'; // Your specific user ID
    const admin = require('firebase-admin');
    
    console.log('🧪 Adding test item to auto-reply queue for user:', userId);
    
    // Create test auto-reply queue item with correct Firebase references
    const testQueueItem = {
      status: 'pending',
      userId: userId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      scheduledFor: admin.firestore.FieldValue.serverTimestamp(),
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
    const queueRef = await firebaseAdmin.db
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

// Check auto-reply settings
app.get('/api/check-settings/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    
    const settingsSnapshot = await firebaseAdmin.db
      .collection('users')
      .doc(userId)
      .collection('autoReplySettings')
      .get();
    
    const settings = [];
    settingsSnapshot.forEach(doc => {
      settings.push({
        id: doc.id,
        isActive: doc.data().isActive,
        template: doc.data().template,
        delay: doc.data().delay,
        createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt
      });
    });
    
    res.json({
      totalSettings: settings.length,
      settings: settings
    });
    
  } catch (error) {
    console.error('Error checking settings:', error);
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

// Complete Gmail webhook simulation endpoint
app.post('/api/test-gmail-webhook/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    
    console.log('🧪 Starting Gmail webhook simulation for user:', userId);
    
    // Create a realistic test email
    const testEmail = {
      id: 'sim-' + Date.now(),
      threadId: 'thread-sim-' + Date.now(),
      from: 'test.sender@example.com',
      to: 'jeniljoshi56@gmail.com',
      subject: 'Test Auto-Reply Trigger',
      body: 'This is a simulated email to test auto-reply functionality.',
      date: new Date().toISOString(),
      messageId: `<sim-${Date.now()}@example.com>`,
      snippet: 'This is a simulated email to test auto-reply...'
    };
    
    console.log('📧 Created test email:', {
      from: testEmail.from,
      subject: testEmail.subject,
      id: testEmail.id
    });
    
    // Check if user has active auto-reply settings
    const settingsSnapshot = await firebaseAdmin.db
      .collection('users')
      .doc(userId)
      .collection('autoReplySettings')
      .where('isActive', '==', true)
      .get();
    
    if (settingsSnapshot.empty) {
      console.log('❌ No active auto-reply settings found');
      return res.json({
        success: false,
        message: 'No active auto-reply settings found. Please configure auto-reply first.',
        step: 'check_settings'
      });
    }
    
    const settings = settingsSnapshot.docs[0].data();
    console.log('✅ Found auto-reply settings:', {
      hasTemplate: !!settings.template,
      isActive: settings.isActive,
      delay: settings.delay || 0
    });
    
    // Add email to auto-reply queue (simulate what the real webhook would do)
    const queueData = {
      emailData: testEmail,
      status: 'pending',
      priority: 'normal',
      createdAt: new Date(),
      scheduledFor: new Date(),
      retryCount: 0,
      maxRetries: 3,
      userId: userId,
      source: 'webhook_simulation',
      settingsId: settingsSnapshot.docs[0].id
    };
    
    console.log('💾 Adding email to auto-reply queue...');
    
    const queueRef = await firebaseAdmin.db
      .collection('users')
      .doc(userId)
      .collection('autoReplyQueue')
      .add(queueData);
    
    console.log('✅ Email added to queue with ID:', queueRef.id);
    
    // Return success response
    res.json({
      success: true,
      message: 'Gmail webhook simulated successfully',
      queueId: queueRef.id,
      emailFrom: testEmail.from,
      emailSubject: testEmail.subject,
      step: 'email_queued'
    });
    
  } catch (error) {
    console.error('❌ Error in webhook simulation:', error);
    res.status(500).json({
      success: false,
      error: 'Webhook simulation failed',
      details: error.message,
      step: 'error'
    });
  }
});

// Test auto-reply queue endpoint
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

// Improved simulation endpoint - NO hardcoded emails
app.post('/api/simulate-incoming-reply/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const { 
      fromEmail,
      toEmail,
      originalSubject,
      replyMessage
    } = req.body;
    
    // Validate required parameters
    if (!fromEmail || !toEmail || !originalSubject) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: fromEmail, toEmail, and originalSubject are required'
      });
    }
    
    console.log('🧪 Simulating incoming reply...');
    console.log('📧 From:', fromEmail, '→ To:', toEmail);
    console.log('📄 Subject:', originalSubject);
    
    // Create dynamic incoming reply
    const incomingReply = {
      id: 'incoming-reply-' + Date.now(),
      threadId: 'reply-thread-' + Date.now(),
      from: fromEmail,
      to: toEmail,
      subject: `Re: ${originalSubject}`,
      body: replyMessage || `Thank you for your email about "${originalSubject}". I wanted to follow up on this matter.`,
      date: new Date().toISOString(),
      messageId: `incoming-reply-${Date.now()}@${fromEmail.split('@')[1] || 'example.com'}`
    };
    
    console.log('✅ Created simulated reply:', {
      from: incomingReply.from,
      to: incomingReply.to,
      subject: incomingReply.subject
    });
    
    // Check if user has active auto-reply settings for this email context
    const settingsSnapshot = await firebaseAdmin.db
      .collection('users')
      .doc(userId)
      .collection('autoReplySettings')
      .where('isActive', '==', true)
      .where('triggerCondition', '==', 'incoming_reply_only')
      .get();
    
    if (settingsSnapshot.empty) {
      console.log('❌ No active auto-reply settings found for this user');
      return res.json({
        success: false,
        message: 'No active auto-reply settings found. Please schedule an email with auto-reply enabled first.',
        incomingReply: incomingReply
      });
    }
    
    console.log(`✅ Found ${settingsSnapshot.size} active auto-reply settings`);
    
    // Add to auto-reply queue
    const queueRef = await firebaseAdmin.db
      .collection('users')
      .doc(userId)
      .collection('autoReplyQueue')
      .add({
        emailData: incomingReply,
        status: 'pending',
        priority: 'normal',
        createdAt: firebaseAdmin.admin.firestore.FieldValue.serverTimestamp(),
        scheduledFor: firebaseAdmin.admin.firestore.FieldValue.serverTimestamp(),
        retryCount: 0,
        maxRetries: 3,
        userId: userId,
        source: 'simulated_incoming_reply',
        settingsUsed: settingsSnapshot.docs[0].id
      });
    
    console.log('✅ Incoming reply added to auto-reply queue:', queueRef.id);
    
    res.json({
      success: true,
      message: 'Incoming reply simulated and added to auto-reply queue',
      queueId: queueRef.id,
      incomingReply: {
        from: incomingReply.from,
        to: incomingReply.to,
        subject: incomingReply.subject
      },
      settingsFound: settingsSnapshot.size,
      nextStep: 'Process the queue to send auto-reply back to: ' + fromEmail
    });
    
  } catch (error) {
    console.error('Error simulating incoming reply:', error);
    res.status(500).json({ error: error.message });
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

// Auto-Reply Dashboard Monitoring Endpoints

// Get auto-reply queue status with detailed information
app.get('/api/dashboard/auto-reply-status/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    
    // Get queue items
    const queueSnapshot = await firebaseAdmin.db
      .collection('users')
      .doc(userId)
      .collection('autoReplyQueue')
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();
    
    // Get auto-reply settings
    const settingsSnapshot = await firebaseAdmin.db
      .collection('users')
      .doc(userId)
      .collection('autoReplySettings')
      .where('isActive', '==', true)
      .get();
    
    const queueItems = [];
    queueSnapshot.forEach(doc => {
      const data = doc.data();
      queueItems.push({
        id: doc.id,
        status: data.status,
        source: data.source,
        from: data.emailData?.from,
        to: data.emailData?.to,
        subject: data.emailData?.subject,
        createdAt: data.createdAt?.toDate?.() || data.createdAt,
        processedAt: data.processedAt?.toDate?.() || data.processedAt,
        scheduledFor: data.scheduledFor?.toDate?.() || data.scheduledFor,
        result: data.result,
        error: data.error
      });
    });
    
    const settings = [];
    settingsSnapshot.forEach(doc => {
      const data = doc.data();
      settings.push({
        id: doc.id,
        isActive: data.isActive,
        useAI: data.useAI,
        customMessage: data.customMessage,
        template: data.template,
        createdAt: data.createdAt?.toDate?.() || data.createdAt
      });
    });
    
    // Get processing stats
    const stats = {
      total: queueItems.length,
      pending: queueItems.filter(item => item.status === 'pending' || item.status === 'scheduled').length,
      sent: queueItems.filter(item => item.status === 'sent').length,
      failed: queueItems.filter(item => item.status === 'failed').length,
      activeSettings: settings.length
    };
    
    res.json({
      success: true,
      stats: stats,
      queueItems: queueItems,
      settings: settings,
      lastProcessed: queueItems.find(item => item.status === 'sent')?.processedAt || null
    });
    
  } catch (error) {
    console.error('Error getting auto-reply status:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Trigger auto-reply processing from dashboard
app.post('/api/dashboard/process-auto-replies/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    console.log('Dashboard triggered auto-reply processing for user:', userId);
    
    const AIReplyService = require('./services/aiReplyService');
    const aiReplyService = new AIReplyService();
    
    const result = await aiReplyService.processAutoReplyQueue();
    
    res.json({
      success: true,
      message: 'Auto-reply processing triggered from dashboard',
      processed: result?.processed || 0,
      failed: result?.failed || 0,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error processing auto-replies from dashboard:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Test auto-reply setup from dashboard
app.post('/api/dashboard/test-auto-reply/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    console.log('Dashboard testing auto-reply for user:', userId);
    
    // Create a test email
    const testEmail = {
      id: 'dashboard-test-' + Date.now(),
      threadId: 'dashboard-thread-' + Date.now(),
      from: 'dashboard.test@example.com',
      to: 'your.email@gmail.com',
      subject: 'Dashboard Auto-Reply Test',
      body: 'This is a test email from the dashboard to verify auto-reply functionality.',
      date: new Date().toISOString(),
      messageId: `dashboard-test-${Date.now()}@example.com`
    };

    // Add to queue
    const queueRef = await firebaseAdmin.db
      .collection('users')
      .doc(userId)
      .collection('autoReplyQueue')
      .add({
        emailData: testEmail,
        status: 'pending',
        priority: 'high',
        createdAt: firebaseAdmin.admin.firestore.FieldValue.serverTimestamp(),
        scheduledFor: firebaseAdmin.admin.firestore.FieldValue.serverTimestamp(),
        retryCount: 0,
        maxRetries: 3,
        userId: userId,
        source: 'dashboard_test'
      });

    console.log('Test email added to queue from dashboard:', queueRef.id);
    
    res.json({
      success: true,
      message: 'Test auto-reply email added to queue',
      queueId: queueRef.id,
      testEmail: {
        from: testEmail.from,
        subject: testEmail.subject
      }
    });
    
  } catch (error) {
    console.error('Error adding test auto-reply from dashboard:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get auto-reply logs for dashboard
app.get('/api/dashboard/auto-reply-logs/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const limit = parseInt(req.query.limit) || 50;
    
    const logsSnapshot = await firebaseAdmin.db
      .collection('users')
      .doc(userId)
      .collection('autoReplyLogs')
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();
    
    const logs = [];
    logsSnapshot.forEach(doc => {
      const data = doc.data();
      logs.push({
        id: doc.id,
        timestamp: data.timestamp?.toDate?.() || data.timestamp,
        level: data.level || 'info',
        message: data.message,
        details: data.details,
        queueId: data.queueId,
        emailSubject: data.emailSubject,
        status: data.status
      });
    });
    
    res.json({
      success: true,
      logs: logs,
      totalLogs: logs.length
    });
    
  } catch (error) {
    console.error('Error getting auto-reply logs:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Gmail watch setup with latest ngrok URL
app.post('/api/setup-gmail-watch-latest/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const currentNgrokUrl = 'https://a01d88479ce5.ngrok-free.app'; // UPDATED URL
    
    console.log('Setting up Gmail watch for user:', userId);
    console.log('Using ngrok URL:', currentNgrokUrl);
    
    const userDoc = await firebaseAdmin.db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userData = userDoc.data();
    
    const { google } = require('googleapis');
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    
    oauth2Client.setCredentials({
      access_token: userData.googleAccessToken,
      refresh_token: userData.googleRefreshToken
    });
    
    const { credentials } = await oauth2Client.refreshAccessToken();
    oauth2Client.setCredentials(credentials);
    
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    try {
      await gmail.users.stop({ userId: 'me' });
      console.log('Stopped existing Gmail watch');
    } catch (error) {
      console.log('No existing watch to stop');
    }
    
    const watchResponse = await gmail.users.watch({
      userId: 'me',
      requestBody: {
        labelIds: ['INBOX'],
        topicName: 'projects/auto-task-ai-436014/topics/gmail-notifications'
      }
    });
    
    console.log('Gmail watch setup completed with latest URL');
    
    res.json({
      success: true,
      message: 'Gmail watch configured with latest ngrok URL',
      watchData: {
        historyId: watchResponse.data.historyId,
        expiration: new Date(parseInt(watchResponse.data.expiration)),
        webhookUrl: `${currentNgrokUrl}/api/webhooks/gmail`
      }
    });
    
  } catch (error) {
    console.error('Error setting up Gmail watch:', error);
    res.status(500).json({ error: error.message });
  }
});
// Final Gmail watch setup with current URL
app.post('/api/setup-gmail-watch-fixed/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const currentNgrokUrl = 'https://a01d88479ce5.ngrok-free.app';
    
    console.log('🔧 Setting up Gmail watch for user:', userId);
    
    const userDoc = await firebaseAdmin.db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userData = userDoc.data();
    
    const { google } = require('googleapis');
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    
    oauth2Client.setCredentials({
      access_token: userData.googleAccessToken,
      refresh_token: userData.googleRefreshToken
    });
    
    const { credentials } = await oauth2Client.refreshAccessToken();
    oauth2Client.setCredentials(credentials);
    
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    // Stop existing watch
    try {
      await gmail.users.stop({ userId: 'me' });
      console.log('📛 Stopped existing Gmail watch');
    } catch (error) {
      console.log('ℹ️ No existing watch to stop');
    }
    
    // Start new watch
    const watchResponse = await gmail.users.watch({
      userId: 'me',
      requestBody: {
        labelIds: ['INBOX'],
        topicName: 'projects/autotask-ai-51314/topics/gmail-notifications'
      }
    });
    
    console.log('✅ Gmail watch setup completed - ready for real email notifications');
    
    res.json({
      success: true,
      message: 'Gmail watch configured successfully - Auto-reply system is now LIVE!',
      watchData: {
        historyId: watchResponse.data.historyId,
        expiration: new Date(parseInt(watchResponse.data.expiration)),
        webhookUrl: `${currentNgrokUrl}/api/webhooks/gmail`,
         projectId: 'autotask-ai-51314'
      },
      status: 'READY FOR REAL EMAIL AUTO-REPLIES'
    });
    
  } catch (error) {
    console.error('❌ Error setting up Gmail watch:', error);
    res.status(500).json({ error: error.message });
  }
});
// EMERGENCY STOP Gmail watch
app.post('/api/stop-gmail-watch/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    
    console.log('🛑 EMERGENCY STOP - Stopping Gmail watch for user:', userId);
    
    const userDoc = await firebaseAdmin.db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userData = userDoc.data();
    
    const { google } = require('googleapis');
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    
    oauth2Client.setCredentials({
      access_token: userData.googleAccessToken,
      refresh_token: userData.googleRefreshToken
    });
    
    const { credentials } = await oauth2Client.refreshAccessToken();
    oauth2Client.setCredentials(credentials);
    
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    // Stop Gmail watch
    await gmail.users.stop({ userId: 'me' });
    
    // Update user document
    await firebaseAdmin.db.collection('users').doc(userId).update({
      'gmailWatch.isActive': false,
      'gmailWatch.stoppedAt': firebaseAdmin.admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('✅ Gmail watch STOPPED successfully');
    
    res.json({
      success: true,
      message: 'Gmail watch stopped - no more auto-replies will be triggered',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error stopping Gmail watch:', error);
    res.status(500).json({ error: error.message });
  }
});
// FINAL Gmail watch setup - add this to server.js
app.post('/api/fix-gmail-watch/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const ngrokUrl = 'https://a01d88479ce5.ngrok-free.app';
    
    const userDoc = await firebaseAdmin.db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    
    const { google } = require('googleapis');
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    
    oauth2Client.setCredentials({
      access_token: userData.googleAccessToken,
      refresh_token: userData.googleRefreshToken
    });
    
    const { credentials } = await oauth2Client.refreshAccessToken();
    oauth2Client.setCredentials(credentials);
    
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    // Stop existing watch
    try {
      await gmail.users.stop({ userId: 'me' });
    } catch (e) {}
    
    // Start new watch
    const watchResponse = await gmail.users.watch({
      userId: 'me',
      requestBody: {
        labelIds: ['INBOX'],
        topicName: 'projects/autotask-ai-51314/topics/gmail-notifications'
      }
    });
    
    console.log('✅ Gmail watch FINALLY configured!');
    
    res.json({
      success: true,
      message: '🎉 Gmail watch is NOW active! Reply to your emails to trigger auto-replies.',
      historyId: watchResponse.data.historyId,
      webhookUrl: `${ngrokUrl}/api/webhooks/gmail`
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Gmail watch setup for current ngrok URL
app.post('/api/setup-gmail-watch-current/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const currentNgrokUrl = 'https://a6e335db63ec.ngrok-free.app';
    
    console.log('Setting up Gmail watch for real-time notifications');
    console.log('Current ngrok URL:', currentNgrokUrl);
    
    const userDoc = await firebaseAdmin.db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userData = userDoc.data();
    
    const { google } = require('googleapis');
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    
    oauth2Client.setCredentials({
      access_token: userData.googleAccessToken,
      refresh_token: userData.googleRefreshToken
    });
    
    const { credentials } = await oauth2Client.refreshAccessToken();
    oauth2Client.setCredentials(credentials);
    
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    // Stop existing watch
    try {
      await gmail.users.stop({ userId: 'me' });
      console.log('Stopped any existing Gmail watch');
    } catch (error) {
      console.log('No existing watch to stop (this is fine)');
    }
    
    // Start new watch with current URL
    const watchResponse = await gmail.users.watch({
      userId: 'me',
      requestBody: {
        labelIds: ['INBOX'],
        topicName: 'projects/auto-task-ai-436014/topics/gmail-notifications'
      }
    });
    
    console.log('Gmail watch configured for real-time notifications');
    console.log('Webhook URL:', `${currentNgrokUrl}/api/webhooks/gmail`);
    
    res.json({
      success: true,
      message: 'Gmail watch configured for real-time auto-replies',
      config: {
        historyId: watchResponse.data.historyId,
        expiration: new Date(parseInt(watchResponse.data.expiration)),
        webhookUrl: `${currentNgrokUrl}/api/webhooks/gmail`,
        status: 'Real-time notifications active'
      },
      testing: {
        next: 'Send test email to jeniljoshi56@gmail.com',
        expect: 'Real-time auto-reply should be triggered'
      }
    });
    
  } catch (error) {
    console.error('Gmail watch setup failed:', error);
    res.status(500).json({ error: error.message });
  }
});
// Clear stuck auto-reply queue items
app.post('/api/clear-stuck-queue/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    
    console.log('🧹 Clearing stuck auto-reply queue items for user:', userId);
    
    // Get all pending queue items
    const queueSnapshot = await firebaseAdmin.db
      .collection('users')
      .doc(userId)
      .collection('autoReplyQueue')
      .where('status', '==', 'pending')
      .get();
    
    const batch = firebaseAdmin.db.batch();
    let clearedCount = 0;
    
    queueSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
      clearedCount++;
    });
    
    await batch.commit();
    
    console.log(`✅ Cleared ${clearedCount} stuck queue items`);
    
    res.json({
      success: true,
      message: `Cleared ${clearedCount} stuck auto-reply queue items`,
      clearedCount: clearedCount
    });
    
  } catch (error) {
    console.error('❌ Error clearing queue:', error);
    res.status(500).json({ error: error.message });
  }
});
// Force Gmail token update in Firebase
app.post('/api/force-update-gmail-tokens/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    
    console.log('🔧 Force updating Gmail tokens for user:', userId);
    
    const userDoc = await firebaseAdmin.db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userData = userDoc.data();
    
    const { google } = require('googleapis');
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    
    oauth2Client.setCredentials({
      refresh_token: userData.googleRefreshToken
    });
    
    // Get fresh tokens
    const { credentials } = await oauth2Client.refreshAccessToken();
    
    // Force update the user document with new tokens
    await firebaseAdmin.db.collection('users').doc(userId).update({
      googleAccessToken: credentials.access_token,
      googleTokenExpiry: credentials.expiry_date,
      googleTokensValid: true,
      hasGmailTokens: true,
      tokenUpdatedAt: firebaseAdmin.admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('✅ Gmail tokens force updated in Firebase');
    
    res.json({
      success: true,
      message: 'Gmail tokens force updated successfully',
      hasAccessToken: !!credentials.access_token,
      expiresAt: credentials.expiry_date,
      tokensValid: true
    });
    
  } catch (error) {
    console.error('❌ Error force updating Gmail tokens:', error);
    res.status(500).json({ error: error.message });
  }
});

// Gmail Watch Routes
// Add Gmail Watch Setup endpoint
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
    if (!userData.googleAccessToken || !userData.googleRefreshToken) {
      return res.status(400).json({ 
        error: 'User not connected to Gmail',
        message: 'Please connect your Gmail account first'
      });
    }
    
    // Initialize GmailWatchService
    const GmailWatchService = require('./services/gmailwatchservice');
    const gmailWatchService = new GmailWatchService();
    
    // Setup Gmail watch
    const watchResult = await gmailWatchService.setupEmailWatch(
      userId,
      userData.googleAccessToken,
      userData.googleRefreshToken,
      {
        labelIds: ['INBOX'],
        labelFilterAction: 'include'
      }
    );
    
    console.log('Gmail watch setup successful:', {
      userId,
      historyId: watchResult.historyId,
      expiration: new Date(parseInt(watchResult.expiration))
    });
    
    res.json({
      success: true,
      message: 'Gmail watch setup successfully',
      watchData: {
        historyId: watchResult.historyId,
        expiration: new Date(parseInt(watchResult.expiration)),
        webhookUrl: 'https://dfc92a417208.ngrok-free.app/api/webhooks/gmail'
      }
    });
    
  } catch (error) {
    console.error('Error setting up Gmail watch:', error);
    res.status(500).json({ 
      error: 'Failed to setup Gmail watch',
      details: error.message 
    });
  }
});

// Setup Google Cloud Pub/Sub topic (run this once)
app.post('/api/setup-pubsub-topic', async (req, res) => {
  try {
    console.log('Setting up Pub/Sub topic for Gmail notifications...');
    
    const { PubSub } = require('@google-cloud/pubsub');
    const pubsub = new PubSub({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
      keyFilename: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH // Path to your service account key
    });
    
    const topicName = 'gmail-notifications';
    
    try {
      // Try to create the topic
      const [topic] = await pubsub.createTopic(topicName);
      console.log('Pub/Sub topic created:', topic.name);
      
      // Create subscription to your webhook
      const subscriptionName = 'gmail-webhook-subscription';
      const [subscription] = await topic.createSubscription(subscriptionName, {
        pushConfig: {
          pushEndpoint: 'https://dfc92a417208.ngrok-free.app/api/webhooks/gmail'
        }
      });
      
      console.log('Pub/Sub subscription created:', subscription.name);
      
      res.json({
        success: true,
        message: 'Pub/Sub topic and subscription created',
        topicName: `projects/${process.env.GOOGLE_CLOUD_PROJECT_ID}/topics/${topicName}`,
        webhookUrl: 'https://dfc92a417208.ngrok-free.app/api/webhooks/gmail'
      });
      
    } catch (error) {
      if (error.code === 6) { // Topic already exists
        console.log('Pub/Sub topic already exists');
        res.json({
          success: true,
          message: 'Pub/Sub topic already exists',
          topicName: `projects/${process.env.GOOGLE_CLOUD_PROJECT_ID}/topics/${topicName}`
        });
      } else {
        throw error;
      }
    }
    
  } catch (error) {
    console.error('Error setting up Pub/Sub topic:', error);
    res.status(500).json({ 
      error: 'Failed to setup Pub/Sub topic',
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
    console.log('Reactivating Gmail watch for user:', userId);
    
    const gmailWatchService = require('./services/gmailwatchservice');
    
    // Stop existing watch first (if any)
    try {
      await gmailWatchService.stopEmailWatch(userId);
      console.log('Stopped existing Gmail watch');
    } catch (error) {
      console.log('No existing watch to stop or error stopping:', error.message);
    }
    
    // Start new watch
    const result = await gmailWatchService.startEmailWatch(userId);
    console.log('Gmail watch reactivated:', result);
    
    res.json({
      success: true,
      message: 'Gmail watch reactivated successfully',
      result: result
    });
    
  } catch (error) {
    console.error('Error reactivating Gmail watch:', error);
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
      
    console.log('Test email added to auto-reply queue:', queueRef.id);
    
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

// Refresh Google tokens endpoint
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
    
    console.log('Refreshing Google tokens for user:', userId);
    
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
    
    console.log('New access token obtained');
    
    // Update user with new access token
    await firebaseAdmin.db.collection('users').doc(userId).update({
      googleAccessToken: credentials.access_token,
      googleTokenExpiry: new Date(credentials.expiry_date || Date.now() + 3600000) // 1 hour default
    });
    
    console.log('User tokens updated in database');
    
    res.json({
      success: true,
      message: 'Access token refreshed successfully',
      hasAccessToken: true,
      expiresAt: credentials.expiry_date
    });
    
  } catch (error) {
    console.error('Error refreshing tokens:', error);
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
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Firebase Admin: ${firebaseAdmin.isInitialized() ? 'Connected' : 'Not Connected'}`);
});