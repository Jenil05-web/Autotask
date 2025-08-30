// routes/auth.js - Google OAuth routes
require('dotenv').config(); // <-- ADD THIS LINE AT THE VERY TOP
console.log('--- Verifying Environment Variables ---');
console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID);
console.log('GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET);
console.log('GOOGLE_REDIRECT_URI:', process.env.GOOGLE_REDIRECT_URI);
console.log('------------------------------------');

const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const { authenticateToken } = require('../middleware/auth');
const firebaseAdminService = require('../services/firebaseAdmin');
const admin = firebaseAdminService.admin;

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
    await admin.firestore().collection('users').doc(userId).update({
      googleRefreshToken: tokens.refresh_token,
      googleEmail: userInfo.data.email,
      googleConnected: true,
      googleConnectedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
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

// Check Google connection status
router.get('/google/status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
        return res.status(404).json({ success: false, error: 'User not found' });
    }

    const userData = userDoc.data();
    const isConnected = !!(userData?.googleRefreshToken && userData?.googleConnected);
    
    res.json({
      success: true,
      connected: isConnected,
      email: userData?.googleEmail || null,
      connectedAt: userData?.googleConnectedAt || null
    });
  } catch (error) {
    console.error('Error checking Google status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check Google connection status'
    });
  }
});

// Disconnect Google account
router.delete('/google/disconnect', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    
    // Remove Google tokens from Firestore
    await admin.firestore().collection('users').doc(userId).update({
      googleRefreshToken: admin.firestore.FieldValue.delete(),
      googleEmail: admin.firestore.FieldValue.delete(),
      googleConnected: false,
      googleDisconnectedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('Google account disconnected for user:', userId);
    
    res.json({
      success: true,
      message: 'Gmail account disconnected successfully'
    });
  } catch (error) {
    console.error('Error disconnecting Google account:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to disconnect Google account'
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

module.exports = router;