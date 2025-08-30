const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const firebaseService = require('../services/firebaseAdmin');
const gmailWatchService = require('../services/gmailWatchService');
const db = firebaseService.db;

// Get auto-reply settings
router.get('/settings', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    zzz
    const settingsSnapshot = await db
      .collection('users')
      .doc(userId)
      .collection('autoReplySettings')
      .where('isActive', '==', true)
      .limit(1)
      .get();

    let settings = null;
    if (!settingsSnapshot.empty) {
      settings = { id: settingsSnapshot.docs[0].id, ...settingsSnapshot.docs[0].data() };
    }

    res.json({ success: true, settings });
  } catch (error) {
    console.error('Error getting auto-reply settings:', error);
    res.status(500).json({ success: false, error: 'Failed to get settings' });
  }
});

// Save auto-reply settings
router.post('/settings', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    const settings = req.body;

    // Deactivate existing settings
    const existingSettings = await db
      .collection('users')
      .doc(userId)
      .collection('autoReplySettings')
      .where('isActive', '==', true)
      .get();

    const batch = db.batch();
    existingSettings.docs.forEach(doc => {
      batch.update(doc.ref, { isActive: false });
    });

    // Create new settings
    const newSettingsRef = db
      .collection('users')
      .doc(userId)
      .collection('autoReplySettings')
      .doc();

    batch.set(newSettingsRef, {
      ...settings,
      isActive: true,
  createdAt: firebaseService.admin.firestore.FieldValue.serverTimestamp(),
updatedAt: firebaseService.admin.firestore.FieldValue.serverTimestamp()
    });

    await batch.commit();

    // Set up Gmail watch if auto-reply is enabled
    if (settings.enabled) {
      const userDoc = await db.collection('users').doc(userId).get();
      const userData = userDoc.data();
      
      if (userData.gmailTokens) {
        await gmailWatchService.setupEmailWatch(
          userId,
          userData.gmailTokens.access_token,
          userData.gmailTokens.refresh_token
        );
      }
    }

    res.json({ success: true, message: 'Auto-reply settings saved' });
  } catch (error) {
    console.error('Error saving auto-reply settings:', error);
    res.status(500).json({ success: false, error: 'Failed to save settings' });
  }
});

// Get auto-reply queue/history
router.get('/queue', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    
    const queueSnapshot = await db
      .collection('users')
      .doc(userId)
      .collection('autoReplyQueue')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const queue = queueSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      scheduledFor: doc.data().scheduledFor?.toDate(),
      sentAt: doc.data().sentAt?.toDate()
    }));

    res.json({ success: true, queue });
  } catch (error) {
    console.error('Error getting auto-reply queue:', error);
    res.status(500).json({ success: false, error: 'Failed to get queue' });
  }
});

// Test auto-reply
router.post('/test', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    const { settings, testEmail } = req.body;

    const { generateAutoReply } = require('../services/aiReplyService');
    
    const reply = await generateAutoReply(
      testEmail.body,
      testEmail.subject,
      settings
    );

    res.json({ success: true, reply });
  } catch (error) {
    console.error('Error testing auto-reply:', error);
    res.status(500).json({ success: false, error: 'Failed to test auto-reply' });
  }
});

module.exports = router;