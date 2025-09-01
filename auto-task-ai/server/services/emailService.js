const { google } = require('googleapis');
const firebaseAdmin = require('./firebaseAdmin');
const admin = firebaseAdmin.admin;

// Create Gmail API client for a specific user
const createGmailClient = async (userId) => {
  try {
    console.log('Creating Gmail API client for user:', userId);
    
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      throw new Error('User document not found in database');
    }
    
    const userData = userDoc.data();
    const user_refresh_token = userData.googleRefreshToken;
    
    if (!user_refresh_token) {
      throw new Error(`User has not connected their Google account. Please connect Gmail account first.`);
    }
    
    if (!userData.googleConnected) {
      throw new Error('Google account connection is disabled. Please reconnect your Gmail account.');
    }
    
    console.log('User has valid Google refresh token, creating OAuth2 client...');
    console.log('User email from database:', userData.googleEmail);
    
    // Create OAuth2 client with proper credentials
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    
    oauth2Client.setCredentials({
      refresh_token: user_refresh_token
    });
    
    console.log('Getting fresh access token...');
    // Get fresh access token
    const tokenResponse = await oauth2Client.getAccessToken();
    
    if (!tokenResponse.token) {
      throw new Error('Failed to obtain Google access token. Please reconnect your Gmail account.');
    }
    
    console.log('Access token obtained successfully');
    
    // Create Gmail API client
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    return { gmail, userEmail: userData.googleEmail, displayName: userData.displayName };
  } catch (error) {
    console.error('Error creating Gmail API client:', error);
    
    // Handle specific Google OAuth errors
    if (error.message.includes('invalid_grant')) {
      throw new Error('Google refresh token is invalid or expired. Please reconnect your Gmail account.');
    } else if (error.message.includes('insufficient_scope')) {
      throw new Error('Insufficient Gmail permissions. Please reconnect your Gmail account with full permissions.');
    } else if (error.message.includes('unauthorized_client')) {
      throw new Error('Gmail OAuth configuration error. Please contact support.');
    } else if (error.message.includes('invalid_request')) {
      throw new Error('Gmail OAuth configuration error. Please check your Google Cloud Console settings.');
    }
    
    throw error;
  }
};

// Create email message in RFC 2822 format
const createEmailMessage = ({ from, to, cc, bcc, subject, html, text }) => {
  const boundary = `boundary_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  let message = '';
  
  // Headers
  message += `From: ${from}\r\n`;
  message += `To: ${Array.isArray(to) ? to.join(', ') : to}\r\n`;
  
  if (cc && cc.length > 0) {
    message += `Cc: ${Array.isArray(cc) ? cc.join(', ') : cc}\r\n`;
  }
  
  if (bcc && bcc.length > 0) {
    message += `Bcc: ${Array.isArray(bcc) ? bcc.join(', ') : bcc}\r\n`;
  }
  
  message += `Subject: ${subject}\r\n`;
  message += `MIME-Version: 1.0\r\n`;
  
  // If we have both HTML and text, create multipart message
  if (html && text) {
    message += `Content-Type: multipart/alternative; boundary="${boundary}"\r\n\r\n`;
    
    // Text part
    message += `--${boundary}\r\n`;
    message += `Content-Type: text/plain; charset=utf-8\r\n`;
    message += `Content-Transfer-Encoding: 7bit\r\n\r\n`;
    message += `${text}\r\n\r\n`;
    
    // HTML part
    message += `--${boundary}\r\n`;
    message += `Content-Type: text/html; charset=utf-8\r\n`;
    message += `Content-Transfer-Encoding: 7bit\r\n\r\n`;
    message += `${html}\r\n\r\n`;
    
    message += `--${boundary}--\r\n`;
  } else if (html) {
    // HTML only
    message += `Content-Type: text/html; charset=utf-8\r\n`;
    message += `Content-Transfer-Encoding: 7bit\r\n\r\n`;
    message += html;
  } else if (text) {
    // Text only
    message += `Content-Type: text/plain; charset=utf-8\r\n`;
    message += `Content-Transfer-Encoding: 7bit\r\n\r\n`;
    message += text;
  }
  
  return message;
};

// FIXED: Function to set up auto-reply settings
const setupAutoReplySettings = async (userId, autoReplyConfig, recipients, originalSubject) => {
  try {
    console.log('🔧 Setting up auto-reply settings for user:', userId);
    
    // FIXED: Use simple timestamp instead of Firebase serverTimestamp
    const timestamp = new Date().toISOString();
    
    // Create auto-reply settings document
    const autoReplySettings = {
      isActive: true,
      useAI: autoReplyConfig.useAI || false,
      replyType: autoReplyConfig.replyType || 'standard',
      aiTone: autoReplyConfig.aiTone || 'professional',
      
      // Template/Custom message
      hasCustomMessage: autoReplyConfig.replyType === 'custom',
      customMessage: autoReplyConfig.customMessage || '',
      template: {
        subject: 'Re: {originalSubject}',
        body: autoReplyConfig.customMessage || 'Thank you for your email. I will get back to you soon!'
      },
      
      // Advanced settings
      delay: autoReplyConfig.delayMinutes || 0, // in minutes
      replyOnlyOnce: autoReplyConfig.replyOnlyOnce !== false, // default true
      skipKeywords: autoReplyConfig.skipKeywords || [],
      
      // Business hours
      onlyDuringHours: autoReplyConfig.onlyDuringHours || false,
      businessHours: {
        start: autoReplyConfig.businessHoursStart || '09:00',
        end: autoReplyConfig.businessHoursEnd || '17:00'
      },
      
      // Context for replies (IMPORTANT ADDITION)
      originalSubject: originalSubject,
      expectedRepliers: recipients, // Who we expect replies from
      
      // Metadata - FIXED: using simple timestamp
      createdAt: timestamp,
      updatedAt: timestamp,
      createdBy: 'email_scheduler',
      
      // Important: This is for FUTURE incoming replies, not immediate processing
      triggerCondition: 'incoming_reply_only',
      waitingForReplies: true
    };
    
    // Save to database - FIXED: use admin.firestore() with parentheses
    const settingsRef = await admin.firestore()
      .collection('users')
      .doc(userId)
      .collection('autoReplySettings')
      .add(autoReplySettings);
    
    console.log('✅ Auto-reply settings saved. Will trigger when replies are received.');
    console.log('📋 Settings ID:', settingsRef.id);
    console.log('📧 Original subject:', originalSubject);
    console.log('👥 Expected repliers:', recipients);
    console.log('🚫 NO auto-reply sent immediately - waiting for incoming replies');
    
    return settingsRef.id;
    
  } catch (error) {
    console.error('❌ Error setting up auto-reply settings:', error);
    throw error;
  }
};

// Send email using Gmail API with auto-reply support
const sendEmail = async ({ userId, from, to, cc, bcc, subject, html, text, autoReply }) => {
  try {
    console.log('=== Sending Email via Gmail API ===');
    console.log('User ID:', userId);
    console.log('From:', from);
    console.log('To:', to);
    console.log('Subject:', subject);
    
    // Validate inputs
    if (!userId) {
      throw new Error('User ID is required');
    }
    
    if (!to || (Array.isArray(to) && to.length === 0) || (!Array.isArray(to) && !to)) {
      throw new Error('Recipients (to) must be provided');
    }
    
    if (!subject) {
      throw new Error('Email subject is required');
    }
    
    if (!html && !text) {
      throw new Error('Email content (html or text) is required');
    }
    
    const { gmail, userEmail, displayName } = await createGmailClient(userId);
    
    // Ensure to is an array for consistent handling
    const toArray = Array.isArray(to) ? to : [to];
    const ccArray = cc ? (Array.isArray(cc) ? cc : [cc]) : [];
    const bccArray = bcc ? (Array.isArray(bcc) ? bcc : [bcc]) : [];
    
    // Create the email message
    const fromField = `"${displayName || 'Auto Task AI'}" <${userEmail}>`;
    const emailMessage = createEmailMessage({
      from: fromField,
      to: toArray,
      cc: ccArray,
      bcc: bccArray,
      subject: subject,
      html: html,
      text: text
    });
    
    console.log('Email message created, preparing to send...');
    
    // Encode the message in base64url format
    const encodedMessage = Buffer.from(emailMessage)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    
    // Send the email
    console.log('Sending email via Gmail API...');
    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage
      }
    });
    
    console.log('Email sent successfully via Gmail API');
    console.log('Message ID:', response.data.id);
    console.log('Thread ID:', response.data.threadId);
    
    // Set up auto-reply if enabled - CORRECTED with proper parameters
    if (autoReply && autoReply.enabled) {
      console.log('Setting up auto-reply settings for future replies...');
      try {
        await setupAutoReplySettings(userId, autoReply, toArray, subject);
        console.log('Auto-reply settings configured for when replies are received');
      } catch (autoReplyError) {
        console.error('Failed to set up auto-reply settings:', autoReplyError);
        // Don't fail the email send if auto-reply setup fails
      }
    }
    
    return {
      success: true,
      messageId: response.data.id,
      threadId: response.data.threadId,
      labelIds: response.data.labelIds,
      sentAt: new Date().toISOString(),
      method: 'gmail_api'
    };
    
  } catch (error) {
    console.error('Email sending failed via Gmail API:', error);
    
    // Handle specific Gmail API errors
    let errorMessage = error.message;
    let errorCode = error.code || 'EMAIL_SEND_FAILED';
    
    if (error.response?.data?.error) {
      const gmailError = error.response.data.error;
      errorMessage = gmailError.message || errorMessage;
      errorCode = gmailError.code || errorCode;
      
      // Handle specific Gmail API error codes
      if (gmailError.code === 400) {
        if (gmailError.message.includes('Invalid to header')) {
          errorMessage = 'Invalid recipient email address format';
        } else if (gmailError.message.includes('Precondition check failed')) {
          errorMessage = 'Gmail API precondition failed. Please check email format and try again.';
        }
      } else if (gmailError.code === 403) {
        if (gmailError.message.includes('Insufficient Permission')) {
          errorMessage = 'Insufficient Gmail permissions. Please reconnect your Gmail account with full permissions.';
        } else if (gmailError.message.includes('Daily Limit Exceeded')) {
          errorMessage = 'Gmail API daily limit exceeded. Please try again tomorrow.';
        }
      } else if (gmailError.code === 401) {
        errorMessage = 'Gmail authentication failed. Please reconnect your Gmail account.';
      }
    }
    
    // Return structured error response
    return {
      success: false,
      error: errorMessage,
      errorCode: errorCode,
      sentAt: new Date().toISOString(),
      method: 'gmail_api'
    };
  }
};

// Get email details by message ID
const getEmail = async (userId, messageId) => {
  try {
    const { gmail } = await createGmailClient(userId);
    
    const response = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full'
    });
    
    return {
      success: true,
      email: response.data
    };
  } catch (error) {
    console.error('Error fetching email:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// List emails with optional query
const listEmails = async (userId, options = {}) => {
  try {
    const { gmail } = await createGmailClient(userId);
    
    const params = {
      userId: 'me',
      maxResults: options.maxResults || 10,
      q: options.query || '',
      labelIds: options.labelIds || undefined,
      pageToken: options.pageToken || undefined
    };
    
    const response = await gmail.users.messages.list(params);
    
    return {
      success: true,
      messages: response.data.messages || [],
      nextPageToken: response.data.nextPageToken,
      resultSizeEstimate: response.data.resultSizeEstimate
    };
  } catch (error) {
    console.error('Error listing emails:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Helper function to check if user can send emails
const canUserSendEmails = async (userId) => {
  try {
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return { canSend: false, reason: 'User not found' };
    }
    
    const userData = userDoc.data();
    
    if (!userData.googleRefreshToken) {
      return { canSend: false, reason: 'Gmail account not connected' };
    }
    
    if (!userData.googleConnected) {
      return { canSend: false, reason: 'Gmail account connection disabled' };
    }
    
    // Try to create Gmail client to verify connectivity
    try {
      await createGmailClient(userId);
      return { canSend: true, email: userData.googleEmail };
    } catch (error) {
      return { canSend: false, reason: error.message };
    }
    
  } catch (error) {
    console.error('Error checking user email capabilities:', error);
    return { canSend: false, reason: error.message };
  }
};

// Get user's Gmail profile
const getUserProfile = async (userId) => {
  try {
    const { gmail } = await createGmailClient(userId);
    
    const response = await gmail.users.getProfile({
      userId: 'me'
    });
    
    return {
      success: true,
      profile: response.data
    };
  } catch (error) {
    console.error('Error getting user Gmail profile:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Personalize email content
const personalizeEmail = (content, personalization = {}) => {
  let personalizedContent = content;
  
  // Replace placeholders with actual values
  Object.entries(personalization).forEach(([key, value]) => {
    const placeholder = new RegExp(`{{${key}}}`, 'g');
    personalizedContent = personalizedContent.replace(placeholder, value || '');
  });
  
  // Remove any remaining placeholders
  personalizedContent = personalizedContent.replace(/{{[^}]+}}/g, '');
  
  return personalizedContent;
};

module.exports = { 
  sendEmail,
  getEmail,
  listEmails,
  canUserSendEmails,
  getUserProfile,
  personalizeEmail,
  setupAutoReplySettings
};