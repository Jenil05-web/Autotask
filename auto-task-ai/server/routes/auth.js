const { google } = require('googleapis');
const admin = require('../services/firebaseAdmin');
// ... (keep your existing router and other requires)

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Route to start the Google OAuth flow
// The frontend will link the user to this URL
router.get('/google', (req, res) => {
  const scopes = [
    'https://www.googleapis.com/auth/gmail.send' // The permission we need
  ];

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline', // Important to get a refresh token
    scope: scopes,
    // We pass the Firebase UID to identify the user upon callback
    state: req.query.userId 
  });
  res.redirect(url);
});

// Route that Google redirects to after the user gives consent
router.get('/google/callback', async (req, res) => {
  const { code, state } = req.query;
  const userId = state; // The Firebase UID we passed

  try {
    const { tokens } = await oauth2Client.getToken(code);
    // IMPORTANT: Securely store the refresh_token for this user in your database
    // The refresh_token allows you to get new access_tokens later without user interaction
    if (tokens.refresh_token) {
      await admin.firestore.collection('users').doc(userId).update({
        googleRefreshToken: tokens.refresh_token
      });
    }

    // Redirect user back to a success page on your frontend
    res.redirect('http://localhost:3000/profile?status=google-connected');
  } catch (error) {
    console.error('Error during Google OAuth callback:', error);
    res.redirect('http://localhost:3000/profile?status=error');
  }
});

// ... (keep your other auth routes)
module.exports = router; 
