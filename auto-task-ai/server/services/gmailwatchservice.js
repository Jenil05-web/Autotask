const { google } = require('googleapis');
const firebaseService = require('./firebaseAdmin');
const admin = require('firebase-admin'); // Add this line
const db = firebaseService.db;
const { v4: uuidv4 } = require('uuid');

class GmailWatchService {
  constructor() {
    this.gmail = null;
    this.activeWatchers = new Map();
    this.rateLimitCache = new Map(); // For rate limiting
    this.watchExpirationBuffer = 24 * 60 * 60 * 1000; // 24 hours before expiration
    
  }

  async processHistoryChanges(userId, historyId, accessToken, refreshToken) {
  try {
    console.log('🔍 Processing history changes for user:', userId);
    console.log('🔍 History ID:', historyId);

    const gmail = await this.initializeGmail(accessToken, refreshToken);
    
    // Get user's last processed history ID
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const startHistoryId = userData.gmailWatch?.historyId || historyId;

    console.log('🔍 Start history ID:', startHistoryId);

    // Get history changes
    const historyResponse = await gmail.users.history.list({
      userId: 'me',
      startHistoryId: startHistoryId,
      labelId: 'INBOX'
    });

    const history = historyResponse.data.history || [];
    console.log('🔍 History changes found:', history.length);

    for (const historyItem of history) {
      if (historyItem.messagesAdded) {
        for (const messageAdded of historyItem.messagesAdded) {
          const messageId = messageAdded.message.id;
          console.log('🔍 Processing new message:', messageId);
          
          await this.processIncomingEmail(userId, messageId, historyItem.id);
        }
      }
    }

    // Update the last processed history ID
    await db.collection('users').doc(userId).update({
      'gmailWatch.historyId': historyId,
      'gmailWatch.lastActivity': admin.firestore.FieldValue.serverTimestamp()
    });

  } catch (error) {
    console.error('❌ Error processing history changes:', error);
    throw error;
  }
}
  /**
   * Initialize Gmail API client with OAuth2 credentials
   */
  async initializeGmail(accessToken, refreshToken) {
    try {
      const oauth2Client = new google.auth.OAuth2(
        process.env.GMAIL_CLIENT_ID,
        process.env.GMAIL_CLIENT_SECRET,
        process.env.GMAIL_REDIRECT_URI
      );
      
      oauth2Client.setCredentials({
        access_token: accessToken,
        refresh_token: refreshToken
      });

      // Handle token refresh automatically
      oauth2Client.on('tokens', async (tokens) => {
        if (tokens.refresh_token) {
          // Update refresh token in database
          console.log('New refresh token received');
        }
        if (tokens.access_token) {
          console.log('Access token refreshed');
        }
      });

      this.gmail = google.gmail({ version: 'v1', auth: oauth2Client });
      return this.gmail;
    } catch (error) {
      console.error('Failed to initialize Gmail API:', error);
      throw new Error(`Gmail initialization failed: ${error.message}`);
    }
  }

  /**
   * Setup Gmail push notifications with enhanced error handling and validation
   */
  async setupEmailWatch(userId, accessToken, refreshToken, options = {}) {
    try {
      if (!userId || !accessToken || !refreshToken) {
        throw new Error('Missing required parameters: userId, accessToken, or refreshToken');
      }

      const gmail = await this.initializeGmail(accessToken, refreshToken);
      
      // Check if watch already exists and is still valid
      const existingWatch = await this.getExistingWatch(userId);
      if (existingWatch && this.isWatchValid(existingWatch)) {
        console.log(`Valid watch already exists for user ${userId}`);
        return existingWatch;
      }

      // Configure watch request with enhanced options
      const watchRequest = {
        userId: 'me',
        requestBody: {
          topicName: `projects/${process.env.GOOGLE_CLOUD_PROJECT_ID}/topics/gmail-notifications`,
          labelIds: options.labelIds || ['INBOX'],
          labelFilterAction: options.labelFilterAction || 'include'
        }
      };

      const response = await gmail.users.watch(watchRequest);
      
      // Store watch details with enhanced metadata
      const watchData = {
        historyId: response.data.historyId,
        expiration: response.data.expiration,
        isActive: true,
        setupAt: admin.firestore.FieldValue.serverTimestamp(),
        lastActivity: admin.firestore.FieldValue.serverTimestamp(),
        watchId: uuidv4(),
        labelIds: options.labelIds || ['INBOX'],
        errorCount: 0,
        lastError: null
      };

      await db.collection('users').doc(userId).update({
        gmailWatch: watchData
      });

      this.activeWatchers.set(userId, watchData);

      // Schedule watch renewal before expiration
      this.scheduleWatchRenewal(userId, response.data.expiration);

      console.log(`Gmail watch setup successfully for user ${userId}`, {
        historyId: response.data.historyId,
        expiration: new Date(parseInt(response.data.expiration))
      });

      return response.data;
    } catch (error) {
      console.error('Error setting up Gmail watch:', error);
      
      // Log error to database for monitoring
      await this.logWatchError(userId, 'setup', error.message);
      
      throw new Error(`Failed to setup Gmail watch: ${error.message}`);
    }
  }

  /**
   * Process incoming email with enhanced parsing and filtering
   */
  async processIncomingEmail(userId, messageId, historyId) {
    try {
      if (!userId || !messageId) {
        throw new Error('Missing required parameters: userId or messageId');
      }

      // Check rate limiting
      if (this.isRateLimited(userId)) {
        console.log(`Rate limited for user ${userId}, queuing message ${messageId}`);
        await this.queueMessage(userId, messageId, historyId);
        return;
      }

      const userDoc = await db.collection('users').doc(userId).get();
      if (!userDoc.exists) {
        console.error(`User ${userId} not found`);
        return;
      }

      const userData = userDoc.data();
      if (!userData.gmailTokens) {
        console.error(`No Gmail tokens found for user ${userId}`);
        return;
      }

      const gmail = await this.initializeGmail(
        userData.gmailTokens.access_token,
        userData.gmailTokens.refresh_token
      );

      // Get the email details with retry logic
      const message = await this.getMessageWithRetry(gmail, messageId);
      if (!message) return;

      const email = this.parseEmailData(message.data);
      
      // Enhanced filtering
      if (await this.shouldIgnoreEmail(userId, email)) {
        console.log(`Ignoring email ${messageId} based on filters`);
        return;
      }

      // Update last activity
      await this.updateLastActivity(userId);
      
      // Check if auto-reply should be sent
      const shouldSendAutoReply = await this.checkAutoReplyConditions(userId, email);
      
      if (shouldSendAutoReply) {
        await this.queueAutoReply(userId, email);
      }

      // Store email metadata for analytics
      await this.storeEmailMetadata(userId, email);

    } catch (error) {
      console.error('Error processing incoming email:', error);
      await this.logWatchError(userId, 'process_email', error.message);
    }
  }

  /**
   * Enhanced email parsing with better body extraction
   */
  parseEmailData(messageData) {
    const headers = messageData.payload.headers;
    const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';

    return {
      id: messageData.id,
      threadId: messageData.threadId,
      from: getHeader('From'),
      to: getHeader('To'),
      cc: getHeader('Cc'),
      bcc: getHeader('Bcc'),
      subject: getHeader('Subject'),
      date: getHeader('Date'),
      messageId: getHeader('Message-ID'),
      inReplyTo: getHeader('In-Reply-To'),
      references: getHeader('References'),
      body: this.extractEmailBody(messageData.payload),
      htmlBody: this.extractEmailBody(messageData.payload, 'text/html'),
      attachments: this.extractAttachments(messageData.payload),
      labels: messageData.labelIds || [],
      snippet: messageData.snippet || '',
      historyId: messageData.historyId,
      internalDate: messageData.internalDate,
      sizeEstimate: messageData.sizeEstimate
    };
  }

  /**
   * Enhanced body extraction supporting both text and HTML
   */
  extractEmailBody(payload, mimeType = 'text/plain') {
    let body = '';
    
    const extractFromPart = (part) => {
      if (part.mimeType === mimeType && part.body && part.body.data) {
        return Buffer.from(part.body.data, 'base64').toString();
      }
      
      if (part.parts) {
        for (const subPart of part.parts) {
          const extracted = extractFromPart(subPart);
          if (extracted) return extracted;
        }
      }
      
      return '';
    };

    if (payload.parts) {
      body = extractFromPart(payload);
    } else if (payload.body && payload.body.data && payload.mimeType === mimeType) {
      body = Buffer.from(payload.body.data, 'base64').toString();
    }
    
    return body;
  }

  /**
   * Extract attachment information
   */
  extractAttachments(payload) {
    const attachments = [];
    
    const extractFromPart = (part) => {
      if (part.filename && part.body && part.body.attachmentId) {
        attachments.push({
          filename: part.filename,
          mimeType: part.mimeType,
          size: part.body.size,
          attachmentId: part.body.attachmentId
        });
      }
      
      if (part.parts) {
        part.parts.forEach(extractFromPart);
      }
    };

    if (payload.parts) {
      payload.parts.forEach(extractFromPart);
    }
    
    return attachments;
  }

  /**
   * Enhanced auto-reply conditions with more sophisticated filtering
   */
  async checkAutoReplyConditions(userId, email) {
    try {
      // Get active auto-reply settings
      const autoReplySnapshot = await db
        .collection('users')
        .doc(userId)
        .collection('autoReplySettings')
        .where('isActive', '==', true)
        .get();

      if (autoReplySnapshot.empty) return false;

      const settings = autoReplySnapshot.docs[0].data();

      // Check time constraints
      if (settings.scheduleEnabled && !this.isWithinSchedule(settings.schedule)) {
        return false;
      }

      // Check if already replied to this thread
      const threadReplied = await this.hasRepliedToThread(userId, email.threadId);
      if (threadReplied && !settings.allowMultipleReplies) {
        return false;
      }

      // Check sender filters
      if (settings.senderFilters && !this.matchesSenderFilters(email.from, settings.senderFilters)) {
        return false;
      }

      // Check subject filters
      if (settings.subjectFilters && !this.matchesSubjectFilters(email.subject, settings.subjectFilters)) {
        return false;
      }

      // Check if sender is in contacts (avoid auto-replying to known contacts if configured)
      if (settings.excludeContacts && await this.isFromContact(userId, email.from)) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error checking auto-reply conditions:', error);
      return false;
    }
  }

  /**
   * Enhanced auto-reply queuing with delay and scheduling options
   */
  async queueAutoReply(userId, email) {
  try {
    console.log('🔍 CRITICAL DEBUG: queueAutoReply called for user:', userId);
    console.log('🔍 Email from:', email.from);
    console.log('🔍 Email subject:', email.subject);

    // Get auto-reply settings for delay configuration
    const settingsSnapshot = await db
      .collection('users')
      .doc(userId)
      .collection('autoReplySettings')
      .where('isActive', '==', true)
      .get();

    console.log('🔍 Settings found:', !settingsSnapshot.empty);

    const settings = settingsSnapshot.docs[0]?.data() || {};
    const delay = settings.replyDelay || 0; // Default: immediate
    const scheduledFor = new Date(Date.now() + (delay * 1000));

    console.log('🔍 Creating queue document...');

    const queueData = {
      emailData: email,
      originalEmail: email, // Add for backward compatibility
      status: 'pending',
      priority: email.subject.toLowerCase().includes('urgent') ? 'high' : 'normal',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      scheduledFor: admin.firestore.Timestamp.fromDate(scheduledFor),
      retryCount: 0,
      maxRetries: 3,
      userId: userId,
      settings: {
        template: settings.template || 'default',
        signature: settings.signature || '',
        replyToAll: settings.replyToAll || false,
        useAI: settings.useAI || false
      }
    };

    console.log('🔍 Queue data prepared:', {
      status: queueData.status,
      scheduledFor: scheduledFor.toISOString(),
      hasEmailData: !!queueData.emailData
    });

    const docRef = await db
      .collection('users')
      .doc(userId)
      .collection('autoReplyQueue')
      .add(queueData);

    console.log('✅ SUCCESSFULLY queued auto-reply:', docRef.id);
    console.log('✅ Auto-reply queued for user', userId, 'scheduled for', scheduledFor);
    
    return docRef;
  } catch (error) {
    console.error('❌ CRITICAL ERROR in queueAutoReply:', error);
    console.error('❌ Error stack:', error.stack);
    throw error;
  }
}

  // Helper methods

  async getExistingWatch(userId) {
    const userDoc = await db.collection('users').doc(userId).get();
    return userDoc.exists ? userDoc.data().gmailWatch : null;
  }

  isWatchValid(watch) {
    if (!watch || !watch.isActive) return false;
    
    const expirationTime = parseInt(watch.expiration);
    const now = Date.now();
    
    return expirationTime > (now + this.watchExpirationBuffer);
  }

  async getMessageWithRetry(gmail, messageId, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await gmail.users.messages.get({
          userId: 'me',
          id: messageId,
          format: 'full'
        });
      } catch (error) {
        console.error(`Attempt ${attempt} failed to get message ${messageId}:`, error.message);
        if (attempt === maxRetries) return null;
        
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }

  isRateLimited(userId) {
    const key = `rate_limit_${userId}`;
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute window
    const maxRequests = 30; // Max 30 requests per minute
    
    if (!this.rateLimitCache.has(key)) {
      this.rateLimitCache.set(key, { count: 1, resetTime: now + windowMs });
      return false;
    }
    
    const limit = this.rateLimitCache.get(key);
    
    if (now > limit.resetTime) {
      this.rateLimitCache.set(key, { count: 1, resetTime: now + windowMs });
      return false;
    }
    
    if (limit.count >= maxRequests) {
      return true;
    }
    
    limit.count++;
    return false;
  }

  async shouldIgnoreEmail(userId, email) {
    // Check if email is from a no-reply address
    const noReplyPatterns = [
      /noreply/i,
      /no-reply/i,
      /donotreply/i,
      /do-not-reply/i,
      /automated/i,
      /notification/i
    ];
    
    if (noReplyPatterns.some(pattern => pattern.test(email.from))) {
      return true;
    }

    // Check if email is an auto-reply itself
    const autoReplyHeaders = ['Auto-Submitted', 'X-Auto-Response-Suppress'];
    // This would need to be checked in the full headers
    
    return false;
  }

  isWithinSchedule(schedule) {
    const now = new Date();
    const currentHour = now.getHours();
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    return schedule.days.includes(currentDay) && 
           currentHour >= schedule.startHour && 
           currentHour < schedule.endHour;
  }

  matchesSenderFilters(from, filters) {
    return filters.some(filter => {
      if (filter.type === 'domain') {
        return from.includes(`@${filter.value}`);
      }
      if (filter.type === 'email') {
        return from.toLowerCase().includes(filter.value.toLowerCase());
      }
      return false;
    });
  }

  matchesSubjectFilters(subject, filters) {
    return filters.some(filter => {
      const regex = new RegExp(filter.pattern, filter.flags || 'i');
      return regex.test(subject);
    });
  }

  async hasRepliedToThread(userId, threadId) {
    const repliesSnapshot = await db
      .collection('users')
      .doc(userId)
      .collection('sentReplies')
      .where('threadId', '==', threadId)
      .limit(1)
      .get();
    
    return !repliesSnapshot.empty;
  }

  async isFromContact(userId, fromEmail) {
    // This would integrate with Google Contacts API
    // For now, return false
    return false;
  }

  async updateLastActivity(userId) {
    await db.collection('users').doc(userId).update({
      'gmailWatch.lastActivity': admin.firestore.FieldValue.serverTimestamp()
    });
  }

  async storeEmailMetadata(userId, email) {
    await db
      .collection('users')
      .doc(userId)
      .collection('emailActivity')
      .add({
        messageId: email.id,
        threadId: email.threadId,
        from: email.from,
        subject: email.subject,
        receivedAt: admin.firestore.FieldValue.serverTimestamp(),
        hasAttachments: email.attachments.length > 0,
        sizeEstimate: email.sizeEstimate
      });
  }

  async queueMessage(userId, messageId, historyId) {
    await db
      .collection('users')
      .doc(userId)
      .collection('messageQueue')
      .add({
        messageId,
        historyId,
        status: 'queued',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
  }

  scheduleWatchRenewal(userId, expiration) {
    const expirationTime = parseInt(expiration);
    const renewalTime = expirationTime - this.watchExpirationBuffer;
    const delay = renewalTime - Date.now();
    
    if (delay > 0) {
      setTimeout(() => {
        this.renewWatch(userId);
      }, delay);
    }
  }

  async renewWatch(userId) {
    try {
      console.log(`Renewing watch for user ${userId}`);
      const userDoc = await db.collection('users').doc(userId).get();
      
      if (userDoc.exists) {
        const userData = userDoc.data();
        if (userData.gmailTokens) {
          await this.setupEmailWatch(
            userId,
            userData.gmailTokens.access_token,
            userData.gmailTokens.refresh_token
          );
        }
      }
    } catch (error) {
      console.error(`Failed to renew watch for user ${userId}:`, error);
    }
  }

  async logWatchError(userId, operation, errorMessage) {
    await db
      .collection('users')
      .doc(userId)
      .collection('watchErrors')
      .add({
        operation,
        error: errorMessage,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
  }

  // Public methods for management

  async stopWatch(userId) {
    try {
      const userDoc = await db.collection('users').doc(userId).get();
      if (!userDoc.exists) return;

      const userData = userDoc.data();
      if (!userData.gmailWatch || !userData.gmailWatch.isActive) return;

      const gmail = await this.initializeGmail(
        userData.gmailTokens.access_token,
        userData.gmailTokens.refresh_token
      );

      await gmail.users.stop({ userId: 'me' });

      await db.collection('users').doc(userId).update({
        'gmailWatch.isActive': false,
        'gmailWatch.stoppedAt': admin.firestore.FieldValue.serverTimestamp()
      });

      this.activeWatchers.delete(userId);
      console.log(`Gmail watch stopped for user ${userId}`);
    } catch (error) {
      console.error('Error stopping Gmail watch:', error);
      throw error;
    }
  }

  getActiveWatchers() {
    return Array.from(this.activeWatchers.keys());
  }

  async getWatchStatus(userId) {
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) return null;

    const watchData = userDoc.data().gmailWatch;
    if (!watchData) return null;

    return {
      ...watchData,
      isValid: this.isWatchValid(watchData),
      expiresAt: new Date(parseInt(watchData.expiration))
    };
  }
}

module.exports = new GmailWatchService();