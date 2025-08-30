const admin = require('firebase-admin');

class FirebaseAdminService {
  constructor() {
    this.app = null;
    this.auth = null;
    this.firestore = null;
    this.initialize();
  }

  initialize() {
    try {
      // If the Admin SDK is already initialized, don't do it again.
      if (admin.apps.length) {
        this.app = admin.app();
        console.log('🔥 Using existing Firebase Admin instance');
      } else {
        console.log('🔥 Initializing Firebase Admin...');
        console.log('Project ID:', process.env.FIREBASE_PROJECT_ID);
        
        // Try multiple authentication methods
        let credential;
        
        // Method 1: Service Account Key from environment variables
        if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
          try {
            console.log('Using Firebase Service Account Key from environment');
            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
            credential = admin.credential.cert(serviceAccount);
          } catch (parseError) {
            console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:', parseError.message);
          }
        }
        
        // Method 2: Individual fields from environment
        if (!credential && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
          try {
            console.log('Using Firebase Service Account from individual environment variables');
            credential = admin.credential.cert({
              projectId: process.env.FIREBASE_PROJECT_ID,
              clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
              privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            });
          } catch (certError) {
            console.error('Failed to create certificate from environment variables:', certError.message);
          }
        }
        
        // Method 3: Service Account file path
        if (!credential && process.env.GOOGLE_APPLICATION_CREDENTIALS) {
          try {
            console.log('Using Firebase Service Account from file path');
            credential = admin.credential.applicationDefault();
          } catch (fileError) {
            console.error('Failed to use application default credentials:', fileError.message);
          }
        }
        
        // Method 4: Fallback to Application Default Credentials
        if (!credential) {
          console.log('Falling back to Application Default Credentials');
          credential = admin.credential.applicationDefault();
        }

        this.app = admin.initializeApp({
          credential: credential,
          projectId: process.env.FIREBASE_PROJECT_ID,
        });
        
        console.log('✅ Firebase Admin initialized successfully');
      }

      this.auth = admin.auth();
      this.firestore = admin.firestore();
      
      // Test the connection
      this.testConnection();
      
    } catch (error) {
      console.error('❌ Failed to initialize Firebase Admin:', error.message);
      console.error('Stack:', error.stack);
      console.error('Please check your Firebase configuration in .env file');
      
      // Log current environment variables (without sensitive data)
      console.log('Environment check:');
      console.log('- FIREBASE_PROJECT_ID:', !!process.env.FIREBASE_PROJECT_ID);
      console.log('- FIREBASE_SERVICE_ACCOUNT_KEY:', !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      console.log('- FIREBASE_CLIENT_EMAIL:', !!process.env.FIREBASE_CLIENT_EMAIL);
      console.log('- FIREBASE_PRIVATE_KEY:', !!process.env.FIREBASE_PRIVATE_KEY);
      console.log('- GOOGLE_APPLICATION_CREDENTIALS:', !!process.env.GOOGLE_APPLICATION_CREDENTIALS);
    }
  }

  async testConnection() {
    try {
      console.log('🧪 Testing Firestore connection...');
      
      if (!this.firestore) {
        throw new Error('Firestore not initialized');
      }

      // Test with a simple write and read
      const testRef = this.firestore.collection('_connection_test').doc('test');
      await testRef.set({ 
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        test: 'connection_successful'
      });
      
      const testDoc = await testRef.get();
      if (testDoc.exists) {
        console.log('✅ Firestore connection test successful');
        // Clean up test document
        await testRef.delete();
      } else {
        throw new Error('Test document was not created');
      }
      
    } catch (error) {
      console.error('❌ Firestore connection test failed:', error.message);
      console.error('This will cause issues with data operations');
    }
  }

  async verifyIdToken(idToken) {
    try {
      if (!this.auth) {
        throw new Error('Firebase Auth not initialized');
      }
      
      const decodedToken = await this.auth.verifyIdToken(idToken);
      return { success: true, user: decodedToken };
    } catch (error) {
      console.error('Token verification failed:', error);
      return { success: false, error: error.message };
    }
  }

  async createUser(userData) {
    try {
      if (!this.auth) {
        throw new Error('Firebase Auth not initialized');
      }

      const userRecord = await this.auth.createUser(userData);
      return { success: true, user: userRecord };
    } catch (error) {
      console.error('User creation failed:', error);
      return { success: false, error: error.message };
    }
  }

  async updateUser(uid, userData) {
    try {
      if (!this.auth) {
        throw new Error('Firebase Auth not initialized');
      }

      const userRecord = await this.auth.updateUser(uid, userData);
      return { success: true, user: userRecord };
    } catch (error) {
      console.error('User update failed:', error);
      return { success: false, error: error.message };
    }
  }

  async deleteUser(uid) {
    try {
      if (!this.auth) {
        throw new Error('Firebase Auth not initialized');
      }

      await this.auth.deleteUser(uid);
      return { success: true };
    } catch (error) {
      console.error('User deletion failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Firestore operations
  async createDocument(collection, docId, data) {
    try {
      if (!this.firestore) {
        throw new Error('Firestore not initialized');
      }

      await this.firestore.collection(collection).doc(docId).set({
        ...data,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      return { success: true };
    } catch (error) {
      console.error('Document creation failed:', error);
      return { success: false, error: error.message };
    }
  }

  async getDocument(collection, docId) {
    try {
      if (!this.firestore) {
        throw new Error('Firestore not initialized');
      }

      const doc = await this.firestore.collection(collection).doc(docId).get();
      if (doc.exists) {
        return { success: true, data: { id: doc.id, ...doc.data() } };
      } else {
        return { success: false, error: 'Document not found' };
      }
    } catch (error) {
      console.error('Document retrieval failed:', error);
      return { success: false, error: error.message };
    }
  }

  async updateDocument(collection, docId, data) {
    try {
      if (!this.firestore) {
        throw new Error('Firestore not initialized');
      }

      await this.firestore.collection(collection).doc(docId).update({
        ...data,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      return { success: true };
    } catch (error) {
      console.error('Document update failed:', error);
      return { success: false, error: error.message };
    }
  }

  async deleteDocument(collection, docId) {
    try {
      if (!this.firestore) {
        throw new Error('Firestore not initialized');
      }

      await this.firestore.collection(collection).doc(docId).delete();
      return { success: true };
    } catch (error) {
      console.error('Document deletion failed:', error);
      return { success: false, error: error.message };
    }
  }

  async queryDocuments(collection, filters = []) {
    try {
      if (!this.firestore) {
        throw new Error('Firestore not initialized');
      }

      let query = this.firestore.collection(collection);
      
      filters.forEach(filter => {
        query = query.where(filter.field, filter.operator, filter.value);
      });

      const snapshot = await query.get();
      const documents = [];
      
      snapshot.forEach(doc => {
        documents.push({ id: doc.id, ...doc.data() });
      });

      return { success: true, data: documents };
    } catch (error) {
      console.error('Query failed:', error);
      return { success: false, error: error.message };
    }
  }

  isInitialized() {
    return !!(this.app && this.auth && this.firestore);
  }

  // Direct access to admin instance for backward compatibility
  get admin() {
    return this.app ? this.app : admin;
  }
  get db() {
  return this.firestore;
}
}

module.exports = new FirebaseAdminService();