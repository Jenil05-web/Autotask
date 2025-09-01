const { google } = require('googleapis');
const firebaseService = require('./firebaseAdmin');
const admin = require('firebase-admin');
const db = firebaseService.db;
const { v4: uuidv4 } = require('uuid');

class GmailWatchService {
  constructor() {
    this.gmail = null;
    this.activeWatchers = new Map();
    this.rateLimitCache = new Map();
    this.watchExpirationBuffer = 24 * 60 * 60 * 1000; // 24 hours before expiration
  }

  async processHistoryChanges(userId, historyId, accessToken, refreshToken) {
    try {
      console.log('🔍 Processing history changes for user:', userId);
      console.log('🔍 History ID:', historyId);

      const gmail = await this.initializeGmail(accessToken, refreshToken);
      
      const userDoc = await db.collection('users').doc(userId).get();
      const userData = userDoc.data();
      const startHistoryId = userData.gmailWatch?.historyId || historyId;

      console.log('🔍 Start history ID:', startHistoryId);

      const historyResponse = await gmail.users.history.list({
        userId: 'me',
        startHistoryId: startHistoryId,
        labelId: 'INBOX',
        historyTypes: ['messageAdded']
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
   * Handle webhook notification from Gmail
   */
  async handleWebhookNotification(userId, historyId) {
    try {
      console.log('🔔 Handling webhook notification for user:', userId, 'historyId:', historyId);
      
      // Get user data
      const userDoc = await db.collection('users').doc(userId).get();
      if (!userDoc.exists) {
        throw new Error('User not found');
      }
      
      const userData = userDoc.data();
      if (!userData.googleAccessToken || !userData.googleRefreshToken) {
        throw new Error('User not connected to Gmail');
      }

      // Initialize Gmail API
      const gmail = await this.initializeGmail(
        userData.googleAccessToken,
        userData.googleRefreshToken
      );

      // Get the history to find new messages
      const lastHistoryId = userData.gmailWatch?.historyId || historyId;
      
      console.log('📜 Fetching Gmail history from:', lastHistoryId, 'to:', historyId);
      
      const historyResponse = await gmail.users.history.list({
        userId: 'me',
        startHistoryId: lastHistoryId,
        historyTypes: ['messageAdded']
      });

      const history = historyResponse.data.history || [];
      console.log('📨 Found', history.length, 'history items');

      // Process new messages
      for (const historyItem of history) {
        if (historyItem.messagesAdded) {
          for (const messageAdded of historyItem.messagesAdded) {
            const messageId = messageAdded.message.id;
            console.log('🆕 Processing new message:', messageId);
            
            await this.processIncomingEmail(userId, messageId, historyId);
          }
        }
      }

      // Update last history ID
      await db.collection('users').doc(userId).update({
        'gmailWatch.historyId': historyId,
        'gmailWatch.lastActivity': admin.firestore.FieldValue.serverTimestamp()
      });

      console.log('✅ Webhook notification processed successfully');
      
    } catch (error) {
      console.error('❌ Error handling webhook notification:', error);
      throw error;
    }
  }

  async initializeGmail(accessToken, refreshToken) {
    try {
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
      );
      
      oauth2Client.setCredentials({
        access_token: accessToken,
        refresh_token: refreshToken
      });

      oauth2Client.on('tokens', async (tokens) => {
        if (tokens.refresh_token) {
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

  async setupEmailWatch(userId, accessToken, refreshToken, options = {}) {
    try {
      if (!userId || !accessToken || !refreshToken) {
        throw new Error('Missing required parameters: userId, accessToken, or refreshToken');
      }

      const gmail = await this.initializeGmail(accessToken, refreshToken);
      
      const existingWatch = await this.getExistingWatch(userId);
      if (existingWatch && this.isWatchValid(existingWatch)) {
        console.log(`Valid watch already exists for user ${userId}`);
        return existingWatch;
      }

      const watchRequest = {
        userId: 'me',
        requestBody: {
          topicName: `projects/${process.env.GOOGLE_CLOUD_PROJECT_ID}/topics/gmail-notifications`,
          labelIds: options.labelIds || ['INBOX'],
          labelFilterAction: options.labelFilterAction || 'include'
        }
      };

      const response = await gmail.users.watch(watchRequest);
      
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
      this.scheduleWatchRenewal(userId, response.data.expiration);

      console.log(`Gmail watch setup successfully for user ${userId}`, {
        historyId: response.data.historyId,
        expiration: new Date(parseInt(response.data.expiration))
      });

      return response.data;
    } catch (error) {
      console.error('Error setting up Gmail watch:', error);
      await this.logWatchError(userId, 'setup', error.message);
      throw new Error(`Failed to setup Gmail watch: ${error.message}`);
    }
  }

  async processIncomingEmail(userId, messageId, historyId) {
    try {
      if (!userId || !messageId) {
        throw new Error('Missing required parameters: userId or messageId');
      }

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
      if (!userData.googleAccessToken || !userData.googleRefreshToken) {
        console.error(`No Gmail tokens found for user ${userId}`);
        return;
      }

      const gmail = await this.initializeGmail(
        userData.googleAccessToken,
        userData.googleRefreshToken
      );

      const message = await this.getMessageWithRetry(gmail, messageId);
      if (!message) return;

      const email = this.parseEmailData(message.data);
      
      // Check if this is an incoming email (not sent by user)
      const userEmail = userData.googleEmail || userData.email;
      const fromEmail = this.extractEmailFromHeader(email.from);
      
      if (fromEmail && fromEmail.toLowerCase() === userEmail?.toLowerCase()) {
        console.log('Skipping outgoing email from user');
        return;
      }
      
      if (await this.shouldIgnoreEmail(userId, email)) {
        console.log(`Ignoring email ${messageId} based on filters`);
        return;
      }

      await this.updateLastActivity(userId);
      
      const shouldSendAutoReply = await this.checkAutoReplyConditions(userId, email);
      
      if (shouldSendAutoReply) {
        console.log('🔄 Conditions met, queueing auto-reply for:', email.from);
        await this.queueAutoReply(userId, email);
      } else {
        console.log('❌ Auto-reply conditions not met for:', email.from);
      }

      await this.storeEmailMetadata(userId, email);

    } catch (error) {
      console.error('Error processing incoming email:', error);
      await this.logWatchError(userId, 'process_email', error.message);
    }
  }

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

  extractEmailFromHeader(headerValue) {
    if (!headerValue) return null;
    const emailRegex = /[\w\.-]+@[\w\.-]+\.\w+/;
    const match = headerValue.match(emailRegex);
    return match ? match[0] : null;
  }

  async checkAutoReplyConditions(userId, email) {
    try {
      const autoReplySnapshot = await db
        .collection('users')
        .doc(userId)
        .collection('autoReplySettings')
        .where('isActive', '==', true)
        .get();

      if (autoReplySnapshot.empty) {
        console.log('No active auto-reply settings found');
        return false;
      }

      const settings = autoReplySnapshot.docs[0].data();

      if (settings.scheduleEnabled && !this.isWithinSchedule(settings.schedule)) {
        console.log('Outside of scheduled hours');
        return false;
      }

      const threadReplied = await this.hasRepliedToThread(userId, email.threadId);
      if (threadReplied && !settings.allowMultipleReplies) {
        console.log('Already replied to this thread');
        return false;
      }

      if (settings.senderFilters && !this.matchesSenderFilters(email.from, settings.senderFilters)) {
        console.log('Sender does not match filters');
        return false;
      }

      if (settings.subjectFilters && !this.matchesSubjectFilters(email.subject, settings.subjectFilters)) {
        console.log('Subject does not match filters');
        return false;
      }

      if (settings.excludeContacts && await this.isFromContact(userId, email.from)) {
        console.log('Email from contact, excluding');
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error checking auto-reply conditions:', error);
      return false;
    }
  }

  async queueAutoReply(userId, email) {
    try {
      console.log('🔍 CRITICAL DEBUG: queueAutoReply called for user:', userId);
      console.log('🔍 Email from:', email.from);
      console.log('🔍 Email subject:', email.subject);

      const settingsSnapshot = await db
        .collection('users')
        .doc(userId)
        .collection('autoReplySettings')
        .where('isActive', '==', true)
        .get();

      if (settingsSnapshot.empty) {
        console.log('❌ No active auto-reply settings found for user:', userId);
        return;
      }

      const settings = settingsSnapshot.docs[0].data();
      const delay = settings.replyDelay || 0;
      const scheduledFor = new Date(Date.now() + (delay * 1000));

      const queueData = {
        emailData: email,
        originalEmail: email,
        status: 'pending',
        priority: email.subject.toLowerCase().includes('urgent') ? 'high' : 'normal',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        scheduledFor: admin.firestore.Timestamp.fromDate(scheduledFor),
        retryCount: 0,
        maxRetries: 3,
        userId: userId,
        source: 'gmail_webhook',
        settings: {
          template: settings.template || 'default',
          signature: settings.signature || '',
          replyToAll: settings.replyToAll || false,
          useAI: settings.useAI || false
        }
      };

      const docRef = await db
        .collection('users')
        .doc(userId)
        .collection('autoReplyQueue')
        .add(queueData);

      console.log('✅ SUCCESSFULLY queued auto-reply:', docRef.id);
      
      await this.updateQueueStats(userId, 'queued');
      
      return docRef;
    } catch (error) {
      console.error('❌ CRITICAL ERROR in queueAutoReply:', error);
      throw error;
    }
  }

  /**
   * Start email watch (alias for setupEmailWatch for compatibility)
   */
  async startEmailWatch(userId) {
    try {
      const userDoc = await db.collection('users').doc(userId).get();
      if (!userDoc.exists) {
        throw new Error('User not found');
      }

      const userData = userDoc.data();
      if (!userData.googleAccessToken || !userData.googleRefreshToken) {
        throw new Error('User not connected to Gmail');
      }

      console.log('🔄 Starting Gmail watch for user:', userId);
      return await this.setupEmailWatch(
        userId, 
        userData.googleAccessToken, 
        userData.googleRefreshToken
      );
    } catch (error) {
      console.error('Error starting email watch:', error);
      throw error;
    }
  }

  /**
   * Stop email watch
   */
  async stopEmailWatch(userId) {
    try {
      const userDoc = await db.collection('users').doc(userId).get();
      if (!userDoc.exists) {
        throw new Error('User not found');
      }

      const userData = userDoc.data();
      if (!userData.googleAccessToken || !userData.googleRefreshToken) {
        throw new Error('User not connected to Gmail');
      }

      console.log('🛑 Stopping Gmail watch for user:', userId);
      
      const gmail = await this.initializeGmail(
        userData.googleAccessToken, 
        userData.googleRefreshToken
      );

      await gmail.users.stop({
        userId: 'me'
      });

      await db.collection('users').doc(userId).update({
        'gmailWatch.isActive': false,
        'gmailWatch.stoppedAt': admin.firestore.FieldValue.serverTimestamp()
      });

      this.activeWatchers.delete(userId);

      console.log('✅ Gmail watch stopped for user:', userId);
      return { success: true };
    } catch (error) {
      console.error('Error stopping Gmail watch:', error);
      return { success: false, error: error.message };
    }
  }

  async updateQueueStats(userId, action) {
    try {
      const statsRef = db.collection('users').doc(userId).collection('stats').doc('autoReply');
      await statsRef.set({
        [action]: admin.firestore.FieldValue.increment(1),
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    } catch (error) {
      console.error('Error updating queue stats:', error);
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
        
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }

  isRateLimited(userId) {
    const key = `rate_limit_${userId}`;
    const now = Date.now();
    const windowMs = 60 * 1000;
    const maxRequests = 30;
    
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
    const noReplyPatterns = [
      /noreply/i,
      /no-reply/i,
      /donotreply/i,
      /do-not-reply/i,
      /automated/i,
      /notification/i
    ];
    
    return noReplyPatterns.some(pattern => pattern.test(email.from));
  }

  isWithinSchedule(schedule) {
    if (!schedule) return true;
    
    const now = new Date();
    const currentHour = now.getHours();
    const currentDay = now.getDay();
    
    return schedule.days.includes(currentDay) && 
           currentHour >= schedule.startHour && 
           currentHour < schedule.endHour;
  }

  matchesSenderFilters(from, filters) {
    if (!filters || filters.length === 0) return true;
    
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
    if (!filters || filters.length === 0) return true;
    
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
    // Implement contact checking logic here
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
        if (userData.googleAccessToken && userData.googleRefreshToken) {
          await this.setupEmailWatch(
            userId,
            userData.googleAccessToken,
            userData.googleRefreshToken
          );
        }
      }
    } catch (error) {
      console.error(`Failed to renew watch for user ${userId}:`, error);
    }
  }

  async logWatchError(userId, operation, errorMessage) {
    try {
      await db
        .collection('users')
        .doc(userId)
        .collection('watchErrors')
        .add({
          operation,
          error: errorMessage,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
      console.error('Error logging watch error:', error);
    }
  }

  // Public methods for management
  async stopWatch(userId) {
    try {
      const userDoc = await db.collection('users').doc(userId).get();
      if (!userDoc.exists) return;

      const userData = userDoc.data();
      if (!userData.gmailWatch || !userData.gmailWatch.isActive) return;

      const gmail = await this.initializeGmail(
        userData.googleAccessToken,
        userData.googleRefreshToken
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