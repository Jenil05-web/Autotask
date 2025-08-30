# Complete Setup Guide - Auto Task AI

This guide will walk you through setting up the complete Auto Task AI application with Firebase authentication and email automation.

## Prerequisites

- Node.js (v16 or higher)
- Firebase account
- Gmail account (for email sending)

## Step 1: Firebase Setup

### 1.1 Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project"
3. Enter project name: `auto-task-ai-production`
4. Enable Google Analytics (recommended)
5. Click "Create project"

### 1.2 Add Web App
1. Click the "Web" icon (</>) to add a web app
2. Enter app nickname: `Auto Task AI Client`
3. Click "Register app"
4. Copy the Firebase configuration object

### 1.3 Enable Authentication
1. Go to "Authentication" → "Get started"
2. Click "Sign-in method" tab
3. Enable these providers:
   - **Email/Password**: Enable and allow users to create accounts
   - **Google**: Enable (optional but recommended)

### 1.4 Set up Firestore Database
1. Go to "Firestore Database" → "Create database"
2. Start in "production mode"
3. Choose a location closest to your users
4. Click "Done"

### 1.5 Configure Firestore Rules
Go to "Firestore Database" → "Rules" and replace with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own user document
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Users can read/write their own email automations
    match /emailAutomations/{automationId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }
    
    // Users can read/write their own scheduled emails
    match /scheduledEmails/{emailId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }
  }
}
```

### 1.6 Generate Service Account Key (for Server)
1. Go to "Project Settings" → "Service accounts"
2. Click "Generate new private key"
3. Download the JSON file
4. Keep this file secure - it contains sensitive credentials

## Step 2: Client Setup

### 2.1 Install Dependencies
```bash
cd client
npm install
```

### 2.2 Configure Environment Variables
Create `/client/.env` with your Firebase configuration:

```env
REACT_APP_FIREBASE_API_KEY=your_api_key_here
REACT_APP_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id
REACT_APP_FIREBASE_MEASUREMENT_ID=your_measurement_id
REACT_APP_API_URL=http://localhost:5000/api
```

## Step 3: Server Setup

### 3.1 Install Dependencies
```bash
cd server
npm install
```

### 3.2 Configure Environment Variables
Create `/server/.env`:

```env
NODE_ENV=development
PORT=5000
CORS_ORIGIN=http://localhost:3000

# Firebase Admin
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"your_project_id",...}

# Email Configuration (Gmail recommended for testing)
EMAIL_SERVICE=gmail
EMAIL_USER=your_email@gmail.com
EMAIL_APP_PASSWORD=your_app_specific_password

# Optional: AI Features
OPENAI_API_KEY=your_openai_api_key
```

### 3.3 Set Up Gmail App Password
1. Go to [Google Account Settings](https://myaccount.google.com/)
2. Security → 2-Step Verification (must be enabled)
3. App passwords → Generate new app password
4. Select "Mail" and "Other (custom name)"
5. Enter "Auto Task AI" as the name
6. Copy the generated password to `EMAIL_APP_PASSWORD`

## Step 4: Running the Application

### 4.1 Start the Server
```bash
cd server
npm run dev
```
Server will run on http://localhost:5000

### 4.2 Start the Client
```bash
cd client
npm start
```
Client will run on http://localhost:3000

## Step 5: Testing the Application

### 5.1 Test Authentication
1. Go to http://localhost:3000
2. Click "Register" and create a new account
3. Verify the user appears in Firebase Console → Authentication
4. Try logging out and logging back in

### 5.2 Test Email Automation
1. Log in to the dashboard
2. Go to "Email Automation" tab
3. Click "Schedule New Email"
4. Fill out the email form:
   - Recipients: Enter a test email address
   - Subject: "Test Email from Auto Task AI"
   - Body: "Hello {{recipientName}}, this is a test email!"
   - Schedule for: Set a time 2-3 minutes in the future
5. Click "Schedule Email"
6. Check the email activity dashboard for confirmation

### 5.3 Test Email Personalization
1. In the email composer, add personalization variables:
   - Recipient Name Variable: "recipientName"
   - Company Name Variable: "companyName"
2. Use these in your email: "Hello {{recipientName}} from {{companyName}}"
3. Click "Preview" to see the personalized version
4. Schedule and send the email

## Step 6: Production Deployment

### 6.1 Client Deployment
1. Build the client: `npm run build`
2. Deploy to hosting service (Vercel, Netlify, Firebase Hosting)
3. Update CORS_ORIGIN in server environment

### 6.2 Server Deployment
1. Deploy to cloud service (Heroku, Railway, Google Cloud Run)
2. Set all environment variables in production
3. Update REACT_APP_API_URL in client

## Troubleshooting

### Firebase Connection Issues
- Verify all environment variables are correctly set
- Check Firebase project settings
- Ensure Firestore rules allow authenticated users

### Email Sending Issues
- Verify Gmail app password is correct
- Check that 2-factor authentication is enabled
- Test with the `/api/emails/verify` endpoint

### Authentication Issues
- Clear browser cache and localStorage
- Check Firebase Auth configuration
- Verify service account key is valid

## Features Available

✅ **User Authentication**
- Email/password registration and login
- Google OAuth (if enabled)
- Protected routes and user sessions

✅ **Email Automation**
- Schedule emails for future delivery
- Email personalization with variables
- Recurring email campaigns
- Email preview functionality
- Activity tracking and statistics

✅ **Advanced Features**
- Follow-up email sequences
- Auto-reply functionality
- AI-powered email responses (with OpenAI API)
- Email templates and personalization

## Security Features

- Firebase Authentication integration
- Protected API endpoints
- Input validation and sanitization
- Rate limiting
- CORS protection
- Secure environment variable handling

Your Auto Task AI application is now fully configured and ready for production use!