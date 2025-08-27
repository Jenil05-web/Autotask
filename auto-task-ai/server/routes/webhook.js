const express = require('express');
const router = express.Router();
const gmailWatchService = require('../services/gmailWatchService');
const admin = require('../config/firebaseAdmin'); // Adjust path as needed
const { google } = require('googleapis');

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
      timestamp: new Date().toISOString()
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

    // Rate limiting check
    if (isRateLimited(userEmail)) {
      console.warn(`Rate limit exceeded for user: ${userEmail}`);
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'Too many webhook requests'
      });
    }

    // Find user by email address
    const userId = await findUserByEmail(userEmail);
    if (!userId) {
      console.error(`No user found for email: ${userEmail}`);
      return res.status(404).json({
        error: 'User not found',
        message: 'No registered user found for this email address'
      });
    }

    // Verify user has active Gmail watch
    const watchStatus = await gmailWatchService.getWatchStatus(userId);
    if (!watchStatus || !watchStatus.isActive) {
      console.error(`No active watch found for user: ${userId}`);
      return res.status(400).json({
        error: 'No active watch',
        message: 'User does not have an active Gmail watch'
      });
    }

    // Process history changes instead of individual messages
    await processHistoryChanges(userId, decodedData.historyId, userEmail);
    
    // Log successful webhook processing
    await logWebhookActivity(userId, decodedData, 'success');

    res.status(200).json({ 
      status: 'success',
      message: 'Webhook processed successfully',
      historyId: decodedData.historyId
    });

  } catch (error) {
    console.error('Gmail webhook error:', error);
    
    // Log error webhook activity
    if (userEmail) {
      const userId = await findUserByEmail(userEmail).catch(() => null);
      if (userId) {
        await logWebhookActivity(userId, decodedData, 'error', error.message);
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
 * Find user ID by email address
 */
async function findUserByEmail(email) {
  try {
    const usersRef = admin.firestore().collection('users');
    const querySnapshot = await usersRef
      .where('email', '==', email)
      .where('gmailWatch.isActive', '==', true)
      .limit(1)
      .get();

    if (querySnapshot.empty) {
      // Try alternative lookup by Gmail address
      const altQuerySnapshot = await usersRef
        .where('gmailTokens.email', '==', email)
        .where('gmailWatch.isActive', '==', true)
        .limit(1)
        .get();
      
      if (altQuerySnapshot.empty) {
        return null;
      }
      
      return altQuerySnapshot.docs[0].id;
    }

    return querySnapshot.docs[0].id;
  } catch (error) {
    console.error('Error finding user by email:', error);
    return null;
  }
}

/**
 * Process history changes using Gmail API
 */
async function processHistoryChanges(userId, historyId, userEmail) {
  try {
    // Get user's Gmail tokens
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    if (!userDoc.exists) {
      throw new Error('User document not found');
    }

    const userData = userDoc.data();
    if (!userData.gmailTokens) {
      throw new Error('No Gmail tokens found for user');
    }

    // Initialize Gmail API
    const oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.GMAIL_REDIRECT_URI
    );
    
    oauth2Client.setCredentials({
      access_token: userData.gmailTokens.access_token,
      refresh_token: userData.gmailTokens.refresh_token
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Get the user's last processed history ID
    const lastHistoryId = userData.gmailWatch?.historyId;
    if (!lastHistoryId) {
      console.error('No previous history ID found');
      return;
    }

    // Fetch history changes
    const historyResponse = await gmail.users.history.list({
      userId: 'me',
      startHistoryId: lastHistoryId,
      historyTypes: ['messageAdded'], // Only process new messages
      maxResults: 100
    });

    if (!historyResponse.data.history) {
      console.log('No new history changes found');
      return;
    }

    // Process each history change
    for (const historyItem of historyResponse.data.history) {
      if (historyItem.messagesAdded) {
        for (const messageAdded of historyItem.messagesAdded) {
          const message = messageAdded.message;
          
          // Check if message is in INBOX (or other relevant labels)
          if (message.labelIds && message.labelIds.includes('INBOX')) {
            console.log(`Processing new message: ${message.id}`);
            
            // Process the individual message
            await gmailWatchService.processIncomingEmail(
              userId, 
              message.id, 
              historyItem.id
            );
          }
        }
      }
    }

    // Update user's history ID
    await admin.firestore().collection('users').doc(userId).update({
      'gmailWatch.historyId': historyId,
      'gmailWatch.lastWebhookReceived': admin.firestore.FieldValue.serverTimestamp()
    });

  } catch (error) {
    console.error('Error processing history changes:', error);
    throw error;
  }
}

/**
 * Log webhook activity for monitoring
 */
async function logWebhookActivity(userId, webhookData, status, errorMessage = null) {
  try {
    await admin.firestore()
      .collection('users')
      .doc(userId)
      .collection('webhookLogs')
      .add({
        emailAddress: webhookData?.emailAddress,
        historyId: webhookData?.historyId,
        status: status,
        error: errorMessage,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        processingTime: Date.now() // You can calculate actual processing time if needed
      });
  } catch (error) {
    console.error('Error logging webhook activity:', error);
    // Don't throw here as it's just logging
  }
}

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'gmail-webhook',
    timestamp: new Date().toISOString()
  });
});

// Webhook statistics endpoint (optional - for monitoring)
router.get('/stats', async (req, res) => {
  try {
    // This is a basic implementation - you might want to add authentication
    const stats = {
      activeWatchers: gmailWatchService.getActiveWatchers().length,
      rateLimitEntries: webhookRateLimit.size,
      serverTime: new Date().toISOString()
    };
    
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