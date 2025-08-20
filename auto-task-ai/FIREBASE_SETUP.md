# Firebase Authentication Setup Guide

This guide will help you set up Firebase Authentication for your Auto Task AI project.

## 🚀 Quick Setup

### 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project" or "Add project"
3. Enter a project name (e.g., "auto-task-ai")
4. Choose whether to enable Google Analytics (recommended)
5. Click "Create project"

### 2. Enable Authentication

1. In your Firebase project, click "Authentication" in the left sidebar
2. Click "Get started"
3. Go to the "Sign-in method" tab
4. Enable the following providers:

#### Email/Password Authentication
- Click "Email/Password"
- Toggle "Enable"
- Toggle "Email link (passwordless sign-in)" if desired
- Click "Save"

#### Google Authentication
- Click "Google"
- Toggle "Enable"
- Add your support email
- Click "Save"

### 3. Get Your Configuration

1. Click the gear icon (⚙️) next to "Project Overview"
2. Select "Project settings"
3. Scroll down to "Your apps" section
4. Click the web app icon (</>)
5. Register your app with a nickname (e.g., "Auto Task AI Web")
6. Copy the configuration object

### 4. Configure Environment Variables

1. In your project root, copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in your Firebase configuration:
   ```env
   REACT_APP_FIREBASE_API_KEY=your_actual_api_key
   REACT_APP_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
   REACT_APP_FIREBASE_PROJECT_ID=your_project_id
   REACT_APP_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
   REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
   REACT_APP_FIREBASE_APP_ID=your_app_id
   REACT_APP_FIREBASE_MEASUREMENT_ID=your_measurement_id
   ```

### 5. Set Up Firestore Database

1. In Firebase Console, click "Firestore Database"
2. Click "Create database"
3. Choose "Start in test mode" (for development)
4. Select a location close to your users
5. Click "Done"

### 6. Configure Firestore Security Rules

1. In Firestore Database, go to "Rules" tab
2. Replace the default rules with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read and write their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Tasks can be read and written by authenticated users
    match /tasks/{taskId} {
      allow read, write: if request.auth != null;
    }
    
    // Public data can be read by anyone
    match /public/{document=**} {
      allow read: if true;
    }
  }
}
```

3. Click "Publish"

## 🔐 Authentication Features

### Email/Password Sign Up
- Users can create accounts with email and password
- Password validation (minimum 6 characters)
- Automatic user profile creation in Firestore

### Email/Password Sign In
- Secure login with email and password
- Error handling for invalid credentials
- Last login tracking

### Google Sign In
- One-click Google authentication
- Automatic profile creation from Google data
- Seamless user experience

### Password Reset
- Email-based password reset
- Secure token-based reset links
- User-friendly error messages

## 📱 User Experience

### Beautiful UI
- Modern, responsive design
- Smooth animations and transitions
- Mobile-friendly interface
- Dark mode support

### Error Handling
- User-friendly error messages
- Loading states and spinners
- Form validation
- Network error handling

### Security Features
- Firebase security rules
- User data isolation
- Secure authentication tokens
- Password strength requirements

## 🛠️ Development

### Testing Authentication
1. Start your development server: `npm run dev`
2. Navigate to `/register` to test sign up
3. Navigate to `/login` to test sign in
4. Test Google authentication
5. Test password reset functionality

### Debugging
- Check browser console for errors
- Use Firebase Console to monitor authentication
- Check Firestore for user data creation
- Verify environment variables are loaded

## 🚨 Common Issues

### "Firebase: Error (auth/unauthorized-domain)"
- Add your domain to Firebase Console > Authentication > Settings > Authorized domains

### "Firebase: Error (auth/popup-closed-by-user)"
- User closed the Google sign-in popup
- Check if popup blockers are enabled

### "Firebase: Error (auth/network-request-failed)"
- Check internet connection
- Verify Firebase configuration

### Environment Variables Not Loading
- Ensure `.env` file is in the client directory
- Restart your development server
- Check variable names start with `REACT_APP_`

## 📚 Additional Resources

- [Firebase Documentation](https://firebase.google.com/docs)
- [Firebase Authentication](https://firebase.google.com/docs/auth)
- [Firestore Documentation](https://firebase.google.com/docs/firestore)
- [React Firebase Hooks](https://github.com/CSFrequency/react-firebase-hooks)

## 🔒 Production Considerations

### Security Rules
- Review and tighten Firestore security rules
- Implement proper user role management
- Add rate limiting for authentication attempts

### Environment Variables
- Use production Firebase project
- Secure API keys and configuration
- Implement proper CORS settings

### Monitoring
- Enable Firebase Analytics
- Set up error tracking
- Monitor authentication metrics

---

Your Firebase authentication is now ready! Users can sign up, sign in, and manage their accounts securely. 🎉