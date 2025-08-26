const express = require('express');
const admin = require('firebase-admin');
const router = express.Router();
const { scheduleNewEmail, cancelScheduledEmail, rescheduleEmail } = require('../services/emailScheduler');
const emailService = require('../services/emailService');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const Joi = require('joi');

// Fix the Firebase Admin import
// Fix the Firebase Admin import
const firebaseAdminService = require('../services/firebaseAdmin');
const db = firebaseAdminService.firestore; // Use the pre-initialized firestore instance


// Validation schema
const scheduleEmailSchema = Joi.object({
  from: Joi.string().email().required(),
  recipients: Joi.array().items(Joi.string().email()).min(1).required(),
  cc: Joi.array().items(Joi.string().email()).optional().allow(''),
  bcc: Joi.array().items(Joi.string().email()).optional().allow(''),
  subject: Joi.string().min(1).required(),
  body: Joi.string().min(1).required(),
  scheduledFor: Joi.date().iso().required(),
  personalization: Joi.object().optional(),
  recurring: Joi.object().optional(),
  followUp: Joi.object().optional(),
  autoReply: Joi.object().optional()
});

// Test route (no auth required)
router.get('/test', (req, res) => {
  console.log('=== /test route called (no auth) ===');
  res.json({
    success: true,
    message: 'Email API is working!',
    timestamp: new Date().toISOString()
  });
});

// Email preview route
router.post('/preview', optionalAuth, (req, res) => {
  try {
    const { subject, body, personalization } = req.body;
    
    const previewSubject = emailService.personalizeEmail(subject || '', personalization || {});
    const previewBody = emailService.personalizeEmail(body || '', personalization || {});
    
    res.json({
      success: true,
      preview: {
        subject: previewSubject,
        body: previewBody
      }
    });
  } catch (error) {
    console.error('Error generating email preview:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to generate email preview' 
    });
  }
});

// Schedule a new email
router.post('/schedule', authenticateToken, async (req, res) => {
  try {
    const { error } = scheduleEmailSchema.validate(req.body);
    if (error) {
      console.error('Validation Error:', error.details[0].message);
      return res.status(400).json({ 
        success: false,
        error: error.details[0].message 
      });
    }

    const userId = req.user.uid;
    const emailData = req.body;
    
    const scheduledTask = await scheduleNewEmail(userId, emailData);
    
    res.status(201).json({
      success: true,
      message: 'Email scheduled successfully',
      task: scheduledTask
    });
  } catch (error) {
    console.error('Error scheduling email:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to schedule email' 
    });
  }
});

// Get all scheduled emails for the user
router.get('/scheduled', authenticateToken, async (req, res) => {
  try {
    console.log('=== /scheduled route called ===');
    const userId = req.user.uid;
    
    if (!db) {
      console.error('Firestore is not initialized in admin');
      throw new Error('Firestore not initialized');
    }

    const snapshot = await db
      .collection('users')
      .doc(userId)
      .collection('scheduledEmails')
      .orderBy('createdAt', 'desc')
      .get();
    
    console.log('Firestore query complete, size:', snapshot.size);
    
    const emails = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        // Ensure dates are properly formatted
        scheduledFor: data.scheduledFor?.toDate ? data.scheduledFor.toDate().toISOString() : data.scheduledFor,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
        lastSent: data.lastSent?.toDate ? data.lastSent.toDate().toISOString() : data.lastSent,
        nextScheduledRun: data.nextScheduledRun?.toDate ? data.nextScheduledRun.toDate().toISOString() : data.nextScheduledRun
      };
    });
    
    // Return consistent format that matches frontend expectations
    res.status(200).json({
      success: true,
      emails: emails
    });
  } catch (error) {
    console.error('=== ERROR in /scheduled route ===', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch scheduled emails',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Cancel a scheduled email - UPDATED TO PROPERLY CANCEL
// Cancel a scheduled email - UPDATED TO PROPERLY CANCEL
router.delete('/scheduled/:id', authenticateToken, async (req, res) => {
  try {
    console.log('=== DELETE /scheduled/:id route called ===');
    const userId = req.user.uid;
    const emailId = req.params.id;
    
    // Get the email document first to check if it exists
    const emailDoc = await db
      .collection('users')
      .doc(userId)
      .collection('scheduledEmails')
      .doc(emailId)
      .get();
    
    if (!emailDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Email not found'
      });
    }
    
    const emailData = emailDoc.data();
    
    // Cancel the scheduled task if it exists
    if (emailData.status === 'scheduled') {
      try {
        await cancelScheduledEmail(userId, emailId, emailData);
      } catch (cancelError) {
        console.error('Error cancelling scheduled task:', cancelError);
        // Continue with status update even if task cancellation fails
      }
    }
    
    // Update the document status - FIX: Use firebaseAdminService admin reference
   // Update the document status
await db
  .collection('users')
  .doc(userId)
  .collection('scheduledEmails')
  .doc(emailId)
  .update({
    status: 'cancelled',
cancelledAt: db.FieldValue.serverTimestamp()
  });
    
    console.log('Email cancelled successfully');
    res.status(200).json({
      success: true,
      message: 'Email cancelled successfully'
    });
  } catch (error) {
    console.error('Error cancelling email:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to cancel email' 
    });
  }
});

// Reschedule an email - ENHANCED WITH PROPER RESCHEDULING
router.put('/scheduled/:id/reschedule', authenticateToken, async (req, res) => {
  try {
    console.log('=== PUT /scheduled/:id/reschedule route called ===');
    const userId = req.user.uid;
    const emailId = req.params.id;
    const { scheduledFor } = req.body;

    if (!scheduledFor) {
      return res.status(400).json({
        success: false,
        error: 'scheduledFor is required'
      });
    }

    // Validate the new date
    const newDate = new Date(scheduledFor);
    if (newDate <= new Date()) {
      return res.status(400).json({
        success: false,
        error: 'Scheduled time must be in the future'
      });
    }

    // Get the email document
    const emailDoc = await db
      .collection('users')
      .doc(userId)
      .collection('scheduledEmails')
      .doc(emailId)
      .update({
        status: 'cancelled',
        cancelledAt: admin.firestore.FieldValue.serverTimestamp()
      });
    
    console.log('Email cancelled successfully');
    res.status(200).json({
      success: true,
      message: 'Email cancelled successfully'
    });
  } catch (error) {
    console.error('Error cancelling email:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to cancel email' 
    });
  }
});

// Reschedule an email - ENHANCED WITH PROPER RESCHEDULING
router.put('/scheduled/:id/reschedule', authenticateToken, async (req, res) => {
  try {
    console.log('=== PUT /scheduled/:id/reschedule route called ===');
    const userId = req.user.uid;
    const emailId = req.params.id;
    const { scheduledFor } = req.body;
    
    if (!scheduledFor) {
      return res.status(400).json({ 
        success: false,
        error: 'scheduledFor is required' 
      });
    }
    
    // Validate the new date
    const newDate = new Date(scheduledFor);
    if (newDate <= new Date()) {
      return res.status(400).json({ 
        success: false,
        error: 'Scheduled time must be in the future' 
      });
    }
    
    // Get the email document
    const emailDoc = await admin.firestore
      .collection('users')
      .doc(userId)
      .collection('scheduledEmails')
      .doc(emailId)
      .get();
    
    if (!emailDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Email not found'
      });
    }
    
    const emailData = emailDoc.data();
    
    // Reschedule the task (you'll need this function in emailScheduler)
    if (emailData.status === 'scheduled') {
      try {
        await rescheduleEmail(userId, emailId, emailData, scheduledFor);
      } catch (rescheduleError) {
        console.error('Error rescheduling task:', rescheduleError);
        return res.status(500).json({
          success: false,
          error: 'Failed to reschedule email task'
        });
      }
    }
    
    // Update the document
    await admin.firestore
      .collection('users')
      .doc(userId)
      .collection('scheduledEmails')
      .doc(emailId)
      .update({
        scheduledFor: admin.firestore.Timestamp.fromDate(newDate),
        rescheduledAt: admin.firestore.FieldValue.serverTimestamp(),
        // Update next run time for recurring emails
        nextScheduledRun: emailData.recurring?.enabled 
          ? admin.firestore.Timestamp.fromDate(newDate)
          : null
      });
    
    console.log('Email rescheduled successfully');
    res.status(200).json({
      success: true,
      message: 'Email rescheduled successfully'
    });
  } catch (error) {
    console.error('Error rescheduling email:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to reschedule email' 
    });
  }
});

// Send test email
router.post('/test-send', authenticateToken, async (req, res) => {
  try {
    console.log('=== POST /test-send route called ===');
    const { error } = scheduleEmailSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        success: false,
        error: error.details[0].message 
      });
    }

    const userId = req.user.uid;
    const emailData = req.body;
    
    // Send email immediately (for testing)
    await emailService.sendEmail({
      userId: userId,
      from: emailData.from,
      to: emailData.recipients,
      cc: emailData.cc,
      bcc: emailData.bcc,
      subject: emailData.subject,
      html: emailData.body
    });
    
    console.log('Test email sent successfully');
    res.status(200).json({
      success: true,
      message: 'Test email sent successfully'
    });
  } catch (error) {
    console.error('Error sending test email:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to send test email',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get email activity/history
router.get('/activity', authenticateToken, async (req, res) => {
  try {
    console.log('=== GET /activity route called ===');
    const userId = req.user.uid;
    const snapshot = await admin.firestore
      .collection('users')
      .doc(userId)
      .collection('scheduledEmails')
      .where('status', 'in', ['sent', 'failed'])
      .orderBy('sentAt', 'desc')
      .limit(50)
      .get();
    
    const activity = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        // Ensure dates are properly formatted
        sentAt: data.sentAt?.toDate ? data.sentAt.toDate().toISOString() : data.sentAt,
        lastFailedAt: data.lastFailedAt?.toDate ? data.lastFailedAt.toDate().toISOString() : data.lastFailedAt
      };
    });
    
    console.log('Activity fetched:', activity.length, 'records');
    
    res.status(200).json({
      success: true,
      activity: activity
    });
  } catch (error) {
    console.error('Error fetching email activity:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch email activity' 
    });
  }
});

// Verify email service configuration
router.get('/verify', authenticateToken, async (req, res) => {
  try {
    console.log('=== GET /verify route called ===');
    const userId = req.user.uid;
    
    // Check user's email configuration in Firestore
    const userDoc = await db
      .collection('users')
      .doc(userId)
      .get();
    
    const userData = userDoc.data();
    const emailConfig = userData?.emailConfig || {};
    
    const verified = !!(emailConfig.accessToken && emailConfig.refreshToken);
    
    res.status(200).json({
      success: true,
      verified: verified,
      message: verified 
        ? 'Email service is configured correctly' 
        : 'Email service configuration is incomplete',
      config: {
        hasAccessToken: !!emailConfig.accessToken,
        hasRefreshToken: !!emailConfig.refreshToken,
        provider: emailConfig.provider || 'unknown'
      }
    });
  } catch (error) {
    console.error('Error verifying email service:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to verify email service' 
    });
  }
});

// Get single email details
router.get('/scheduled/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    const emailId = req.params.id;
    
    const emailDoc = await admin.firestore
      .collection('users')
      .doc(userId)
      .collection('scheduledEmails')
      .doc(emailId)
      .get();
    
    if (!emailDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Email not found'
      });
    }
    
    const data = emailDoc.data();
    const email = {
      id: emailDoc.id,
      ...data,
      // Ensure dates are properly formatted
      scheduledFor: data.scheduledFor?.toDate ? data.scheduledFor.toDate().toISOString() : data.scheduledFor,
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
      lastSent: data.lastSent?.toDate ? data.lastSent.toDate().toISOString() : data.lastSent,
      nextScheduledRun: data.nextScheduledRun?.toDate ? data.nextScheduledRun.toDate().toISOString() : data.nextScheduledRun
    };
    
    res.status(200).json({
      success: true,
      email: email
    });
  } catch (error) {
    console.error('Error fetching email:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch email' 
    });
  }
});

module.exports = router;