// routes/auth.js - Google OAuth routes
require('dotenv').config(); // <-- ADD THIS LINE AT THE VERY TOP
console.log('--- Verifying Environment Variables ---');
console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID);
console.log('GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET);
console.log('GOOGLE_REDIRECT_URI:', process.env.GOOGLE_REDIRECT_URI);
console.log('GOOGLE_CLOUD_PROJECT_ID:', process.env.GOOGLE_CLOUD_PROJECT_ID);
console.log('------------------------------------');

const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const { authenticateToken } = require('../middleware/auth');
const firebaseAdminService = require('../services/firebaseAdmin');
const admin = require('firebase-admin'); // Add this line
// Use the service instance
const db = firebaseAdminService.db;

// Initialize OAuth2 client
// This will now have access to the environment variables
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Step 1: Get Google OAuth URL
router.get('/google/url', authenticateToken, (req, res) => {
  try {
    console.log('Generating Google OAuth URL for user:', req.user.uid);
    
    // Add user ID to state for security
    const state = JSON.stringify({ 
      userId: req.user.uid,
      timestamp: Date.now()
    });
    
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent', // Force refresh token
      scope: [
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.modify',     // ✅ Add this - broader Gmail access
        'https://www.googleapis.com/auth/gmail.readonly',   // ✅ Add this for reading emails
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile'       
      ],
      state: state
    });
    console.log('--- GENERATED GOOGLE AUTH URL ---');
    console.log(authUrl);
    console.log('---------------------------------');
    
    console.log('OAuth URL generated successfully');
    res.json({
      success: true,
      authUrl: authUrl,
      message: 'Redirect user to this URL to connect their Gmail account'
    });
  } catch (error) {
    console.error('Error generating OAuth URL:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate OAuth URL. Check server credentials.'
    });
  }
});// DEBUG ENDPOINT - Setup Gmail watch (no JWT required)
router.post('/debug/setup-gmail-watch/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    console.log('🔧 DEBUG: Setting up Gmail watch for user:', userId);
    
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    const userData = userDoc.data();
    if (!userData.googleRefreshToken) {
      return res.status(400).json({
        success: false,
        error: 'No Google refresh token found'
      });
    }
    
    // Initialize Gmail API
    const oauth2ClientDebug = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    
    oauth2ClientDebug.setCredentials({
      refresh_token: userData.googleRefreshToken
    });
    
    const gmail = google.gmail({ version: 'v1', auth: oauth2ClientDebug });
    
    // Set up Gmail watch with YOUR existing topic name
    const watchRequest = {
      userId: 'me',
      requestBody: {
        topicName: `projects/${process.env.GOOGLE_CLOUD_PROJECT_ID}/topics/gmail-notifications`, // ← Using your existing topic
        labelIds: ['INBOX']
      }
    };
    
    console.log('🔧 Gmail watch request:', watchRequest);
    
    const watchResponse = await gmail.users.watch(watchRequest);
    console.log('✅ Gmail watch response:', watchResponse.data);
    
    // Update user document with active watch status
    await db.collection('users').doc(userId).update({
      'gmailWatch.status': 'active',
      'gmailWatch.historyId': watchResponse.data.historyId,
      'gmailWatch.expiration': new Date(parseInt(watchResponse.data.expiration)),
      'gmailWatch.setupAt': admin.firestore.FieldValue.serverTimestamp(),
      'gmailWatch.topicName': watchRequest.requestBody.topicName
    });
    
    console.log('✅ DEBUG: Gmail watch setup successfully for user:', userId);
    
    res.json({
      success: true,
      message: 'Gmail watch setup successfully',
      userId: userId,
      watchData: {
        historyId: watchResponse.data.historyId,
        expiration: watchResponse.data.expiration,
        topicName: watchRequest.requestBody.topicName
      },
      webhookUrl: 'https://6b863eee9186.ngrok-free.app/api/webhooks/gmail'
    });
    
  } catch (error) {
    console.error('❌ DEBUG: Error setting up Gmail watch:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Check Gmail watch status endpoint - ALREADY IMPLEMENTED CORRECTLY
router.get('/gmail-watch-status/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    
    const userDoc = await firebaseAdminService.db
      .collection('users')
      .doc(userId)
      .get();
    
    if (!userDoc.exists) {
      return res.json({ error: 'User not found' });
    }
    
    const userData = userDoc.data();
    
    res.json({
      userId: userId,
      hasGmailTokens: !!userData.googleRefreshToken,
      gmailWatch: userData.gmailWatch || 'Not configured',
      googleEmail: userData.googleEmail || 'Not set'
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper function to set up Gmail watch
async function setupGmailWatch(userId, refreshToken) {
  try {
    console.log('🔧 Setting up Gmail watch for user:', userId);
    
    // Check if GOOGLE_CLOUD_PROJECT_ID is set
    if (!process.env.GOOGLE_CLOUD_PROJECT_ID) {
      throw new Error('GOOGLE_CLOUD_PROJECT_ID environment variable is not set');
    }
    
    // Initialize Gmail API with refresh token
    const oauth2ClientWatch = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    
    oauth2ClientWatch.setCredentials({
      refresh_token: refreshToken
    });
    
    const gmail = google.gmail({ version: 'v1', auth: oauth2ClientWatch });
    
    // Set up Gmail watch
    const watchRequest = {
      userId: 'me',
      resource: {
        labelIds: ['INBOX'],
        topicName: `projects/${process.env.GOOGLE_CLOUD_PROJECT_ID}/topics/gmail-notifications`
      }
    };
    
    const watchResponse = await gmail.users.watch(watchRequest);
    console.log('✅ Gmail watch set up:', watchResponse.data);
    
    // Store watch info in user document
    await db.collection('users').doc(userId).update({
      'gmailWatch.historyId': watchResponse.data.historyId,
      'gmailWatch.expiration': new Date(parseInt(watchResponse.data.expiration)),
      'gmailWatch.setupAt': admin.firestore.FieldValue.serverTimestamp(),
      'gmailWatch.status': 'active'
    });
    
    console.log('✅ Gmail watch configuration saved');
    return watchResponse.data;
    
  } catch (watchError) {
    console.error('❌ Failed to set up Gmail watch:', watchError);
    
    // Store the error in the user document for debugging
    await db.collection('users').doc(userId).update({
      'gmailWatch.status': 'failed',
      'gmailWatch.error': watchError.message,
      'gmailWatch.lastAttempt': admin.firestore.FieldValue().serverTimestamp()
    });
    
    throw watchError;
  }
}
// Stop Gmail push notifications
router.post('/google/stop-watch', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    console.log('🛑 Stopping Gmail watch for user:', userId);
    
    // Get user's refresh token
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    const userData = userDoc.data();
    if (!userData.googleRefreshToken) {
      return res.status(400).json({
        success: false,
        error: 'No Google refresh token found'
      });
    }
    
    // Initialize Gmail API
    const oauth2ClientStop = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    
    oauth2ClientStop.setCredentials({
      refresh_token: userData.googleRefreshToken
    });
    
    const gmail = google.gmail({ version: 'v1', auth: oauth2ClientStop });
    
    // Stop Gmail watch
    await gmail.users.stop({
      userId: 'me'
    });
    
    // Update user document
    await db.collection('users').doc(userId).update({
      'gmailWatch.status': 'stopped',
      'gmailWatch.stoppedAt': admin.firestore.FieldValue.serverTimestamp(),
      'gmailWatch.stopReason': 'manual_stop'
    });
    
    console.log('✅ Gmail watch stopped for user:', userId);
    
    res.json({
      success: true,
      message: 'Gmail push notifications stopped successfully',
      userId: userId
    });
    
  } catch (error) {
    console.error('❌ Error stopping Gmail watch:', error);
    
    // Update status even if stop failed
    try {
      await db.collection('users').doc(req.user.uid).update({
        'gmailWatch.status': 'stop_failed',
        'gmailWatch.stopError': error.message,
        'gmailWatch.stopAttempt': admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (updateError) {
      console.error('Failed to update stop status:', updateError);
    }
    
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to stop Gmail push notifications'
    });
  }
});

// Check Gmail connection status
router.get('/google/status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return res.json({
        connected: false,
        error: 'User not found'
      });
    }
    
    const userData = userDoc.data();
    
    res.json({
      success: true,
      connected: userData.googleConnected || false,
      email: userData.googleEmail || null,
      hasRefreshToken: !!userData.googleRefreshToken,
      gmailWatch: {
        status: userData.gmailWatch?.status || 'not_configured',
        historyId: userData.gmailWatch?.historyId || null,
        expiration: userData.gmailWatch?.expiration || null,
        setupAt: userData.gmailWatch?.setupAt || null,
        stoppedAt: userData.gmailWatch?.stoppedAt || null
      }
    });
    
  } catch (error) {
    console.error('Error checking Google status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Step 2: Handle OAuth callback
router.get('/google/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    
    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Authorization code not provided'
      });
    }
    
    // Verify state parameter
    let stateData;
    try {
      stateData = JSON.parse(state);
    } catch (e) {
      return res.status(400).json({
        success: false,
        error: 'Invalid state parameter'
      });
    }
    
    const { userId } = stateData;
    console.log('Processing OAuth callback for user:', userId);
    
    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    console.log('Tokens received:', {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      expiryDate: tokens.expiry_date
    });
    
    if (!tokens.refresh_token) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token not received. Please revoke access and try again.'
      });
    }
    
    // Get user's email from Google
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    
    console.log('Google user info:', {
      email: userInfo.data.email,
      verified: userInfo.data.verified_email
    });
    
    // Store refresh token in Firestore
    await db.collection('users').doc(userId).update({
      googleRefreshToken: tokens.refresh_token,
      googleEmail: userInfo.data.email,
      googleConnected: true,
      googleConnectedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Set up Gmail watch - YOUR EXACT CODE INTEGRATION
    try {
      console.log('🔧 Setting up Gmail watch for user:', userId);
      
      // Initialize Gmail API
      const oauth2ClientForWatch = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
      );
      
      oauth2ClientForWatch.setCredentials({
        refresh_token: tokens.refresh_token
      });
      
      const gmail = google.gmail({ version: 'v1', auth: oauth2ClientForWatch });
      
      // Set up Gmail watch
      const watchRequest = {
        userId: 'me',
        resource: {
          labelIds: ['INBOX'],
          topicName: `projects/${process.env.GOOGLE_CLOUD_PROJECT_ID}/topics/gmail-notifications`
        }
      };
      
      const watchResponse = await gmail.users.watch(watchRequest);
      console.log('✅ Gmail watch set up:', watchResponse.data);
      
      // Store watch info in user document
      await db.collection('users').doc(userId).update({
        'gmailWatch.historyId': watchResponse.data.historyId,
        'gmailWatch.expiration': new Date(parseInt(watchResponse.data.expiration)),
        'gmailWatch.setupAt': admin.firestore.FieldValue.serverTimestamp()
      });
      
      console.log('✅ Gmail watch configuration saved');
      
    } catch (watchError) {
      console.error('❌ Failed to set up Gmail watch:', watchError);
      // Don't fail the entire auth process if watch setup fails
    }

    // Create default auto-reply settings
    try {
      const settingsRef = db
        .collection('users')
        .doc(userId)
        .collection('autoReplySettings')
        .doc('default');
      
      const existingSettings = await settingsRef.get();
      
      if (!existingSettings.exists) {
        await settingsRef.set({
          isActive: true,
          template: 'Thank you for your email. I will get back to you soon!',
          replyDelay: 0, // Immediate
          useAI: false,
          signature: 'Best regards',
          replyToAll: false,
          allowMultipleReplies: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log('✅ Default auto-reply settings created');
      }
    } catch (settingsError) {
      console.error('❌ Failed to create auto-reply settings:', settingsError);
    }
    
    console.log('Google account connected successfully for user:', userId);
    
    // Redirect to success page or close popup
    res.send(`
      <html>
        <body>
          <h2>✅ Gmail Account Connected Successfully!</h2>
          <p>Your Gmail account <strong>${userInfo.data.email}</strong> has been connected.</p>
          <p>You can now close this window.</p>
          <script>
            // Close popup if opened in popup
            if (window.opener) {
              window.opener.postMessage({ success: true, email: '${userInfo.data.email}' }, '*');
              window.close();
            } else {
              // Redirect to main app
              setTimeout(() => {
                window.location.href = '${process.env.FRONTEND_URL || 'http://localhost:3000'}';
              }, 3000);
            }
          </script>
        </body>
      </html>
    `);
    
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).send(`
      <html>
        <body>
          <h2>❌ Connection Failed</h2>
          <p>Failed to connect Gmail account: ${error.message}</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({ success: false, error: '${error.message}' }, '*');
              window.close();
            }
          </script>
        </body>
      </html>
    `);
  }
});

// Manual test endpoint - YOUR EXACT CODE
router.post('/test-manual-autoreply/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const admin = require('firebase-admin');
    const firebaseAdminService = require('../services/firebaseAdmin');
    
    // Create a test email in the queue
    const testEmail = {
      id: `manual-test-${Date.now()}`,
      threadId: `thread-${Date.now()}`,
      from: 'test@example.com',
      to: 'jeniljoshi56@gmail.com',
      subject: 'Manual Test Auto-Reply',
      body: 'This is a manual test email.',
      date: new Date().toISOString(),
      messageId: `<manual-${Date.now()}@test.com>`
    };
    
    // Add directly to queue
    const queueRef = await firebaseAdminService.db
      .collection('users')
      .doc(userId)
      .collection('autoReplyQueue')
      .add({
        emailData: testEmail,
        status: 'pending',
        priority: 'normal',
        createdAt: admin.firestore.FieldValue().serverTimestamp(),
        scheduledFor: admin.firestore.FieldValue().serverTimestamp(),
        retryCount: 0,
        maxRetries: 3,
        userId: userId
      });
    
    console.log('✅ Manual test queued:', queueRef.id);
    
    res.json({
      success: true,
      message: 'Manual test auto-reply added to queue',
      queueId: queueRef.id
    });
    
  } catch (error) {
    console.error('❌ Manual test failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Retry Gmail watch setup endpoint
router.post('/gmail-watch/retry/:userId', authenticateToken, async (req, res) => {
  try {
    const userId = req.params.userId;
    
    // Check if user is authorized to retry for this userId
    if (req.user.uid !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized'
      });
    }
    
    // Get user's refresh token
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    const userData = userDoc.data();
    if (!userData.googleRefreshToken) {
      return res.status(400).json({
        success: false,
        error: 'Google account not connected'
      });
    }
    
    // Retry Gmail watch setup
    const watchData = await setupGmailWatch(userId, userData.googleRefreshToken);
    
    res.json({
      success: true,
      message: 'Gmail watch setup completed successfully',
      watchData: {
        historyId: watchData.historyId,
        expiration: new Date(parseInt(watchData.expiration))
      }
    });
    
  } catch (error) {
    console.error('Gmail watch retry failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Check Google connection status
// Gmail connection status endpoint - ADD THIS
router.get('/google/status', authenticateToken, async (req, res) => {
  try {
    console.log('🔍 Checking Gmail status for user:', req.user.uid);
    
    const userId = req.user.uid;
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return res.json({
        success: true,
        connected: false,
        email: null,
        message: 'User not found'
      });
    }
    
    const userData = userDoc.data();
    const isConnected = !!(userData.googleConnected && userData.googleRefreshToken);
    
    console.log('✅ Gmail status check result:', {
      connected: isConnected,
      email: userData.googleEmail,
      hasRefreshToken: !!userData.googleRefreshToken
    });
    
    res.json({
      success: true,
      connected: isConnected,
      email: userData.googleEmail || null,
      connectedAt: userData.googleConnectedAt?.toDate?.()?.toISOString() || null
    });
    
  } catch (error) {
    console.error('❌ Error checking Gmail status:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      connected: false,
      email: null
    });
  }
});

// Disconnect Google account
// Gmail disconnect endpoint - ADD THIS
router.delete('/google/disconnect', authenticateToken, async (req, res) => {
  try {
    console.log('🔍 Disconnecting Gmail for user:', req.user.uid);
    
    const userId = req.user.uid;
    
    // Remove Gmail tokens and connection status
    await db.collection('users').doc(userId).update({
      googleRefreshToken: admin.firestore.FieldValue.delete(),
      googleAccessToken: admin.firestore.FieldValue.delete(),
      googleEmail: admin.firestore.FieldValue.delete(),
      googleConnected: false,
      googleDisconnectedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('✅ Gmail disconnected successfully');
    
    res.json({
      success: true,
      message: 'Gmail account disconnected successfully'
    });
    
  } catch (error) {
    console.error('❌ Error disconnecting Gmail:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test Google connection (send test email)
router.post('/google/test', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    const { testEmail } = req.body;
    
    // Import emailService here to avoid circular dependency
    const { sendEmail } = require('../services/emailService');
    
    await sendEmail({
      userId: userId,
      from: req.user.email, // Use authenticated user's email
      to: [testEmail || req.user.email],
      subject: 'Gmail Connection Test',
      html: `
        <h2>✅ Gmail Connection Test Successful!</h2>
        <p>This test email was sent successfully through your connected Gmail account.</p>
        <p><strong>Sent at:</strong> ${new Date().toLocaleString()}</p>
        <p><strong>From:</strong> ${req.user.email}</p>
      `
    });
    
    res.json({
      success: true,
      message: 'Test email sent successfully',
      sentTo: testEmail || req.user.email
    });
  } catch (error) {
    console.error('Test email failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
// DEBUG ENDPOINT - Generate OAuth URL without JWT authentication
router.get('/debug/oauth-url/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    console.log('🔧 DEBUG: Generating OAuth URL for user:', userId);
    
    // Verify user exists
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        userId: userId
      });
    }
    
    const userData = userDoc.data();
    
    // Generate OAuth URL with force consent to get fresh refresh token
    const state = JSON.stringify({ 
      userId: userId,
      timestamp: Date.now(),
      debug: true
    });
    
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent', // Force new refresh token
      scope: [
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.modify',
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile'       
      ],
      state: state
    });
    
    console.log('✅ DEBUG: OAuth URL generated for user:', userId);
    console.log('📧 Current user email:', userData.googleEmail || 'Not set');
    console.log('🔗 Auth URL:', authUrl);
    
    res.json({
      success: true,
      userId: userId,
      currentEmail: userData.googleEmail || 'Not set',
      hasRefreshToken: !!userData.googleRefreshToken,
      tokenExpired: userData.googleTokenExpired || false,
      authUrl: authUrl,
      message: 'Copy this URL and open it in your browser to re-authenticate'
    });
    
  } catch (error) {
    console.error('❌ DEBUG: Error generating OAuth URL:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// DEBUG ENDPOINT - Check user OAuth status
router.get('/debug/user-status/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return res.json({
        exists: false,
        userId: userId
      });
    }
    
    const userData = userDoc.data();
    
    res.json({
      success: true,
      exists: true,
      userId: userId,
      googleConnected: userData.googleConnected || false,
      googleEmail: userData.googleEmail || null,
      hasRefreshToken: !!userData.googleRefreshToken,
      tokenExpired: userData.googleTokenExpired || false,
      needsReauth: userData.needsReauth || false,
      lastTokenError: userData.lastTokenError || null,
      gmailWatch: {
        status: userData.gmailWatch?.status || 'not_configured',
        historyId: userData.gmailWatch?.historyId || null,
        expiration: userData.gmailWatch?.expiration || null,
        setupAt: userData.gmailWatch?.setupAt || null,
        stoppedAt: userData.gmailWatch?.stoppedAt || null
      }
    });
    
  } catch (error) {
    console.error('Error checking user status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});






module.exports = router;