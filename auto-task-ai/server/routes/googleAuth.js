const express = require('express');
const { google } = require('googleapis');
const admin = require('firebase-admin');
const router = express.Router();

// Initialize Google OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/auth/google/callback'
);

// Gmail scope for sending emails
const SCOPES = ['https://www.googleapis.com/auth/gmail.send'];

// Middleware to verify Firebase token
const authenticateUser = async (req, res, next) => {
  try {
    console.log('🔍 Debug: Auth middleware started');
    console.log('🔍 Debug: Headers:', req.headers);
    
    const authHeader = req.headers.authorization;
    console.log('🔍 Debug: Auth header:', authHeader ? 'exists' : 'missing');
    
    if (!authHeader) {
      console.log('🔍 Debug: No authorization header');
      return res.status(401).json({ success: false, error: 'No authorization header' });
    }
    
    if (!authHeader.startsWith('Bearer ')) {
      console.log('🔍 Debug: Invalid authorization header format');
      return res.status(401).json({ success: false, error: 'Invalid authorization header format' });
    }
    
    const token = authHeader.split('Bearer ')[1];
    console.log('🔍 Debug: Extracted token:', token ? `${token.substring(0, 20)}...` : 'empty');
    
    if (!token) {
      console.log('🔍 Debug: No token after Bearer');
      return res.status(401).json({ success: false, error: 'No token provided' });
    }

    console.log('🔍 Debug: Attempting to verify token with Firebase Admin...');
    const decodedToken = await admin.auth().verifyIdToken(token);
    console.log('🔍 Debug: Token verified successfully');
    console.log('🔍 Debug: Decoded token:', {
      uid: decodedToken.uid,
      email: decodedToken.email,
      aud: decodedToken.aud,
      iss: decodedToken.iss
    });
    
    req.userId = decodedToken.uid;
    req.userEmail = decodedToken.email;
    next();
  } catch (error) {
    console.error('🔍 Debug: Auth error:', error);
    console.error('🔍 Debug: Error code:', error.code);
    console.error('🔍 Debug: Error message:', error.message);
    
    let errorMessage = 'Invalid token';
    if (error.code === 'auth/id-token-expired') {
      errorMessage = 'Token expired';
    } else if (error.code === 'auth/invalid-id-token') {
      errorMessage = 'Invalid token format';
    } else if (error.code === 'auth/project-not-found') {
      errorMessage = 'Firebase project not found';
    }
    
    res.status(401).json({ success: false, error: errorMessage });
  }
};

// In-memory storage for demo (use database in production)
const userTokens = new Map();

// Get OAuth URL
router.get('/url', authenticateUser, async (req, res) => {
  try {
    console.log('🔍 Debug: Generating OAuth URL for user:', req.userId);
    
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      state: req.userId, // Pass user ID in state
      prompt: 'consent'
    });

    console.log('🔍 Debug: Generated OAuth URL');
    res.json({ success: true, authUrl });
  } catch (error) {
    console.error('🔍 Debug: Error generating auth URL:', error);
    res.status(500).json({ success: false, error: 'Failed to generate auth URL' });
  }
});

// Handle OAuth callback
router.get('/callback', async (req, res) => {
  try {
    const { code, state: userId, error } = req.query;

    if (error) {
      return res.send(`
        <script>
          window.opener.postMessage({ error: '${error}' }, '*');
          window.close();
        </script>
      `);
    }

    if (!code || !userId) {
      return res.send(`
        <script>
          window.opener.postMessage({ error: 'Missing authorization code or user ID' }, '*');
          window.close();
        </script>
      `);
    }

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    
    // Set credentials to get user info
    oauth2Client.setCredentials(tokens);
    
    // Get user's Gmail profile
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const profile = await gmail.users.getProfile({ userId: 'me' });
    
    // Store tokens (use database in production)
    userTokens.set(userId, {
      tokens,
      email: profile.data.emailAddress,
      connectedAt: new Date()
    });

    res.send(`
      <script>
        window.opener.postMessage({ 
          success: true, 
          email: '${profile.data.emailAddress}' 
        }, '*');
        window.close();
      </script>
    `);
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.send(`
      <script>
        window.opener.postMessage({ error: 'Authorization failed' }, '*');
        window.close();
      </script>
    `);
  }
});

// Check connection status
router.get('/status', authenticateUser, async (req, res) => {
  try {
    console.log('🔍 Debug: Checking connection status for user:', req.userId);
    
    const userAuth = userTokens.get(req.userId);
    console.log('🔍 Debug: User auth data found:', !!userAuth);
    
    if (!userAuth) {
      console.log('🔍 Debug: No Gmail connection found for user');
      return res.json({ 
        success: true, 
        connected: false, 
        email: null 
      });
    }

    // Check if tokens are still valid
    oauth2Client.setCredentials(userAuth.tokens);
    
    try {
      // Test the connection by making a simple API call
      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
      await gmail.users.getProfile({ userId: 'me' });
      
      console.log('🔍 Debug: Gmail connection verified for:', userAuth.email);
      res.json({ 
        success: true, 
        connected: true, 
        email: userAuth.email 
      });
    } catch (tokenError) {
      // Tokens might be expired, remove them
      console.log('🔍 Debug: Gmail tokens expired, removing');
      userTokens.delete(req.userId);
      res.json({ 
        success: true, 
        connected: false, 
        email: null 
      });
    }
  } catch (error) {
    console.error('🔍 Debug: Status check error:', error);
    res.status(500).json({ success: false, error: 'Failed to check status' });
  }
});

// Disconnect Gmail
router.delete('/disconnect', authenticateUser, async (req, res) => {
  try {
    const userAuth = userTokens.get(req.userId);
    
    if (userAuth) {
      // Revoke tokens
      oauth2Client.setCredentials(userAuth.tokens);
      try {
        await oauth2Client.revokeCredentials();
      } catch (revokeError) {
        console.log('Error revoking credentials:', revokeError.message);
      }
      
      // Remove from storage
      userTokens.delete(req.userId);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Disconnect error:', error);
    res.status(500).json({ success: false, error: 'Failed to disconnect' });
  }
});

// Send test email
router.post('/test', authenticateUser, async (req, res) => {
  try {
    const userAuth = userTokens.get(req.userId);
    
    if (!userAuth) {
      return res.status(400).json({ success: false, error: 'Gmail not connected' });
    }

    const { testEmail } = req.body;
    const recipientEmail = testEmail || userAuth.email;

    // Set up Gmail client
    oauth2Client.setCredentials(userAuth.tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Create email message
    const subject = 'Test Email from Auto Task AI';
    const body = `
Hello!

This is a test email to verify your Gmail connection is working properly.

✅ Gmail OAuth connection: Success
✅ Email sending capability: Success
📧 Sent from: ${userAuth.email}
📧 Sent to: ${recipientEmail}
⏰ Sent at: ${new Date().toLocaleString()}

Best regards,
Auto Task AI Team
    `;

    const message = [
      `To: ${recipientEmail}`,
      `Subject: ${subject}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      body
    ].join('\n');

    const encodedMessage = Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    // Send email
    await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage
      }
    });

    res.json({ success: true, sentTo: recipientEmail });
  } catch (error) {
    console.error('Test email error:', error);
    res.status(500).json({ success: false, error: 'Failed to send test email' });
  }
});

module.exports = router;