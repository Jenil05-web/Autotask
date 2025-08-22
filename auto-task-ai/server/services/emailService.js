const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const admin = require('./firebaseAdmin');

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// This function dynamically creates a transporter for a specific user
const createTransporter = async (userId) => {
  const userDoc = await admin.firestore.collection('users').doc(userId).get();
  const user_refresh_token = userDoc.data().googleRefreshToken;

  if (!user_refresh_token) {
    throw new Error('User has not connected their Google account.');
  }

  oauth2Client.setCredentials({
    refresh_token: user_refresh_token
  });

  const accessToken = await oauth2Client.getAccessToken();

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user: 'me', // 'me' refers to the authenticated user
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      refreshToken: user_refresh_token,
      accessToken: accessToken.token
    }
  });

  return transporter;
};

const sendEmail = async ({ userId, from, to, cc, bcc, subject, html }) => {
  const transporter = await createTransporter(userId);

  const mailOptions = {
    from: from,
    to: to.join(', '),
    cc: cc ? cc.join(', ') : undefined,
    bcc: bcc ? bcc.join(', ') : undefined,
    subject: subject,
    html: html
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully using user credentials:', info.response);
    return info;
  } catch (error) {
    console.error('Error sending email with OAuth2:', error);
    throw error;
  }
};

module.exports = { sendEmail };