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

// Gmail webhook handler with detailed error logging
router.post('/gmail', verifyWebhook, async (req, res) => {
  console.log("📬 Gmail webhook temporarily disabled for debugging");
   res.status(200).json({ success: true, message: 'Webhook disabled' });
  return; // Exit early
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  let decodedData = null;
  let userEmail = null;
  let userId = null;
  
  try {
    console.log(`🔍 [${requestId}] WEBHOOK DEBUG - Raw request received:`, {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body,
      query: req.query,
      timestamp: new Date().toISOString(),
      contentType: req.headers['content-type'],
      userAgent: req.headers['user-agent']
    });
    
    if (!req.body || !req.body.message) {
      console.log(`❌ [${requestId}] Invalid webhook payload - missing message`);
      return res.status(400).json({ 
        error: 'Invalid payload',
        requestId
      });
    }
    
    const message = req.body.message;
    
    if (!message.data) {
      console.log(`❌ [${requestId}] Invalid webhook payload - missing message data`);
      return res.status(400).json({ 
        error: 'Invalid message data',
        requestId
      });
    }
    
    console.log(`📨 [${requestId}] Gmail webhook received:`, {
      messageId: message.messageId,
      publishTime: message.publishTime,
      hasData: !!message.data
    });
    
    try {
      // Decode the base64 message data
      const dataBuffer = Buffer.from(message.data, 'base64');
      decodedData = JSON.parse(dataBuffer.toString());
      console.log(`📧 [${requestId}] Decoded webhook data:`, decodedData);
    } catch (error) {
      console.error(`❌ [${requestId}] Error decoding webhook data:`, error);
      return res.status(400).json({ 
        error: 'Failed to decode message data',
        details: error.message,
        requestId
      });
    }
    
    const { emailAddress, historyId } = decodedData;
    
    if (!emailAddress || !historyId) {
      console.log(`❌ [${requestId}] Missing required fields in webhook data:`, { emailAddress, historyId });
      return res.status(400).json({ 
        error: 'Missing required fields',
        message: 'Missing emailAddress or historyId',
        requestId
      });
    }
    
    userEmail = emailAddress;
    console.log(`🔍 [${requestId}] Processing webhook for:`, { emailAddress, historyId });

    // Rate limiting check
    if (isRateLimited(userEmail)) {
      console.warn(`⚠️ [${requestId}] Rate limit exceeded for user: ${userEmail}`);
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'Too many webhook requests',
        requestId
      });
    }

    // Find user by email address
    console.log(`🔍 [${requestId}] Finding user by email:`, userEmail);
    userId = await findUserByEmail(userEmail);
    if (!userId) {
      console.error(`❌ [${requestId}] No user found for email: ${userEmail}`);
      return res.status(404).json({
        error: 'User not found',
        message: 'No registered user found for this email address',
        requestId
      });
    }
    console.log(`✅ [${requestId}] Found user:`, { userId, email: emailAddress });

    // Get user data for tokens
    const userDoc = await firebaseService.db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      console.error(`❌ [${requestId}] User document not found:`, userId);
      throw new Error('User document not found');
    }

    const userData = userDoc.data();
    console.log(`🔍 [${requestId}] User data check:`, {
      hasGoogleRefreshToken: !!userData.googleRefreshToken,
      hasGmailWatch: !!userData.gmailWatch,
      googleConnected: userData.googleConnected
    });

    if (!userData.googleRefreshToken) {
      console.error(`❌ [${requestId}] No Google refresh token found for user:`, userId);
      throw new Error('No Google refresh token found for user');
    }

    // Process the Gmail notification
    try {
      // Check if gmailWatchService has processHistoryChanges method
      if (typeof gmailWatchService.processHistoryChanges === 'function') {
        console.log(`🔄 [${requestId}] Processing history changes via GmailWatchService...`);
        await gmailWatchService.processHistoryChanges(
          userId,
          decodedData.historyId,
          userData.googleAccessToken,
          userData.googleRefreshToken
        );
      } else if (typeof gmailWatchService.handleWebhookNotification === 'function') {
        console.log(`🔄 [${requestId}] Processing via handleWebhookNotification...`);
        await gmailWatchService.handleWebhookNotification(userId, historyId);
      } else {
        console.log(`🔄 [${requestId}] GmailWatchService methods not found, processing manually...`);
        await processHistoryChangesManually(userId, decodedData.historyId, userData.googleRefreshToken, requestId);
      }
      
      // Log successful webhook processing
      await logWebhookActivity(userId, decodedData, 'success');
      console.log(`✅ [${requestId}] Webhook notification processed successfully for user:`, userId);

      res.status(200).json({ 
        success: true,
        message: 'Webhook processed successfully',
        historyId: decodedData.historyId,
        userId: userId,
        requestId
      });

    } catch (processingError) {
      console.error(`❌ [${requestId}] Error processing webhook notification:`, processingError);
      throw processingError;
    }

  } catch (error) {
    console.error(`❌ [${requestId}] CRITICAL WEBHOOK ERROR:`, error);
    console.error(`❌ [${requestId}] Error stack:`, error.stack);
    
    // Log error webhook activity
    if (userEmail && userId) {
      try {
        await logWebhookActivity(userId, decodedData, 'error', error.message);
      } catch (logError) {
        console.error(`❌ [${requestId}] Failed to log webhook error:`, logError);
      }
    }

    // Don't expose internal errors to client
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to process webhook',
      requestId
    });
  }
});

/**
 * Manual history processing if gmailWatchService doesn't have the method
 */
async function processHistoryChangesManually(userId, historyId, refreshToken, requestId = 'manual') {
  try {
    console.log(`🔄 [${requestId}] Processing history changes manually for user:`, userId);
    
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
      console.log(`🔍 [${requestId}] No stored history ID found, using current historyId`);
    }

    const startHistoryId = storedHistoryId || historyId;
    console.log(`🔍 [${requestId}] Fetching history from ${startHistoryId} to ${historyId}`);

    // Fetch history
    const historyResponse = await gmail.users.history.list({
      userId: 'me',
      startHistoryId: startHistoryId,
      historyTypes: ['messageAdded'],
      maxResults: 100
    });

    const history = historyResponse.data.history || [];
    console.log(`📊 [${requestId}] Found ${history.length} history records`);

    // Process each history record
    for (const record of history) {
      if (record.messagesAdded) {
        for (const messageRecord of record.messagesAdded) {
          const message = messageRecord.message;
          console.log(`📨 [${requestId}] Processing new message:`, message.id);
          
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
              
              // 🚨 NEW FILTERING LOGIC - Only process legitimate replies
              const shouldProcessEmail = await shouldSendAutoReply(userId, fromEmail, subjectHeader?.value, messageDetails.data.threadId, requestId);
              
              if (shouldProcessEmail) {
                console.log(`📥 [${requestId}] Adding legitimate reply to auto-reply queue:`, {
                  from: fromEmail,
                  subject: subjectHeader?.value,
                  messageId: message.id
                });
                // Add to auto-reply queue
                await addToAutoReplyQueue(userId, messageDetails.data, fromEmail, requestId);
              } else {
                console.log(`🚫 [${requestId}] Skipping non-reply email from:`, fromEmail);
              }
            } else {
              console.log(`📤 [${requestId}] Skipping outgoing email from user`);
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

    console.log(`✅ [${requestId}] History processing completed`);

  } catch (error) {
    console.error(`❌ [${requestId}] Error in manual history processing:`, error);
    throw error;
  }
}

/**
 * Enhanced email filtering to determine if we should send auto-reply
 * This function implements comprehensive filtering to only process legitimate replies
 */
async function shouldSendAutoReply(userId, fromEmail, subject, threadId, requestId = 'filter') {
  try {
    console.log(`🔍 [${requestId}] Starting email filtering for: ${fromEmail}`);
    
    // 1. ENHANCED Skip patterns for promotional/automated emails
    const skipPatterns = [
      // No-reply patterns
      'no-reply', 'noreply', 'donotreply', 'do-not-reply', 'no.reply',
      
      // Marketing/promotional patterns
      'marketing', 'newsletter', 'promotion', 'promo', 'deals', 'offer',
      'communications', 'campaigns', 'broadcast', 'bulk',
      
      // Notifications/alerts
      'notification', 'notify', 'alert', 'alerts', 'reminder',
      'update', 'updates', 'status', 'report',
      
      // Support/system patterns
      'support', 'help', 'service', 'system', 'admin', 'administrator',
      'postmaster', 'mailer-daemon', 'bounce', 'delivery',
      
      // Security/verification
      'security', 'verify', 'verification', 'confirm', 'confirmation',
      'reset', 'password', 'account', 'team',
      
      // Social media patterns
      'facebook', 'twitter', 'linkedin', 'instagram', 'youtube',
      'social', 'feed', 'digest',
      
      // E-commerce patterns
      'order', 'invoice', 'receipt', 'payment', 'billing', 'subscription',
      'shipping', 'delivery', 'tracking'
    ];
    
    // 2. ENHANCED Domain-based filtering
    const skipDomains = [
      // Major platforms
      'facebook.com', 'twitter.com', 'linkedin.com', 'instagram.com',
      'youtube.com', 'google.com', 'microsoft.com', 'apple.com',
      
      // E-commerce
      'amazon.com', 'ebay.com', 'paypal.com', 'stripe.com',
      'shopify.com', 'etsy.com', 'alibaba.com',
      
      // Email services
      'mailchimp.com', 'constantcontact.com', 'sendgrid.com',
      'mailgun.com', 'postmark.com', 'ses.amazonaws.com',
      
      // News/media
      'news.com', 'cnn.com', 'bbc.com', 'reuters.com', 'medium.com',
      'substack.com', 'newsletter.com',
      
      // Banking/financial
      'bank.com', 'banking.com', 'paypal.com', 'visa.com', 'mastercard.com',
      'americanexpress.com', 'wells', 'chase.com', 'citibank.com',
      
      // Common automated services
      'zendesk.com', 'intercom.com', 'hubspot.com', 'salesforce.com',
      'slack.com', 'trello.com', 'asana.com', 'monday.com'
    ];
    
    const fromEmailLower = fromEmail.toLowerCase();
    const subjectLower = (subject || '').toLowerCase();
    
    // Check email patterns
    for (const pattern of skipPatterns) {
      if (fromEmailLower.includes(pattern)) {
        console.log(`🚫 [${requestId}] Skipping email with pattern "${pattern}" from: ${fromEmail}`);
        return false;
      }
    }
    
    // Check domain patterns
    for (const domain of skipDomains) {
      if (fromEmailLower.includes(domain)) {
        console.log(`🚫 [${requestId}] Skipping email from domain "${domain}": ${fromEmail}`);
        return false;
      }
    }
    
    // 3. ENHANCED Subject line filtering
    const skipSubjectPatterns = [
      // Marketing subjects
      'newsletter', 'deals', 'offer', 'sale', 'discount', 'promo',
      'special offer', 'limited time', 'act now', 'don\'t miss',
      
      // Notifications
      'alert', 'notification', 'reminder', 'update', 'status',
      'action required', 'urgent', 'important notice',
      
      // Automated systems
      'delivery failure', 'undelivered mail', 'mailer-daemon',
      'out of office', 'auto reply', 'automatic reply',
      
      // Registration/verification
      'verify your email', 'confirm your account', 'registration',
      'welcome to', 'thank you for signing up', 'activate',
      
      // Banking/financial alerts
      'statement', 'balance', 'transaction', 'payment due',
      'card ending', 'security alert', 'fraud alert'
    ];
    
    // Check subject patterns
    for (const pattern of skipSubjectPatterns) {
      if (subjectLower.includes(pattern)) {
        console.log(`🚫 [${requestId}] Skipping email with subject pattern "${pattern}": ${subject}`);
        return false;
      }
    }
    
    // 4. Check if sender is in our sent emails (recipient list)
    console.log(`🔍 [${requestId}] Checking if we've sent emails to: ${fromEmail}`);
    const sentEmailsQuery = await firebaseService.db
      .collection('users')
      .doc(userId)
      .collection('scheduledEmails')
      .where('recipients', 'array-contains', fromEmail)
      .where('status', '==', 'sent')
      .orderBy('sentAt', 'desc')
      .limit(10)
      .get();
    
    if (sentEmailsQuery.empty) {
      console.log(`🚫 [${requestId}] No sent emails found to: ${fromEmail} - not processing`);
      return false;
    }
    
    console.log(`✅ [${requestId}] Found ${sentEmailsQuery.docs.length} sent email(s) to: ${fromEmail}`);
    
    // 5. Check if any sent email had auto-reply enabled
    let hasAutoReplyEnabled = false;
    let sentEmailWithAutoReply = null;
    
    for (const doc of sentEmailsQuery.docs) {
      const emailData = doc.data();
      console.log(`🔍 [${requestId}] Checking sent email:`, {
        id: doc.id,
        subject: emailData.subject,
        autoReplyEnabled: emailData.autoReplyEnabled,
        sentAt: emailData.sentAt?.toDate?.()
      });
      
      if (emailData.autoReplyEnabled) {
        hasAutoReplyEnabled = true;
        sentEmailWithAutoReply = emailData;
        console.log(`✅ [${requestId}] Found sent email with auto-reply enabled to: ${fromEmail}`);
        break;
      }
    }
    
    if (!hasAutoReplyEnabled) {
      console.log(`🚫 [${requestId}] No auto-reply enabled emails found for: ${fromEmail}`);
      return false;
    }
    
    // 6. Enhanced reply detection
    const replyIndicators = [
      // Standard reply prefixes
      subjectLower.startsWith('re:'),
      subjectLower.startsWith('reply:'),
      subjectLower.startsWith('response:'),
      
      // Thank you patterns
      subjectLower.includes('thank you'),
      subjectLower.includes('thanks'),
      subjectLower.includes('thank u'),
      subjectLower.includes('thx'),
      
      // Question/inquiry responses
      subjectLower.includes('regarding'),
      subjectLower.includes('about your'),
      subjectLower.includes('in response'),
      
      // Acknowledgment patterns
      subjectLower.includes('received'),
      subjectLower.includes('got it'),
      subjectLower.includes('understood'),
      
      // Follow-up patterns
      subjectLower.includes('follow up'),
      subjectLower.includes('following up')
    ];
    
    const isReply = replyIndicators.some(indicator => indicator === true);
    
    if (!isReply) {
      console.log(`🚫 [${requestId}] Email doesn't look like a reply - Subject: ${subject}`);
      return false;
    }
    
    // 7. Check for recent auto-replies to avoid loops
    console.log(`🔍 [${requestId}] Checking for recent auto-replies to prevent loops`);
    const recentAutoReplies = await firebaseService.db
      .collection('users')
      .doc(userId)
      .collection('autoReplyQueue')
      .where('emailData.from', '==', fromEmail)
      .where('status', '==', 'completed')
      .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(new Date(Date.now() - 24 * 60 * 60 * 1000))) // Last 24 hours
      .limit(5)
      .get();
    
    if (!recentAutoReplies.empty) {
      console.log(`🚫 [${requestId}] Recent auto-reply found for ${fromEmail} - preventing loop`);
      return false;
    }
    
    // 8. Final validation - ensure this isn't our own auto-reply
    if (subjectLower.includes('auto reply') || subjectLower.includes('automatic reply')) {
      console.log(`🚫 [${requestId}] Detected auto-reply message - skipping to prevent loop`);
      return false;
    }
    
    console.log(`✅ [${requestId}] Email passed ALL filters - will process auto-reply for: ${fromEmail}`);
    console.log(`📧 [${requestId}] Auto-reply will be based on sent email:`, {
      subject: sentEmailWithAutoReply?.subject,
      sentAt: sentEmailWithAutoReply?.sentAt?.toDate?.(),
      autoReplyTemplate: sentEmailWithAutoReply?.autoReplyTemplate
    });
    
    return true;
    
  } catch (error) {
    console.error(`❌ [${requestId}] Error in shouldSendAutoReply:`, error);
    return false; // Default to not sending if error
  }
}

/**
 * Add email to auto-reply queue
 */
async function addToAutoReplyQueue(userId, messageData, fromEmail, requestId = 'queue') {
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
        source: 'gmail_webhook',
        filterPassed: true, // Mark that this email passed our filtering
        processedAt: admin.firestore.FieldValue.serverTimestamp()
      });

    console.log(`✅ [${requestId}] Email added to auto-reply queue:`, {
      queueId: queueRef.id,
      from: fromEmail,
      subject: subjectHeader?.value,
      status: 'pending'
    });

    return queueRef.id;

  } catch (error) {
    console.error(`❌ [${requestId}] Error adding to auto-reply queue:`, error);
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
    console.log('🔍 Searching for user with email:', email);
    
    // First try: Find by main email field
    const usersRef = firebaseService.db.collection('users');
    let querySnapshot = await usersRef
      .where('email', '==', email)
      .limit(1)
      .get();

    if (!querySnapshot.empty) {
      console.log('✅ Found user by email field');
      return querySnapshot.docs[0].id;
    }

    // Second try: Find by googleEmail field
    querySnapshot = await usersRef
      .where('googleEmail', '==', email)
      .limit(1)
      .get();
      
    if (!querySnapshot.empty) {
      console.log('✅ Found user by googleEmail field');
      return querySnapshot.docs[0].id;
    }

    console.log('❌ No user found for email:', email);
    return null;
    
  } catch (error) {
    console.error('❌ Error finding user by email:', error);
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
    console.log('📝 Webhook activity logged');
  } catch (error) {
    console.error('❌ Error logging webhook activity:', error);
    // Don't throw here as it's just logging
  }
}

// Manual webhook test endpoint
router.post('/manual-test/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    
    // Fix the destructuring issue
    let testEmail = 'test@example.com'; // Default value
    
    // Safely check if req.body exists and has testEmail
    if (req.body && req.body.testEmail) {
      testEmail = req.body.testEmail;
    }
    
    console.log('🧪 Manual webhook test started for user:', userId);
    console.log('📧 Using test email:', testEmail);
    console.log('📋 Request body:', req.body);
    
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
        source: 'manual_test',
        filterPassed: true,
        bypassFilters: true // Mark as bypassing filters for testing
      });
    
    console.log('✅ Manual test completed, queue ID:', queueRef.id);
    
    res.json({
      success: true,
      message: 'Manual test email added to auto-reply queue',
      queueId: queueRef.id,
      testEmail: testEmail
    });
    
  } catch (error) {
    console.error('❌ Manual webhook test failed:', error);
    console.error('❌ Error details:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Check auto-reply queue status
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
    
    // Get filtering statistics
    const filteredSnapshot = await firebaseService.db
      .collection('users')
      .doc(userId)
      .collection('webhookLogs')
      .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(new Date(Date.now() - 24 * 60 * 60 * 1000))) // Last 24 hours
      .orderBy('timestamp', 'desc')
      .limit(20)
      .get();
    
    const webhookStats = {
      total: filteredSnapshot.docs.length,
      successful: filteredSnapshot.docs.filter(doc => doc.data().status === 'success').length,
      errors: filteredSnapshot.docs.filter(doc => doc.data().status === 'error').length
    };
    
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
      webhookStats: webhookStats,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error checking queue status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test webhook endpoint for manual testing
router.post('/test', async (req, res) => {
  try {
    console.log('🧪 Test webhook endpoint called');
    
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
    console.log('🔄 Forwarding test notification to main webhook handler');
    
    // Call the main webhook handler
    return router.handle({
      ...req,
      method: 'POST',
      url: '/gmail'
    }, res);

  } catch (error) {
    console.error('❌ Test webhook error:', error);
    res.status(500).json({
      error: 'Test webhook failed',
      message: error.message
    });
  }
});

// Enhanced endpoint to manually check if email should trigger auto-reply
router.post('/check-filter/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const { fromEmail, subject, threadId } = req.body;
    
    if (!fromEmail) {
      return res.status(400).json({
        error: 'Missing fromEmail parameter'
      });
    }
    
    console.log('🔍 Manual filter check for:', { userId, fromEmail, subject });
    
    const shouldProcess = await shouldSendAutoReply(userId, fromEmail, subject, threadId, 'manual-check');
    
    res.json({
      success: true,
      userId: userId,
      fromEmail: fromEmail,
      subject: subject,
      shouldSendAutoReply: shouldProcess,
      message: shouldProcess ? 'Email would trigger auto-reply' : 'Email would be filtered out',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error in manual filter check:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'gmail-webhook',
    timestamp: new Date().toISOString(),
    webhookUrl: '/api/webhooks/gmail',
    features: {
      emailFiltering: 'enhanced',
      autoReplyQueue: 'enabled',
      rateLimiting: 'enabled',
      loopPrevention: 'enabled'
    }
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
    console.error('❌ Error getting webhook stats:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// Enhanced filtering stats endpoint
router.get('/filter-stats/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    
    // Get last 24 hours of webhook logs
    const logsSnapshot = await firebaseService.db
      .collection('users')
      .doc(userId)
      .collection('webhookLogs')
      .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(new Date(Date.now() - 24 * 60 * 60 * 1000)))
      .orderBy('timestamp', 'desc')
      .get();
    
    // Get queue items with filtering info
    const queueSnapshot = await firebaseService.db
      .collection('users')
      .doc(userId)
      .collection('autoReplyQueue')
      .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(new Date(Date.now() - 24 * 60 * 60 * 1000)))
      .get();
    
    const stats = {
      webhookEvents: logsSnapshot.docs.length,
      emailsProcessed: queueSnapshot.docs.length,
      emailsFiltered: logsSnapshot.docs.length - queueSnapshot.docs.length,
      filterEfficiency: logsSnapshot.docs.length > 0 ? 
        ((logsSnapshot.docs.length - queueSnapshot.docs.length) / logsSnapshot.docs.length * 100).toFixed(1) + '%' : 
        '0%',
      lastUpdated: new Date().toISOString()
    };
    
    res.json({
      success: true,
      userId: userId,
      period: 'last_24_hours',
      stats: stats
    });
    
  } catch (error) {
    console.error('❌ Error getting filter stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
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

// GET endpoint for webhook testing and verification
router.get('/gmail', (req, res) => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  console.log(`🔍 [${requestId}] Gmail webhook GET request received`);
  
  // Handle Gmail webhook verification challenge if present
  if (req.query.validationToken) {
    console.log(`✅ [${requestId}] Gmail webhook validation token received`);
    return res.status(200).send(req.query.validationToken);
  }
  
  // Regular GET test response
  res.status(200).json({ 
    success: true, 
    message: 'Gmail webhook endpoint is accessible',
    endpoint: '/api/webhooks/gmail',
    method: 'GET',
    timestamp: new Date().toISOString(),
    requestId: requestId,
    availableMethods: ['GET', 'POST'],
    webhook: {
      status: 'active',
      url: req.protocol + '://' + req.get('host') + req.originalUrl,
      description: 'Gmail Push Notification webhook endpoint with enhanced filtering'
    },
    features: {
      enhancedFiltering: true,
      loopPrevention: true,
      rateLimiting: true,
      comprehensiveLogging: true
    }
  });
});

module.exports = router;