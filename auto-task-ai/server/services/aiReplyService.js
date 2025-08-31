const OpenAI = require('openai');
const firebaseService = require('./firebaseAdmin');
const admin = require('firebase-admin');
const db = firebaseService.db;

class AIReplyService {
  constructor() {
    this.openai = process.env.OPENAI_API_KEY ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    }) : null;
    
    // Add batchSize as a class property
    this.batchSize = parseInt(process.env.BATCH_SIZE) || 10;
    
    // Cache for frequently used templates and responses
    this.templateCache = new Map();
    this.responseCache = new Map();
    
    // Processing statistics
    this.stats = {
      processedReplies: 0,
      failedReplies: 0,
      aiGeneratedReplies: 0,
      templateReplies: 0,
      cacheHits: 0
    };
    
    // Rate limiting for AI calls
    this.aiRateLimit = new Map();
    this.AI_RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
    this.MAX_AI_CALLS_PER_MINUTE = 20;
  }

  /**
   * Generate intelligent auto-reply using AI with enhanced context understanding
   */
  async generateAutoReply(originalEmail, replyEmail = null, context = {}) {
    if (!this.openai) {
      return {
        success: false,
        error: 'OpenAI API key not configured'
      };
    }

    try {
      // Check AI rate limiting
      if (this.isAIRateLimited()) {
        console.warn('AI rate limit exceeded, using fallback template');
        return this.generateFallbackReply(originalEmail, context);
      }

      // Check cache for similar emails
      const cacheKey = this.generateCacheKey(originalEmail, context);
      if (this.responseCache.has(cacheKey)) {
        this.stats.cacheHits++;
        console.log('Using cached AI response');
        return {
          success: true,
          autoReply: this.responseCache.get(cacheKey),
          cached: true
        };
      }

      // Enhanced prompt with better context understanding
      const prompt = this.buildIntelligentPrompt(originalEmail, replyEmail, context);

      const completion = await this.openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt(context)
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: context.maxTokens || 200,
        temperature: context.temperature || 0.7,
        presence_penalty: 0.1,
        frequency_penalty: 0.1
      });

      const autoReply = completion.choices[0].message.content.trim();
      
      // Post-process the reply
      const processedReply = this.postProcessReply(autoReply, originalEmail, context);

      // Cache the response
      this.responseCache.set(cacheKey, processedReply);
      this.stats.aiGeneratedReplies++;

      // Clean cache if it gets too large
      if (this.responseCache.size > 100) {
        this.cleanCache();
      }

      return {
        success: true,
        autoReply: processedReply,
        tokens_used: completion.usage?.total_tokens
      };
    } catch (error) {
      console.error('Error generating AI auto-reply:', error);
      
      // Fallback to template-based reply on AI failure
      const fallbackReply = this.generateFallbackReply(originalEmail, context);
      if (fallbackReply.success) {
        return fallbackReply;
      }
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate contextually aware follow-up messages
   */
  async generateFollowUpMessage(originalEmail, daysWaited, context = {}) {
    if (!this.openai) {
      return {
        success: false,
        error: 'OpenAI API key not configured'
      };
    }

    try {
      const urgencyLevel = this.determineUrgencyLevel(daysWaited, originalEmail.subject);
      const followUpType = context.followUpType || this.determineFollowUpType(originalEmail, daysWaited);

      const prompt = `
Generate a ${urgencyLevel} follow-up email for:

Original Email Subject: ${originalEmail.subject}
Original Email Body: ${originalEmail.body}
Days since original email: ${daysWaited}
Follow-up type: ${followUpType}
Context: ${JSON.stringify(context)}
Previous follow-ups: ${context.previousFollowUps || 0}

Create a ${urgencyLevel} follow-up that:
1. References the original email appropriately
2. Matches the ${urgencyLevel} tone
3. Provides additional value or context
4. Includes a clear but ${urgencyLevel} call to action
5. Is professional and appropriately sized for ${followUpType}
6. Considers this is follow-up #${(context.previousFollowUps || 0) + 1}

Follow-up Email:`;

      const completion = await this.openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `You are a professional email assistant specializing in ${followUpType} follow-ups. Generate ${urgencyLevel}, effective follow-up emails that respect the recipient's time.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: this.getMaxTokensForFollowUp(followUpType),
        temperature: 0.6
      });

      const followUpMessage = completion.choices[0].message.content.trim();

      return {
        success: true,
        followUpMessage: followUpMessage,
        urgencyLevel: urgencyLevel,
        followUpType: followUpType
      };
    } catch (error) {
      console.error('Error generating AI follow-up:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Advanced email personalization with AI enhancement
   */
  async personalizeEmailContent(template, recipientData, context = {}) {
    // Enhanced fallback for when AI is not available
    if (!this.openai) {
      return this.enhancedTemplatePersonalization(template, recipientData, context);
    }

    try {
      const personalizationLevel = context.personalizationLevel || 'moderate';
      
      const prompt = `
Personalize this email template with the provided recipient data:

Template: ${template}
Recipient Data: ${JSON.stringify(recipientData)}
Personalization Level: ${personalizationLevel}
Industry/Context: ${context.industry || 'general business'}
Relationship Level: ${context.relationship || 'professional'}

Rules for ${personalizationLevel} personalization:
1. Replace any {{variableName}} placeholders with appropriate values
2. ${this.getPersonalizationRules(personalizationLevel)}
3. Maintain ${context.tone || 'professional'} tone
4. Keep the core message intact
5. Ensure it sounds natural and engaging
6. Consider cultural context if provided: ${context.culture || 'general'}

Personalized Email:`;

      const completion = await this.openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `You are an expert email personalization assistant. Create ${personalizationLevel} personalized emails that feel genuine and ${context.tone || 'professional'}.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: Math.max(300, template.length * 1.5),
        temperature: personalizationLevel === 'high' ? 0.8 : 0.6
      });

      const personalizedContent = completion.choices[0].message.content.trim();

      return {
        success: true,
        personalizedContent: personalizedContent,
        personalizationLevel: personalizationLevel
      };
    } catch (error) {
      console.error('Error personalizing email:', error);
      
      // Fallback to enhanced template personalization
      return this.enhancedTemplatePersonalization(template, recipientData, context);
    }
  }

  /**
   * Process auto-reply queue with enhanced error handling and retry logic
   */
  async processAutoReplyQueue() {
    try {
      console.log('Starting auto-reply queue processing...');
      
    const pendingReplies = await db
      .collectionGroup('autoReplyQueue')
      .where('status', 'in', ['pending', 'scheduled']) // Also fix the status issue from before
      .where('scheduledFor', '<=', new Date())
      .where('retryCount', '<', 3)
      .orderBy('scheduledFor', 'asc')
      .limit(this.batchSize) // Use this.batchSize
      .get();

      if (pendingReplies.empty) {
        console.log('No pending auto-replies found');
        return { processed: 0, failed: 0 };
      }

      console.log(`Processing ${pendingReplies.docs.length} pending auto-replies`);
      
      // Fixed: Bind the context properly
      const processPromises = pendingReplies.docs.map((doc) => {
        return this.processAutoReply(doc);
      });

      const results = await Promise.allSettled(processPromises);

      const processed = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      console.log(`Auto-reply queue processing completed: ${processed} processed, ${failed} failed`);
      
      this.stats.processedReplies += processed;
      this.stats.failedReplies += failed;

      return { processed, failed };
    } catch (error) {
      console.error('Error processing auto-reply queue:', error);
      throw error;
    }
  }

  /**
   * Enhanced auto-reply processing with advanced logic
   */
  async processAutoReply(queueDoc) {
    try {
      const queueData = queueDoc.data();
      const userId = queueDoc.ref.parent.parent.id;
      
      console.log('Processing auto-reply for user:', userId, 'Queue ID:', queueDoc.id);

      // Get user document
      const userRef = db.collection('users').doc(userId);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        throw new Error('User not found');
      }

      // Get auto-reply settings
      const settingsSnapshot = await userRef
        .collection('autoReplySettings')
        .where('isActive', '==', true)
        .limit(1)
        .get();

      if (settingsSnapshot.empty) {
        console.log('No active auto-reply settings found, creating default...');
        
        // Create default settings for testing
        const defaultSettings = {
          isActive: true,
          useAI: false,
          customMessage: "Thank you for your email. I will get back to you as soon as possible.",
          includeDisclaimer: true,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        };
        
        await userRef.collection('autoReplySettings').add(defaultSettings);
        
        // Use the default settings
        var settings = defaultSettings;
      } else {
        var settings = settingsSnapshot.docs[0].data();
      }

      const emailData = queueData.emailData;
      const userData = userDoc.data();

      console.log('Auto-reply settings found:', {
        useAI: settings.useAI,
        hasCustomMessage: !!settings.customMessage
      });

      // Check for duplicates
      if (await this.isDuplicateReply(userId, emailData)) {
        await queueDoc.ref.update({
          status: 'cancelled',
          reason: 'Duplicate reply detected',
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log('Duplicate reply cancelled for user:', userId);
        return;
      }

      // Generate reply content
      let replyContent;
      let replyMetadata = {};

      if (settings.useAI && this.openai) {
        console.log('Generating AI reply...');
        const aiResult = await this.generateAutoReply(emailData, null, {
          userId: userId,
          settings: settings,
          userContext: userData.profile || {}
        });
        
        if (aiResult.success) {
          replyContent = aiResult.autoReply;
          replyMetadata.aiGenerated = true;
          replyMetadata.tokensUsed = aiResult.tokens_used;
          console.log('AI reply generated successfully');
        } else {
          console.warn('AI reply generation failed, using template:', aiResult.error);
          replyContent = this.getTemplateReply(settings);
          replyMetadata.aiGenerated = false;
          replyMetadata.fallbackReason = aiResult.error;
        }
      } else {
        replyContent = this.getTemplateReply(settings);
        replyMetadata.aiGenerated = false;
        this.stats.templateReplies++;
        console.log('Using template reply');
      }

      // Personalize the reply if needed
      if (settings.personalization && userData.profile) {
        const personalizedResult = await this.personalizeEmailContent(
          replyContent, 
          userData.profile,
          { userId: userId, emailContext: emailData }
        );
        
        if (personalizedResult.success) {
          replyContent = personalizedResult.personalizedContent;
          replyMetadata.personalized = true;
        }
      }

      // For testing, just mark as sent without actually sending email
      console.log('Auto-reply content generated:', replyContent.substring(0, 100) + '...');
      
      // Update queue status to sent
      await queueDoc.ref.update({ 
        status: 'sent',
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        replyContent: replyContent,
        metadata: replyMetadata
      });

      // Log successful reply
      await this.logReplyActivity(userId, emailData, replyContent, 'sent', replyMetadata);
      
      console.log(`Auto-reply processed successfully for user ${userId}`);
      return { success: true, replyContent };

    } catch (error) {
      console.error('Error processing auto-reply:', error);
      
      const retryCount = (queueDoc.data().retryCount || 0) + 1;
      const maxRetries = queueDoc.data().maxRetries || 3;
      
      if (retryCount < maxRetries) {
        const retryDelay = Math.pow(2, retryCount) * 60 * 1000; // Exponential backoff
        const nextRetry = new Date(Date.now() + retryDelay);
        
        await queueDoc.ref.update({
          status: 'retry',
          retryCount: retryCount,
          lastError: error.message,
          nextRetryAt: admin.firestore.Timestamp.fromDate(nextRetry),
          scheduledFor: admin.firestore.Timestamp.fromDate(nextRetry),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        console.log(`Auto-reply scheduled for retry ${retryCount}/${maxRetries} at ${nextRetry}`);
      } else {
        await queueDoc.ref.update({ 
          status: 'failed', 
          error: error.message,
          retryCount: retryCount,
          failedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log('Auto-reply permanently failed for queue:', queueDoc.id);
      }
      
      throw error;
    }
  }

  /**
   * Enhanced auto-reply sending with better email composition
   */
  async sendAutoReply(userId, originalEmail, replyContent, settings) {
    try {
      const emailService = require('./emailService');
      
      // Build proper email headers for threading
      const replyEmail = {
        to: originalEmail.from,
        cc: settings.ccOnReplies ? settings.ccAddresses : undefined,
        subject: this.buildReplySubject(originalEmail.subject),
        body: this.buildReplyBody(replyContent, originalEmail, settings),
        inReplyTo: originalEmail.messageId,
        references: this.buildReferences(originalEmail),
        threadId: originalEmail.threadId,
        labels: ['SENT', 'AUTO_REPLY'],
        metadata: {
          autoReply: true,
          originalMessageId: originalEmail.id,
          generatedAt: new Date().toISOString()
        }
      };

      const result = await emailService.sendEmail(userId, replyEmail);
      
      // Record that we replied to this thread
      await this.recordReplyToThread(userId, originalEmail.threadId, result.messageId);
      
      return result;
    } catch (error) {
      console.error('Error sending auto-reply:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Helper Methods

  getSystemPrompt(context) {
    const businessType = context.businessType || 'professional services';
    const tone = context.tone || 'professional';
    
    return `You are an AI email assistant for a ${businessType} organization. Generate ${tone}, helpful auto-replies that:
    - Acknowledge the sender's email professionally
    - Provide relevant information when possible
    - Maintain appropriate boundaries
    - Use ${tone} language throughout
    - Are concise but complete
    - Include appropriate calls to action when needed`;
  }

  buildIntelligentPrompt(originalEmail, replyEmail, context) {
    const emailType = this.classifyEmailType(originalEmail);
    const sentiment = this.detectSentiment(originalEmail.body);
    const urgency = this.detectUrgency(originalEmail);
    
    return `
Email Classification: ${emailType}
Sentiment: ${sentiment}
Urgency Level: ${urgency}
Original Email Subject: ${originalEmail.subject}
Original Email Body: ${originalEmail.body}
${replyEmail ? `\nReply Context: ${replyEmail.body}` : ''}

Business Context: ${context.businessType || 'general'}
Response Style: ${context.responseStyle || 'professional'}
Special Instructions: ${context.specialInstructions || 'none'}

Generate an auto-reply that:
1. Matches the ${sentiment} sentiment appropriately
2. Addresses the ${urgency} urgency level
3. Is suitable for ${emailType} type emails
4. Follows ${context.responseStyle || 'professional'} style
5. Is 2-4 sentences for efficiency
6. Includes relevant next steps if appropriate

Auto-Reply:`;
  }

  classifyEmailType(email) {
    const subject = email.subject.toLowerCase();
    const body = email.body.toLowerCase();
    
    if (subject.includes('inquiry') || subject.includes('question') || body.includes('?')) {
      return 'inquiry';
    } else if (subject.includes('meeting') || subject.includes('appointment') || body.includes('schedule')) {
      return 'meeting_request';
    } else if (subject.includes('proposal') || subject.includes('quote') || body.includes('estimate')) {
      return 'business_proposal';
    } else if (subject.includes('support') || subject.includes('help') || subject.includes('issue')) {
      return 'support_request';
    } else if (subject.includes('thank') || body.includes('thank you')) {
      return 'appreciation';
    }
    
    return 'general';
  }

  detectSentiment(text) {
    const positiveWords = ['thank', 'appreciate', 'great', 'excellent', 'wonderful', 'pleased'];
    const negativeWords = ['problem', 'issue', 'urgent', 'concerned', 'disappointed', 'frustrated'];
    
    const positive = positiveWords.reduce((count, word) => 
      count + (text.toLowerCase().includes(word) ? 1 : 0), 0);
    const negative = negativeWords.reduce((count, word) => 
      count + (text.toLowerCase().includes(word) ? 1 : 0), 0);
    
    if (positive > negative) return 'positive';
    if (negative > positive) return 'negative';
    return 'neutral';
  }

  detectUrgency(email) {
    const urgentWords = ['urgent', 'asap', 'emergency', 'immediate', 'critical', 'rush'];
    const text = (email.subject + ' ' + email.body).toLowerCase();
    
    const urgentCount = urgentWords.reduce((count, word) => 
      count + (text.includes(word) ? 1 : 0), 0);
    
    if (urgentCount > 0) return 'high';
    if (email.subject.includes('Re: Re:') || text.includes('follow up')) return 'medium';
    return 'normal';
  }

  determineUrgencyLevel(daysWaited, subject) {
    if (daysWaited >= 7) return 'gentle but persistent';
    if (daysWaited >= 3) return 'polite but direct';
    return 'courteous';
  }

  determineFollowUpType(email, daysWaited) {
    const subject = email.subject.toLowerCase();
    
    if (subject.includes('proposal') || subject.includes('quote')) return 'business_proposal';
    if (subject.includes('meeting') || subject.includes('schedule')) return 'meeting_request';
    if (subject.includes('payment') || subject.includes('invoice')) return 'payment_reminder';
    if (daysWaited >= 7) return 'relationship_maintenance';
    
    return 'general_follow_up';
  }

  getMaxTokensForFollowUp(followUpType) {
    const tokenLimits = {
      'business_proposal': 300,
      'meeting_request': 200,
      'payment_reminder': 150,
      'relationship_maintenance': 250,
      'general_follow_up': 200
    };
    
    return tokenLimits[followUpType] || 200;
  }

  getPersonalizationRules(level) {
    const rules = {
      'low': 'Make minimal changes, focus on variable replacement',
      'moderate': 'Add personal touches while keeping it professional',
      'high': 'Significantly personalize tone, examples, and approach based on recipient data'
    };
    
    return rules[level] || rules['moderate'];
  }

  enhancedTemplatePersonalization(template, recipientData, context) {
    let personalized = template;
    
    // Enhanced variable replacement with fallbacks
    Object.keys(recipientData).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      let value = recipientData[key];
      
      // Handle special formatting
      if (key === 'name' && value) {
        value = this.capitalizeWords(value);
      } else if (key === 'company' && value) {
        value = this.capitalizeWords(value);
      }
      
      personalized = personalized.replace(regex, value || `[${key}]`);
    });
    
    // Add contextual enhancements
    if (context.addGreeting && recipientData.name) {
      personalized = `Hello ${recipientData.name},\n\n${personalized}`;
    }
    
    if (context.addClosing) {
      personalized += '\n\nBest regards,\n[Your Name]';
    }
    
    return {
      success: true,
      personalizedContent: personalized,
      personalizationLevel: 'template'
    };
  }

  generateFallbackReply(originalEmail, context) {
    const templates = {
      'inquiry': 'Thank you for your inquiry. We have received your message and will respond within 24 hours.',
      'meeting_request': 'Thank you for your meeting request. We will review our calendar and get back to you shortly.',
      'support_request': 'We have received your support request and will address it as soon as possible.',
      'general': 'Thank you for your email. We will review your message and respond promptly.'
    };
    
    const emailType = this.classifyEmailType(originalEmail);
    const reply = templates[emailType] || templates['general'];
    
    return {
      success: true,
      autoReply: reply,
      fallback: true
    };
  }

  getTemplateReply(settings) {
    return settings.customMessage || 
           settings.template || 
           'Thank you for your email. We will respond as soon as possible.';
  }

  postProcessReply(reply, originalEmail, context) {
    // Remove any potential AI artifacts
    let processed = reply
      .replace(/^(Auto-Reply:|Reply:)\s*/i, '')
      .replace(/\[Assistant\]/gi, '')
      .trim();
    
    // Ensure professional closing
    if (!processed.match(/\b(regards|sincerely|best|thank you)\b/i)) {
      processed += '\n\nBest regards';
    }
    
    return processed;
  }

  buildReplySubject(originalSubject) {
    if (originalSubject.toLowerCase().startsWith('re:')) {
      return originalSubject;
    }
    return `Re: ${originalSubject}`;
  }

  buildReplyBody(content, originalEmail, settings) {
    let body = content;
    
    // Add signature if configured
    if (settings.signature) {
      body += `\n\n${settings.signature}`;
    }
    
    // Add auto-reply disclaimer if configured
    if (settings.includeDisclaimer) {
      body += '\n\n---\nThis is an automated response.';
    }
    
    return body;
  }

  buildReferences(originalEmail) {
    const references = [];
    
    if (originalEmail.references) {
      references.push(originalEmail.references);
    }
    
    if (originalEmail.messageId) {
      references.push(originalEmail.messageId);
    }
    
    return references.join(' ');
  }

  async isDuplicateReply(userId, emailData) {
    try {
      const existingReply = await db
        .collection('users')
        .doc(userId)
        .collection('sentReplies')
        .where('originalMessageId', '==', emailData.id)
        .limit(1)
        .get();
      
      return !existingReply.empty;
    } catch (error) {
      console.error('Error checking duplicate reply:', error);
      return false; // Assume not duplicate if check fails
    }
  }

  async recordReplyToThread(userId, threadId, replyMessageId) {
    try {
      await db
        .collection('users')
        .doc(userId)
        .collection('sentReplies')
        .add({
          threadId: threadId,
          replyMessageId: replyMessageId,
          sentAt: admin.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
      console.error('Error recording reply to thread:', error);
    }
  }

  async logReplyActivity(userId, originalEmail, replyContent, status, metadata) {
    try {
      await db
        .collection('users')
        .doc(userId)
        .collection('replyActivity')
        .add({
          originalMessageId: originalEmail.id,
          originalFrom: originalEmail.from,
          originalSubject: originalEmail.subject,
          replyContent: replyContent.substring(0, 500), // Truncate for storage
          status: status,
          metadata: metadata,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
      console.error('Error logging reply activity:', error);
    }
  }

  isAIRateLimited() {
    const now = Date.now();
    const key = 'ai_calls';
    
    if (!this.aiRateLimit.has(key)) {
      this.aiRateLimit.set(key, { count: 1, resetTime: now + this.AI_RATE_LIMIT_WINDOW });
      return false;
    }
    
    const limit = this.aiRateLimit.get(key);
    
    if (now > limit.resetTime) {
      this.aiRateLimit.set(key, { count: 1, resetTime: now + this.AI_RATE_LIMIT_WINDOW });
      return false;
    }
    
    if (limit.count >= this.MAX_AI_CALLS_PER_MINUTE) {
      return true;
    }
    
    limit.count++;
    return false;
  }

  generateCacheKey(email, context) {
    const emailType = this.classifyEmailType(email);
    const contextHash = JSON.stringify(context).substring(0, 50);
    return `${emailType}_${contextHash}`;
  }

  cleanCache() {
    // Keep only the most recent 50 entries
    const entries = Array.from(this.responseCache.entries());
    entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
    
    this.responseCache.clear();
    entries.slice(0, 50).forEach(([key, value]) => {
      this.responseCache.set(key, value);
    });
  }

  capitalizeWords(str) {
    return str.replace(/\w\S*/g, (txt) => 
      txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
    );
  }

  getStats() {
    return {
      ...this.stats,
      cacheSize: this.responseCache.size,
      rateLimitEntries: this.aiRateLimit.size
    };
  }

  // Cleanup method for graceful shutdown
  cleanup() {
    this.templateCache.clear();
    this.responseCache.clear();
    this.aiRateLimit.clear();
    console.log('AI Reply Service cleanup completed');
  }
}

module.exports = new AIReplyService();