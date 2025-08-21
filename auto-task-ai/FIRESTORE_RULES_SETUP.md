# Firestore Rules Setup Guide

## Problem
You're experiencing a 400 (Bad Request) error when trying to access Firestore. This is likely due to expired or incorrect Firestore security rules.

## Solution
You need to update your Firestore security rules in the Firebase Console.

## Steps to Fix:

1. **Go to Firebase Console**
   - Visit: https://console.firebase.google.com/
   - Select your project: `autotask-ai-51314`

2. **Navigate to Firestore Database**
   - Click on "Firestore Database" in the left sidebar
   - Click on the "Rules" tab

3. **Replace the Rules**
   Copy and paste the following rules:

```javascript
rules_version='2';

service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read and write their own user document
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Tasks can be read and written by the user who owns them
    match /tasks/{taskId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }
    
    // Allow authenticated users to read and write their own data
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

4. **Publish the Rules**
   - Click "Publish" to save the new rules

## What These Rules Do:

- **User Documents**: Users can only access their own user profile data
- **Task Documents**: Users can only access tasks they created
- **General Access**: Authenticated users can read/write to their own collections
- **Security**: Prevents unauthorized access to other users' data

## Testing the Fix:

1. After updating the rules, refresh your application
2. Try to register or login
3. The 400 error should be resolved
4. You should be able to see the login and register pages properly

## Alternative: Temporary Open Rules (Development Only)

If you need to test quickly, you can use these temporary rules (NOT for production):

```javascript
rules_version='2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

⚠️ **Warning**: These rules allow anyone to read/write to your database. Only use for development/testing.

## Environment Variables Check

Make sure your `.env` file in the `client` directory contains all the required Firebase configuration:

```
REACT_APP_FIREBASE_API_KEY=AIzaSyDNdxPqZoaK3q-c8VU9QQM5ZuiYfBboo7k
REACT_APP_FIREBASE_AUTH_DOMAIN=autotask-ai-51314.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=autotask-ai-51314
REACT_APP_FIREBASE_STORAGE_BUCKET=autotask-ai-51314.firebasestorage.app
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=988691502448
REACT_APP_FIREBASE_APP_ID=1:988691502448:web:b0f222d6b5c1aec1baabb5
REACT_APP_FIREBASE_MEASUREMENT_ID=G-B6ZC75PH1J
```

## Next Steps

After updating the rules:
1. Restart your development server
2. Clear browser cache
3. Test the login and register functionality
4. Check the connection status indicator in the navbar