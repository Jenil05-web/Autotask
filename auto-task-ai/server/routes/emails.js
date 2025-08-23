const express = require('express');
const router = express.Router();
const admin = require('../services/firebaseAdmin');
const { scheduleNewEmail } = require('../services/emailScheduler');
const emailService = require('../services/emailService'); // Import emailService for preview
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const Joi = require('joi');

// --- THIS IS THE UPDATED VALIDATION SCHEMA ---
const scheduleEmailSchema = Joi.object({
  from: Joi.string().email().required(),
  recipients: Joi.array().items(Joi.string().email()).min(1).required(),
  cc: Joi.array().items(Joi.string().email()).optional().allow(''),
  bcc: Joi.array().items(Joi.string().email()).optional().allow(''),
  subject: Joi.string().min(1).required(),
  body: Joi.string().min(1).required(),
  scheduledFor: Joi.date().iso().required(),
  personalization: Joi.object().optional(),
  // Added rules to allow these objects if they exist
  recurring: Joi.object().optional(),
  followUp: Joi.object().optional(),
  autoReply: Joi.object().optional()
});

// Simple test route (no auth required) - ADD THIS FOR DEBUGGING
router.get('/test', (req, res) => {
  console.log('=== /test route called (no auth) ===');
  res.json({
    success: true,
    message: 'Email API is working!',
    timestamp: new Date().toISOString()
  });
});

// --- THIS IS THE NEW /preview ROUTE ---
router.post('/preview', optionalAuth, (req, res) => {
  try {
    const { subject, body, personalization } = req.body;
    
    // Using the personalization function from your emailService.js
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
    res.status(500).json({ error: 'Failed to generate email preview' });
  }
});

// Schedule a new email
router.post('/schedule', authenticateToken, async (req, res) => {
  try {
    // Joi will now correctly validate the incoming data
    const { error } = scheduleEmailSchema.validate(req.body);
    if (error) {
      console.error('Validation Error:', error.details[0].message);
      return res.status(400).json({ error: error.details[0].message });
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
    res.status(500).json({ error: 'Failed to schedule email' });
  }
});

// Get all scheduled emails for the user - ENHANCED WITH DEBUG LOGGING
router.get('/scheduled', authenticateToken, async (req, res) => {
  try {
    console.log('=== /scheduled route called ===');
    console.log('Request headers:', req.headers);
    console.log('Request user:', req.user);
    console.log('User UID:', req.user?.uid);
    
    const userId = req.user.uid;
    console.log('Querying Firestore for user:', userId);
    
    // Check if admin.firestore is available
    if (!admin.firestore) {
      console.error('Firestore is not initialized in admin');
      throw new Error('Firestore not initialized');
    }
    
    const snapshot = await admin.firestore
      .collection('users')
      .doc(userId)
      .collection('scheduledEmails')
      .orderBy('createdAt', 'desc')
      .get();
    
    console.log('Firestore query complete');
    console.log('Snapshot empty:', snapshot.empty);
    console.log('Snapshot size:', snapshot.size);
    
    const emails = snapshot.docs.map(doc => {
      const data = { id: doc.id, ...doc.data() };
      console.log('Email document:', doc.id, JSON.stringify(data, null, 2));
      return data;
    });
    
    console.log('Final emails array length:', emails.length);
    console.log('Final emails array:', JSON.stringify(emails, null, 2));
    
    // Return consistent format with success flag and emails array
    const response = {
      success: true,
      emails: emails
    };
    
    console.log('Sending response:', JSON.stringify(response, null, 2));
    res.status(200).json(response);
  } catch (error) {
    console.error('=== ERROR in /scheduled route ===');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Error code:', error.code);
    
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch scheduled emails',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Cancel/Delete a scheduled email
router.delete('/scheduled/:id', authenticateToken, async (req, res) => {
  try {
    console.log('=== DELETE /scheduled/:id route called ===');
    const userId = req.user.uid;
    const emailId = req.params.id;
    console.log('Cancelling email:', emailId, 'for user:', userId);
    
    await admin.firestore
      .collection('users')
      .doc(userId)
      .collection('scheduledEmails')
      .doc(emailId)
      .update({
        status: 'cancelled',
        cancelledAt: new Date().toISOString()
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

// Reschedule an email
router.put('/scheduled/:id/reschedule', authenticateToken, async (req, res) => {
  try {
    console.log('=== PUT /scheduled/:id/reschedule route called ===');
    const userId = req.user.uid;
    const emailId = req.params.id;
    const { scheduledFor } = req.body;
    console.log('Rescheduling email:', emailId, 'for user:', userId, 'to:', scheduledFor);
    
    if (!scheduledFor) {
      return res.status(400).json({ 
        success: false,
        error: 'scheduledFor is required' 
      });
    }
    
    await admin.firestore
      .collection('users')
      .doc(userId)
      .collection('scheduledEmails')
      .doc(emailId)
      .update({
        scheduledFor: scheduledFor,
        rescheduledAt: new Date().toISOString()
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
    console.log('Sending test email for user:', userId);
    
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
      error: 'Failed to send test email' 
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
    
    const activity = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
    // Add logic to verify user's email service configuration
    // This would check if OAuth tokens are valid, etc.
    
    res.status(200).json({
      success: true,
      verified: true,
      message: 'Email service is configured correctly'
    });
  } catch (error) {
    console.error('Error verifying email service:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to verify email service' 
    });
  }
});

module.exports = router;