const { google } = require('googleapis');

// Create a single OAuth2 client instance that can be shared across services
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Verify configuration on startup
if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) {
  console.error('❌ Google OAuth configuration missing! Check your environment variables:');
  console.error('- GOOGLE_CLIENT_ID:', !!process.env.GOOGLE_CLIENT_ID);
  console.error('- GOOGLE_CLIENT_SECRET:', !!process.env.GOOGLE_CLIENT_SECRET);
  console.error('- GOOGLE_REDIRECT_URI:', !!process.env.GOOGLE_REDIRECT_URI);
} else {
  console.log('✅ Google OAuth client initialized successfully');
}

module.exports = oauth2Client;