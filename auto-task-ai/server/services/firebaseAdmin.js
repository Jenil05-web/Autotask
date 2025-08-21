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
      // Initialize Firebase Admin SDK
      if (!admin.apps.length) {
        // In production, use service account key
        if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
          const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
          this.app = admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId: process.env.FIREBASE_PROJECT_ID
          });
        } else if (process.env.NODE_ENV === 'development') {
          // In development, use application default credentials or emulator
          this.app = admin.initializeApp({
            projectId: process.env.FIREBASE_PROJECT_ID || 'demo-project'
          });
        } else {
          throw new Error('Firebase Admin credentials not configured');
        }
      } else {
        this.app = admin.app();
      }

      this.auth = admin.auth();
      this.firestore = admin.firestore();
      
      console.log('🔥 Firebase Admin initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Firebase Admin:', error.message);
      if (process.env.NODE_ENV === 'development') {
        console.log('Running in development mode without Firebase Admin');
      }
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
}

module.exports = new FirebaseAdminService();