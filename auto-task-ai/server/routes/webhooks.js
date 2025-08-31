const express = require('express');
const router = express.Router();
const gmailWatchService = require('../services/gmailwatchservice');
const firebaseService = require('../services/firebaseAdmin');
const { google } = require('googleapis');
const admin = require('firebase-admin');

// Middleware for webhook verification (if using Pub/Sub)
const verifyWebhook = (req, res, next) => {
  // Add your webhook verification logic here if needed
  // For Google Pub/Sub, you might want to verify the JWT token
  next();
};

// Rate limiting for webhooks
const webhookRateLimit = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 100;

const isRateLimited = (identifier) => {
  const now = Date.now();
  const key = `webhook_${identifier}`;
  
  if (!webhookRateLimit.has(key)) {
    webhookRateLimit.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return false;
  }
  
  const limit = webhookRateLimit.get(key);
  
  if (now > limit.resetTime) {
    webhookRateLimit.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return false;
  }
  
  if (limit.count >= MAX_REQUESTS_PER_WINDOW) {
    return true;
  }
  
  limit.count++;
  return false;
};

// Gmail push notification webhook
router.post('/gmail', verifyWebhook, async (req, res) => {
  let decodedData = null;
  let userEmail = null;
  
  try {
    console.log('Gmail webhook received:', {
      headers: req.headers,
      body: req.body,
      timestamp: new Date().toISOString(),
      contentType: req.headers['content-type'],
      userAgent: req.headers['user-agent']
    });
    
    // Validate request structure
    const message = req.body.message;
    if (!message || !message.data) {
      console.error('Invalid webhook message format:', req.body);
      return res.status(400).json({ 
        error: 'Invalid message format',
        message: 'Missing message or message.data field'
      });
    }

    // Decode the message
    try {
      const decodedString = Buffer.from(message.data, 'base64').toString();
      decodedData = JSON.parse(decodedString);
      console.log('Decoded webhook data:', decodedData);
    } catch (decodeError) {
      console.error('Failed to decode webhook message:', decodeError);
      return res.status(400).json({
        error: 'Failed to decode message',
        details: decodeError.message
      });
    }

    // Validate decoded data structure
    if (!decodedData.emailAddress || !decodedData.historyId) {
      console.error('Invalid decoded data structure:', decodedData);
      return res.status(400).json({
        error: 'Invalid notification data',
        message: 'Missing emailAddress or historyId'
      });
    }

    userEmail = decodedData.emailAddress;
    console.log('Processing webhook for email:', userEmail);

    // Rate limiting check
    if (isRateLimited(userEmail)) {
      console.warn(`Rate limit exceeded for user: ${userEmail}`);
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'Too many webhook requests'
      });
    }

    // Find user by email address
    console.log('Finding user by email:', userEmail);
    const userId = await findUserByEmail(userEmail);
    if (!userId) {
      console.error(`No user found for email: ${userEmail}`);
      return res.status(404).json({
        error: 'User not found',
        message: 'No registered user found for this email address'
      });
    }
    console.log('User found:', userId);

    // Get user data for tokens
    const userDoc = await firebaseService.db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      console.error('User document not found:', userId);
      throw new Error('User document not found');
    }

    const userData = userDoc.data();
    console.log('User data check:', {
      hasGoogleRefreshToken: !!userData.googleRefreshToken,
      hasGmailWatch: !!userData.gmailWatch,
      googleConnected: userData.googleConnected
    });

    if (!userData.googleRefreshToken) {
      console.error('No Google refresh token found for user:', userId);
      throw new Error('No Google refresh token found for user');
    }

    // Check if gmailWatchService has processHistoryChanges method
    if (typeof gmailWatchService.processHistoryChanges === 'function') {
      console.log('Processing history changes via GmailWatchService...');
      await gmailWatchService.processHistoryChanges(
        userId,
        decodedData.historyId,
        userData.googleAccessToken, // If you have access token
        userData.googleRefreshToken
      );
    } else {
      console.log('GmailWatchService.processHistoryChanges not found, processing manually...');
      await processHistoryChangesManually(userId, decodedData.historyId, userData.googleRefreshToken);
    }
    
    // Log successful webhook processing
    await logWebhookActivity(userId, decodedData, 'success');
    console.log('Webhook processing completed successfully');

    res.status(200).json({ 
      status: 'success',
      message: 'Webhook processed successfully',
      historyId: decodedData.historyId,
      userId: userId
    });

  } catch (error) {
    console.error('Gmail webhook error:', error);
    console.error('Error stack:', error.stack);
    
    // Log error webhook activity
    if (userEmail) {
      try {
        const userId = await findUserByEmail(userEmail);
        if (userId) {
          await logWebhookActivity(userId, decodedData, 'error', error.message);
        }
      } catch (logError) {
        console.error('Failed to log webhook error:', logError);
      }
    }

    // Don't expose internal errors to client
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to process webhook'
    });
  }
});

/**
 * Manual history processing if gmailWatchService doesn't have the method
 */
async function processHistoryChangesManually(userId, historyId, refreshToken) {
  try {
    console.log('Processing history changes manually for user:', userId);
    
    // Initialize Google OAuth client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      refresh_token: refreshToken
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Get user's stored history ID
    const userDoc = await firebaseService.db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const storedHistoryId = userData.gmailWatch?.historyId;

    if (!storedHistoryId) {
      console.log('No stored history ID found, using current historyId');
    }

    const startHistoryId = storedHistoryId || historyId;
    console.log(`Fetching history from ${startHistoryId} to ${historyId}`);

    // Fetch history
    const historyResponse = await gmail.users.history.list({
      userId: 'me',
      startHistoryId: startHistoryId,
      historyTypes: ['messageAdded'],
      maxResults: 100
    });

    const history = historyResponse.data.history || [];
    console.log(`Found ${history.length} history records`);

    // Process each history record
    for (const record of history) {
      if (record.messagesAdded) {
        for (const messageRecord of record.messagesAdded) {
          const message = messageRecord.message;
          console.log('Processing new message:', message.id);
          
          // Get full message details
          const messageDetails = await gmail.users.messages.get({
            userId: 'me',
            id: message.id,
            format: 'full'
          });

          // Check if this is an incoming email (not sent by user)
          const headers = messageDetails.data.payload.headers;
          const fromHeader = headers.find(h => h.name.toLowerCase() === 'from');
          const toHeader = headers.find(h => h.name.toLowerCase() === 'to');
          const subjectHeader = headers.find(h => h.name.toLowerCase() === 'subject');

          if (fromHeader && toHeader) {
            const fromEmail = extractEmailFromHeader(fromHeader.value);
            const userEmail = userData.googleEmail;

            // Only process if this is an incoming email (not sent by the user)
            if (fromEmail && fromEmail.toLowerCase() !== userEmail?.toLowerCase()) {
              console.log('Adding incoming email to auto-reply queue:', {
                from: fromEmail,
                subject: subjectHeader?.value,
                messageId: message.id
              });

              // Add to auto-reply queue
              await addToAutoReplyQueue(userId, messageDetails.data, fromEmail);
            } else {
              console.log('Skipping outgoing email from user');
            }
          }
        }
      }
    }

    // Update stored history ID
    await firebaseService.db.collection('users').doc(userId).update({
      'gmailWatch.historyId': historyId,
      'gmailWatch.lastProcessed': admin.firestore.FieldValue.serverTimestamp()
    });

    console.log('History processing completed');

  } catch (error) {
    console.error('Error in manual history processing:', error);
    throw error;
  }
}

/**
 * Add email to auto-reply queue
 */
async function addToAutoReplyQueue(userId, messageData, fromEmail) {
  try {
    const headers = messageData.payload.headers;
    const subjectHeader = headers.find(h => h.name.toLowerCase() === 'subject');
    const dateHeader = headers.find(h => h.name.toLowerCase() === 'date');
    
    // Extract message body
    let messageBody = '';
    if (messageData.payload.body.data) {
      messageBody = Buffer.from(messageData.payload.body.data, 'base64').toString();
    } else if (messageData.payload.parts) {
      // Handle multipart messages
      for (const part of messageData.payload.parts) {
        if (part.mimeType === 'text/plain' && part.body.data) {
          messageBody = Buffer.from(part.body.data, 'base64').toString();
          break;
        }
      }
    }

    const emailData = {
      id: messageData.id,
      threadId: messageData.threadId,
      from: fromEmail,
      subject: subjectHeader?.value || 'No Subject',
      body: messageBody,
      date: dateHeader?.value || new Date().toISOString(),
      messageId: messageData.id,
      internalDate: messageData.internalDate
    };

    // Add to queue
    const queueRef = await firebaseService.db
      .collection('users')
      .doc(userId)
      .collection('autoReplyQueue')
      .add({
        emailData: emailData,
        status: 'pending',
        priority: 'normal',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        scheduledFor: admin.firestore.FieldValue.serverTimestamp(),
        retryCount: 0,
        maxRetries: 3,
        userId: userId,
        source: 'gmail_webhook'
      });
console.log('✅ Email added to auto-reply queue:', {
  queueId: queueRef.id,
  from: fromEmail,
  subject: subjectHeader?.value,
  status: 'pending'
});
    console.log('Email added to auto-reply queue:', queueRef.id);
    return queueRef.id;

  } catch (error) {
    console.error('Error adding to auto-reply queue:', error);
    throw error;
  }
}

/**
 * Extract email address from header value
 */
function extractEmailFromHeader(headerValue) {
  const emailRegex = /[\w\.-]+@[\w\.-]+\.\w+/;
  const match = headerValue.match(emailRegex);
  return match ? match[0] : null;
}

/**
 * Find user ID by email address
 */
async function findUserByEmail(email) {
  try {
    console.log('Searching for user with email:', email);
    
    // First try: Find by main email field
    const usersRef = firebaseService.db.collection('users');
    let querySnapshot = await usersRef
      .where('email', '==', email)
      .limit(1)
      .get();

    if (!querySnapshot.empty) {
      console.log('Found user by email field');
      return querySnapshot.docs[0].id;
    }

    // Second try: Find by googleEmail field
    querySnapshot = await usersRef
      .where('googleEmail', '==', email)
      .limit(1)
      .get();
      
    if (!querySnapshot.empty) {
      console.log('Found user by googleEmail field');
      return querySnapshot.docs[0].id;
    }

    console.log('No user found for email:', email);
    return null;
    
  } catch (error) {
    console.error('Error finding user by email:', error);
    return null;
  }
}

/**
 * Log webhook activity for monitoring
 */
async function logWebhookActivity(userId, webhookData, status, errorMessage = null) {
  try {
    await firebaseService.db
      .collection('users')
      .doc(userId)
      .collection('webhookLogs')
      .add({
        emailAddress: webhookData?.emailAddress,
        historyId: webhookData?.historyId,
        status: status,
        error: errorMessage,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        processingTime: Date.now()
      });
    console.log('Webhook activity logged');
  } catch (error) {
    console.error('Error logging webhook activity:', error);
    // Don't throw here as it's just logging
  }
}

// Manual webhook test endpoint - ADDED
router.post('/manual-test/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    
    // Fix the destructuring issue
    let testEmail = 'test@example.com'; // Default value
    
    // Safely check if req.body exists and has testEmail
    if (req.body && req.body.testEmail) {
      testEmail = req.body.testEmail;
    }
    
    console.log('Manual webhook test started for user:', userId);
    console.log('Using test email:', testEmail);
    console.log('Request body:', req.body);
    
    // Add to auto-reply queue with correct Firebase timestamp
    const queueRef = await firebaseService.db
      .collection('users')
      .doc(userId)
      .collection('autoReplyQueue')
      .add({
        emailData: {
          id: `test-${Date.now()}`,
          threadId: `thread-test-${Date.now()}`,
          from: testEmail,
          subject: 'Manual Test Email - Auto Reply Test',
          body: 'This is a manual test email to trigger auto-reply.',
          date: new Date().toISOString(),
          messageId: `test-${Date.now()}`,
          internalDate: Date.now().toString()
        },
        status: 'pending',
        priority: 'normal',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        scheduledFor: admin.firestore.FieldValue.serverTimestamp(),
        retryCount: 0,
        maxRetries: 3,
        userId: userId,
        source: 'manual_test'
      });
    
    console.log('Manual test completed, queue ID:', queueRef.id);
    
    res.json({
      success: true,
      message: 'Manual test email added to auto-reply queue',
      queueId: queueRef.id,
      testEmail: testEmail
    });
    
  } catch (error) {
    console.error('Manual webhook test failed:', error);
    console.error('Error details:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Check auto-reply queue status - ADDED
router.get('/queue-status/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    
    // Get pending queue items
    const queueSnapshot = await firebaseService.db
      .collection('users')
      .doc(userId)
      .collection('autoReplyQueue')
      .where('status', '==', 'pending')
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();
    
    const pendingItems = [];
    queueSnapshot.forEach(doc => {
      pendingItems.push({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString()
      });
    });
    
    // Get processed queue items
    const processedSnapshot = await firebaseService.db
      .collection('users')
      .doc(userId)
      .collection('autoReplyQueue')
      .where('status', '!=', 'pending')
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get();
    
    const processedItems = [];
    processedSnapshot.forEach(doc => {
      processedItems.push({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString()
      });
    });
    
    res.json({
      success: true,
      userId: userId,
      pending: {
        count: pendingItems.length,
        items: pendingItems
      },
      processed: {
        count: processedItems.length,
        items: processedItems
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error checking queue status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test webhook endpoint for manual testing
router.post('/test', async (req, res) => {
  try {
    console.log('Test webhook endpoint called');
    
    // Simulate a Gmail notification
    const testNotification = {
      message: {
        data: Buffer.from(JSON.stringify({
          emailAddress: 'jeniljoshi56@gmail.com', // Use your test email
          historyId: Date.now().toString()
        })).toString('base64'),
        messageId: 'test-message-' + Date.now(),
        publishTime: new Date().toISOString()
      }
    };

    // Process the test notification
    req.body = testNotification;
    console.log('Forwarding test notification to main webhook handler');
    
    // Call the main webhook handler
    return router.handle({
      ...req,
      method: 'POST',
      url: '/gmail'
    }, res);

  } catch (error) {
    console.error('Test webhook error:', error);
    res.status(500).json({
      error: 'Test webhook failed',
      message: error.message
    });
  }
});

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'gmail-webhook',
    timestamp: new Date().toISOString(),
    webhookUrl: '/api/webhooks/gmail'
  });
});

// Webhook statistics endpoint
router.get('/stats', async (req, res) => {
  try {
    const stats = {
      rateLimitEntries: webhookRateLimit.size,
      serverTime: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    };
    
    // Add gmailWatchService stats if available
    if (gmailWatchService && typeof gmailWatchService.getActiveWatchers === 'function') {
      stats.activeWatchers = gmailWatchService.getActiveWatchers().length;
    }
    
    res.status(200).json(stats);
  } catch (error) {
    console.error('Error getting webhook stats:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// Cleanup rate limit cache periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of webhookRateLimit.entries()) {
    if (now > value.resetTime) {
      webhookRateLimit.delete(key);
    }
  }
}, 5 * 60 * 1000); // Clean up every 5 minutes

module.exports = router;