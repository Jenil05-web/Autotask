# Firebase Setup Instructions

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project" or "Add project"
3. Enter project name: `auto-task-ai-production`
4. Enable Google Analytics (optional but recommended)
5. Choose your Google Analytics account
6. Click "Create project"

## Step 2: Add Web App

1. In your Firebase project dashboard, click the "Web" icon (</>) to add a web app
2. Enter app nickname: `Auto Task AI Client`
3. Check "Also set up Firebase Hosting" (optional)
4. Click "Register app"
5. Copy the Firebase configuration object

## Step 3: Enable Authentication

1. In Firebase Console, go to "Authentication" → "Get started"
2. Click on "Sign-in method" tab
3. Enable these providers:
   - **Email/Password**: Enable and allow users to create accounts
   - **Google**: Enable and configure OAuth consent screen
4. Click "Save"

## Step 4: Set up Firestore Database

1. Go to "Firestore Database" → "Create database"
2. Start in "production mode" (we'll configure rules later)
3. Choose a location closest to your users
4. Click "Done"

## Step 5: Configure Firestore Rules

Go to "Firestore Database" → "Rules" and update with:

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

## Step 6: Update Environment Variables

Replace the contents of `/client/.env` with your actual Firebase config:

```
REACT_APP_FIREBASE_API_KEY=your_actual_api_key_here
REACT_APP_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your_actual_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_actual_sender_id
REACT_APP_FIREBASE_APP_ID=your_actual_app_id
REACT_APP_FIREBASE_MEASUREMENT_ID=your_actual_measurement_id
```

## Step 7: Test the Setup

1. Start your development server: `npm start`
2. Try registering a new user
3. Check Firebase Console → Authentication to see the new user
4. Try logging in with the created user

Your Firebase project is now ready for production use!