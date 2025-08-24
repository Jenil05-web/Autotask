const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const firebaseAdminService = require('./firebaseAdmin');
const admin = firebaseAdminService.admin;

// This function dynamically creates a transporter for a specific user
const createTransporter = async (userId) => {
  try {
    console.log('Creating email transporter for user:', userId);
    
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
    
    console.log('User has valid Google refresh token, creating OAuth2 transporter...');
    console.log('User email from database:', userData.googleEmail);
    
    // FIX: Create a new OAuth2Client with proper credentials for this user
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    
    oauth2Client.setCredentials({
      refresh_token: user_refresh_token
    });
    
    // Get fresh access token
    const tokenResponse = await oauth2Client.getAccessToken();
    
    if (!tokenResponse.token) {
      throw new Error('Failed to obtain Google access token. Please reconnect your Gmail account.');
    }
    
    console.log('Access token obtained successfully');
    
    // Create transporter with proper OAuth2 configuration
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: userData.googleEmail, // Must be the actual email, not 'me'
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        refreshToken: user_refresh_token,
        accessToken: tokenResponse.token,
      }
    });
    
    console.log('Testing transporter verification...');
    // Verify transporter
    await transporter.verify();
    console.log('Email transporter verified successfully');
    
    return transporter;
  } catch (error) {
    console.error('Error creating email transporter:', error);
    
    // Handle specific Google OAuth errors
    if (error.message.includes('invalid_grant') || error.message.includes('invalid_request')) {
      throw new Error('Google refresh token is invalid or expired. Please reconnect your Gmail account.');
    } else if (error.message.includes('insufficient_scope')) {
      throw new Error('Insufficient Gmail permissions. Please reconnect your Gmail account with full permissions.');
    } else if (error.message.includes('unauthorized_client')) {
      throw new Error('Gmail OAuth configuration error. Please contact support.');
    }
    
    throw error;
  }
};

const sendEmail = async ({ userId, from, to, cc, bcc, subject, html, text }) => {
  try {
    console.log('=== Sending Email ===');
    console.log('User ID:', userId);
    console.log('From:', from);
    console.log('To:', to);
    console.log('Subject:', subject);
    
    // Validate inputs
    if (!userId) {
      throw new Error('User ID is required');
    }
    
    if (!to || !Array.isArray(to) || to.length === 0) {
      throw new Error('Recipients (to) must be a non-empty array');
    }
    
    if (!subject) {
      throw new Error('Email subject is required');
    }
    
    if (!html && !text) {
      throw new Error('Email content (html or text) is required');
    }
    
    const transporter = await createTransporter(userId);
    
    // Get user data to set the proper 'from' field
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    const userData = userDoc.data();
    const userEmail = userData.googleEmail;
    
    const mailOptions = {
      from: `"${userData.displayName || 'Auto Task AI'}" <${userEmail}>`, // Use authenticated user's email
      to: to.join(', '),
      cc: cc && cc.length > 0 ? cc.join(', ') : undefined,
      bcc: bcc && bcc.length > 0 ? bcc.join(', ') : undefined,
      subject: subject,
      html: html,
      text: text
    };
    
    console.log('Sending email with options:', {
      from: mailOptions.from,
      to: mailOptions.to,
      subject: mailOptions.subject,
      html: html ? '[HTML Content Present]' : undefined,
      text: text ? '[Text Content Present]' : undefined
    });
    
    const info = await transporter.sendMail(mailOptions);
    
    console.log('✅ Email sent successfully');
    console.log('Message ID:', info.messageId);
    console.log('Response:', info.response);
    
    return {
      success: true,
      messageId: info.messageId,
      response: info.response,
      sentAt: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('❌ Email sending failed:', error);
    
    // Return structured error response
    return {
      success: false,
      error: error.message,
      errorCode: error.code || 'EMAIL_SEND_FAILED',
      sentAt: new Date().toISOString()
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
    
    return { canSend: true, email: userData.googleEmail };
    
  } catch (error) {
    console.error('Error checking user email capabilities:', error);
    return { canSend: false, reason: error.message };
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
  canUserSendEmails,
  personalizeEmail 
};