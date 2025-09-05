const cron = require('node-cron');
// FIX: Import the entire service instead of destructuring
// FIX: Import the class and instantiate it
const AIReplyService = require('./aiReplyService');
const aiReplyService = new AIReplyService();

class AutoReplyScheduler {
  constructor() {
    this.isRunning = false;
    this.cronJob = null;
    this.processingInterval = null;
    this.config = {
      cronPattern: '* * * * *', // Every minute by default
      timezone: 'Asia/Kolkata',
      maxRetries: 3,
      retryDelayMinutes: 5,
      batchSize: 10,
      processingTimeout: 30000, // 30 seconds
      cleanupOlderThanHours: 24
    };
    this.stats = {
      totalProcessed: 0,
      successCount: 0,
      errorCount: 0,
      lastProcessedAt: null,
      lastErrorAt: null,
      lastError: null
    };
  }

  /**
   * Start the auto-reply scheduler
   * @param {Object} options - Configuration options
   * @param {string} options.cronPattern - Cron pattern for scheduling
   * @param {string} options.timezone - Timezone for scheduling
   * @param {number} options.batchSize - Number of items to process per batch
   */
  start(options = {}) {
    if (this.isRunning) {
      console.warn('⚠️ Auto-reply scheduler is already running');
      return;
    }

    // Merge provided options with default config
    this.config = { ...this.config, ...options };

    try {
      // Validate cron pattern
      if (!cron.validate(this.config.cronPattern)) {
        throw new Error(`Invalid cron pattern: ${this.config.cronPattern}`);
      }

      this.cronJob = cron.schedule(this.config.cronPattern, async () => {
        await this._processQueue();
      }, {
        scheduled: true,
        timezone: this.config.timezone
      });

      // Start cleanup job - runs every hour
      this.cleanupJob = cron.schedule('0 * * * *', async () => {
        await this._cleanupOldEntries();
      }, {
        scheduled: true,
        timezone: this.config.timezone
      });

      this.isRunning = true;
      console.log(`🤖 Auto-reply scheduler started with pattern: ${this.config.cronPattern}`);
      console.log(`📍 Timezone: ${this.config.timezone}`);
      console.log(`📦 Batch size: ${this.config.batchSize}`);
    } catch (error) {
      console.error('❌ Failed to start auto-reply scheduler:', error.message);
      throw error;
    }
  }/**
 * Clear all pending auto-reply queue items
 */
async clearPendingQueue() {
  try {
    const firebaseAdmin = require('./firebaseAdmin');
    const db = firebaseAdmin.db;
    
    console.log('🧹 Clearing pending auto-reply queue...');
    
    // Get all users
    const usersSnapshot = await db.collection('users').get();
    let deletedCount = 0;
    
    for (const userDoc of usersSnapshot.docs) {
      const pendingSnapshot = await db
        .collection('users')
        .doc(userDoc.id)
        .collection('autoReplyQueue')
        .where('status', 'in', ['pending', 'scheduled', 'processing'])
        .get();
      
      const batch = db.batch();
      pendingSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      if (!pendingSnapshot.empty) {
        await batch.commit();
        deletedCount += pendingSnapshot.size;
      }
    }
    
    console.log(`🗑️ Cleared ${deletedCount} pending auto-reply items from queue`);
    return deletedCount;
  } catch (error) {
    console.error('❌ Failed to clear pending queue:', error.message);
    throw error;
  }
}

  /**
   * Stop the auto-reply scheduler
   */
  stop() {
    if (this.cronJob) {
      this.cronJob.destroy();
      this.cronJob = null;
    }

    if (this.cleanupJob) {
      this.cleanupJob.destroy();
      this.cleanupJob = null;
    }

    this.isRunning = false;
    console.log('🛑 Auto-reply scheduler stopped');
    this._logStats();
  }

  /**
   * Schedule a delayed auto-reply
   * @param {string} userId - User ID
   * @param {Object} emailData - Email data to process
   * @param {number} delayMinutes - Delay in minutes
   * @param {Object} settings - Auto-reply settings
   * @param {Object} options - Additional options
   * @returns {Promise<string>} Document ID of the scheduled reply
   */
  async scheduleDelayedAutoReply(userId, emailData, delayMinutes, settings, options = {}) {
    try {
      this._validateInputs(userId, emailData, delayMinutes, settings);

      const firebaseAdmin = require('./firebaseAdmin');
      const db = firebaseAdmin.db; // Use the db property from the service
      const admin = require('firebase-admin');
      
      const scheduledTime = new Date();
      scheduledTime.setMinutes(scheduledTime.getMinutes() + delayMinutes);

      const queueData = {
        emailData,
        settings,
        status: 'pending', // Changed from 'scheduled' to 'pending'
        priority: options.priority || 'normal', // low, normal, high
        retryCount: 0,
        maxRetries: options.maxRetries || this.config.maxRetries,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        scheduledFor: admin.firestore.Timestamp.fromDate(scheduledTime),
        userId,
        metadata: {
          source: options.source || 'api',
          tags: options.tags || [],
          correlationId: options.correlationId || this._generateCorrelationId()
        }
      };

      const docRef = await db
        .collection('users')
        .doc(userId)
        .collection('autoReplyQueue')
        .add(queueData);

      console.log(`📅 Auto-reply scheduled for ${scheduledTime.toISOString()} (${delayMinutes} minutes from now)`);
      console.log(`📄 Document ID: ${docRef.id}`);
      
      return docRef.id;
    } catch (error) {
      console.error('❌ Failed to schedule auto-reply:', error.message);
      throw error;
    }
  }

  /**
   * Cancel a scheduled auto-reply
   * @param {string} userId - User ID
   * @param {string} documentId - Document ID of the scheduled reply
   */
  async cancelScheduledReply(userId, documentId) {
    try {
      const firebaseAdmin = require('./firebaseAdmin');
      const db = firebaseAdmin.db;

      await db
        .collection('users')
        .doc(userId)
        .collection('autoReplyQueue')
        .doc(documentId)
        .update({
          status: 'cancelled',
          cancelledAt: require('firebase-admin').firestore.FieldValue.serverTimestamp()
        });

      console.log(`❌ Auto-reply cancelled: ${documentId}`);
    } catch (error) {
      console.error('❌ Failed to cancel auto-reply:', error.message);
      throw error;
    }
  }

  /**
   * Get scheduler statistics
   * @returns {Object} Current statistics
   */
  getStats() {
    return {
      ...this.stats,
      isRunning: this.isRunning,
      config: { ...this.config },
      uptime: this.isRunning ? Date.now() - this.startTime : 0
    };
  }

  /**
   * Update scheduler configuration
   * @param {Object} newConfig - New configuration options
   */
  updateConfig(newConfig) {
    const wasRunning = this.isRunning;
    
    if (wasRunning) {
      this.stop();
    }

    this.config = { ...this.config, ...newConfig };

    if (wasRunning) {
      this.start();
    }

    console.log('⚙️ Scheduler configuration updated');
  }

  /**
   * Get pending queue items for a user
   * @param {string} userId - User ID
   * @param {number} limit - Maximum number of items to return
   * @returns {Promise<Array>} Pending queue items
   */
  async getPendingItems(userId, limit = 50) {
    try {
      const firebaseAdmin = require('./firebaseAdmin');
      const db = firebaseAdmin.db;

      const snapshot = await db
        .collection('users')
        .doc(userId)
        .collection('autoReplyQueue')
        .where('status', 'in', ['pending', 'processing', 'retry'])
        .orderBy('scheduledFor', 'asc')
        .limit(limit)
        .get();

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        scheduledFor: doc.data().scheduledFor?.toDate(),
        createdAt: doc.data().createdAt?.toDate()
      }));
    } catch (error) {
      console.error('❌ Failed to get pending items:', error.message);
      throw error;
    }
  }

  // Private methods

  /**
   * Process the auto-reply queue
   * @private
   */
  async _processQueue() {
    if (this.isProcessing) {
      console.warn('⚠️ Queue processing already in progress, skipping...');
      return;
    }

    this.isProcessing = true;
    const startTime = Date.now();

    try {
      console.log('🔄 Processing auto-reply queue...');
      
      const processTimeout = setTimeout(() => {
        console.warn('⏰ Queue processing timeout reached');
      }, this.config.processingTimeout);

      // FIX: Call the method on the service instance to preserve 'this' context
      const result = await aiReplyService.processAutoReplyQueue();
      
      clearTimeout(processTimeout);
      
      this.stats.totalProcessed++;
      this.stats.successCount++;
      this.stats.lastProcessedAt = new Date();
      
      const duration = Date.now() - startTime;
      console.log(`✅ Queue processing completed in ${duration}ms`);
      console.log(`📊 Processed: ${result.processed}, Failed: ${result.failed}`);
      
    } catch (error) {
      this.stats.errorCount++;
      this.stats.lastErrorAt = new Date();
      this.stats.lastError = error.message;
      
      console.error('❌ Queue processing failed:', error.message);
      
      // Implement exponential backoff for retries
      await this._sleep(Math.min(1000 * Math.pow(2, this.stats.errorCount), 30000));
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Clean up old entries from the queue
   * @private
   */
  async _cleanupOldEntries() {
    try {
      const firebaseAdmin = require('./firebaseAdmin');
      const db = firebaseAdmin.db;
      const admin = require('firebase-admin');
      
      const cutoffTime = new Date();
      cutoffTime.setHours(cutoffTime.getHours() - this.config.cleanupOlderThanHours);
      
      console.log('🧹 Cleaning up old queue entries...');
      
      // This is a simplified cleanup - in production, you might want to use Cloud Functions
      // or batch operations for better performance
      const usersSnapshot = await db.collection('users').get();
      let cleanedCount = 0;
      
      for (const userDoc of usersSnapshot.docs) {
        const oldEntriesSnapshot = await db
          .collection('users')
          .doc(userDoc.id)
          .collection('autoReplyQueue')
          .where('status', 'in', ['sent', 'failed', 'cancelled'])
          .where('createdAt', '<', admin.firestore.Timestamp.fromDate(cutoffTime))
          .limit(100) // Process in batches
          .get();
        
        const batch = db.batch();
        oldEntriesSnapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        
        if (!oldEntriesSnapshot.empty) {
          await batch.commit();
          cleanedCount += oldEntriesSnapshot.size;
        }
      }
      
      if (cleanedCount > 0) {
        console.log(`🗑️ Cleaned up ${cleanedCount} old queue entries`);
      }
    } catch (error) {
      console.error('❌ Cleanup failed:', error.message);
    }
  }

  /**
   * Validate inputs for scheduling
   * @private
   */
  _validateInputs(userId, emailData, delayMinutes, settings) {
    if (!userId || typeof userId !== 'string') {
      throw new Error('Valid userId is required');
    }
    if (!emailData || typeof emailData !== 'object') {
      throw new Error('Valid emailData object is required');
    }
    if (!Number.isInteger(delayMinutes) || delayMinutes < 0) {
      throw new Error('delayMinutes must be a non-negative integer');
    }
    if (!settings || typeof settings !== 'object') {
      throw new Error('Valid settings object is required');
    }
  }

  /**
   * Generate a correlation ID for tracking
   * @private
   */
  _generateCorrelationId() {
    return `ar_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Log current statistics
   * @private
   */
  _logStats() {
    console.log('📊 Auto-reply Scheduler Statistics:');
    console.log(`   Total Processed: ${this.stats.totalProcessed}`);
    console.log(`   Success Count: ${this.stats.successCount}`);
    console.log(`   Error Count: ${this.stats.errorCount}`);
    console.log(`   Last Processed: ${this.stats.lastProcessedAt || 'Never'}`);
    if (this.stats.lastError) {
      console.log(`   Last Error: ${this.stats.lastError}`);
    }
  }

  /**
   * Sleep utility function
   * @private
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new AutoReplyScheduler();