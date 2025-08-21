const express = require('express');
const router = express.Router();
const emailScheduler = require('../services/emailScheduler');
const emailService = require('../services/emailService');
const firebaseAdmin = require('../services/firebaseAdmin');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const Joi = require('joi');

// Validation schemas
const scheduleEmailSchema = Joi.object({
  recipients: Joi.array().items(Joi.string().email()).min(1).required(),
  cc: Joi.array().items(Joi.string().email()).optional(),
  bcc: Joi.array().items(Joi.string().email()).optional(),
  subject: Joi.string().min(1).required(),
  body: Joi.string().min(1).required(),
  scheduledFor: Joi.date().iso().required(),
  personalization: Joi.object().optional(),
  recurring: Joi.object({
    type: Joi.string().valid('daily', 'weekly', 'monthly', 'custom').required(),
    hour: Joi.number().min(0).max(23).optional(),
    minute: Joi.number().min(0).max(59).optional(),
    dayOfWeek: Joi.number().min(0).max(6).optional(), // 0 = Sunday
    dayOfMonth: Joi.number().min(1).max(31).optional(),
    cronPattern: Joi.string().optional()
  }).optional(),
  followUp: Joi.object({
    enabled: Joi.boolean().required(),
    daysAfter: Joi.number().min(1).max(30).optional(),
    message: Joi.string().optional()
  }).optional(),
  autoReply: Joi.object({
    enabled: Joi.boolean().required(),
    message: Joi.string().optional(),
    useAI: Joi.boolean().optional()
  }).optional()
});

// Schedule a new email
router.post('/schedule', authenticateToken, async (req, res) => {
  try {
    const { error, value } = scheduleEmailSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // Add user information from authenticated request
    const emailData = {
      ...value,
      userId: req.user.uid,
      createdBy: req.user.email
    };

    const result = emailScheduler.scheduleEmail(emailData);
    
    res.status(201).json({
      success: true,
      message: 'Email scheduled successfully',
      emailId: result.emailId,
      scheduledEmail: result.scheduledEmail
    });
  } catch (error) {
    console.error('Error scheduling email:', error);
    res.status(500).json({ error: 'Failed to schedule email' });
  }
});

// Get all scheduled emails
router.get('/scheduled', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    const emails = emailScheduler.getScheduledEmails(userId);
    
    res.json({
      success: true,
      emails: emails.map(email => ({
        id: email.id,
        recipients: email.recipients,
        subject: email.subject,
        scheduledFor: email.scheduledFor,
        status: email.status,
        recurring: email.recurring,
        createdAt: email.createdAt,
        sentAt: email.sentAt
      }))
    });
  } catch (error) {
    console.error('Error fetching scheduled emails:', error);
    res.status(500).json({ error: 'Failed to fetch scheduled emails' });
  }
});

// Cancel a scheduled email
router.delete('/scheduled/:emailId', authenticateToken, async (req, res) => {
  try {
    const { emailId } = req.params;
    const success = emailScheduler.cancelScheduledEmail(emailId);
    
    if (success) {
      res.json({ success: true, message: 'Email cancelled successfully' });
    } else {
      res.status(404).json({ error: 'Email not found or cannot be cancelled' });
    }
  } catch (error) {
    console.error('Error cancelling email:', error);
    res.status(500).json({ error: 'Failed to cancel email' });
  }
});

// Reschedule an email
router.put('/scheduled/:emailId/reschedule', authenticateToken, async (req, res) => {
  try {
    const { emailId } = req.params;
    const { scheduledFor } = req.body;

    if (!scheduledFor) {
      return res.status(400).json({ error: 'scheduledFor is required' });
    }

    const success = emailScheduler.rescheduleEmail(emailId, scheduledFor);
    
    if (success) {
      res.json({ success: true, message: 'Email rescheduled successfully' });
    } else {
      res.status(404).json({ error: 'Email not found or cannot be rescheduled' });
    }
  } catch (error) {
    console.error('Error rescheduling email:', error);
    res.status(500).json({ error: 'Failed to reschedule email' });
  }
});

// Send a test email immediately
router.post('/test', authenticateToken, async (req, res) => {
  try {
    const { to, subject, body } = req.body;
    
    if (!to || !subject || !body) {
      return res.status(400).json({ error: 'to, subject, and body are required' });
    }

    const result = await emailService.sendEmail({
      to: [to],
      subject,
      html: body
    });

    res.json(result);
  } catch (error) {
    console.error('Error sending test email:', error);
    res.status(500).json({ error: 'Failed to send test email' });
  }
});

// Get email activity/statistics
router.get('/activity', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    const activity = emailScheduler.getEmailActivity(userId);
    
    res.json({
      success: true,
      activity
    });
  } catch (error) {
    console.error('Error fetching email activity:', error);
    res.status(500).json({ error: 'Failed to fetch email activity' });
  }
});

// Preview email with personalization
router.post('/preview', optionalAuth, async (req, res) => {
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
    res.status(500).json({ error: 'Failed to generate email preview' });
  }
});

// Verify email service connection
router.get('/verify', async (req, res) => {
  try {
    const result = await emailService.verifyConnection();
    res.json(result);
  } catch (error) {
    console.error('Error verifying email service:', error);
    res.status(500).json({ error: 'Failed to verify email service' });
  }
});

module.exports = router;