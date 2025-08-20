const cron = require('node-cron');
const emailService = require('./emailService');
const { v4: uuidv4 } = require('uuid');

class EmailScheduler {
  constructor() {
    this.scheduledEmails = new Map(); // In-memory storage, replace with database
    this.cronJobs = new Map();
    this.followUpTracking = new Map();
    this.initializeScheduler();
  }

  initializeScheduler() {
    // Check for scheduled emails every minute
    cron.schedule('* * * * *', () => {
      this.processScheduledEmails();
    });

    // Check for follow-ups every hour
    cron.schedule('0 * * * *', () => {
      this.processFollowUps();
    });

    console.log('📅 Email scheduler initialized');
  }

  scheduleEmail(emailData) {
    const emailId = uuidv4();
    const scheduledEmail = {
      id: emailId,
      ...emailData,
      status: 'scheduled',
      createdAt: new Date(),
      scheduledFor: new Date(emailData.scheduledFor)
    };

    this.scheduledEmails.set(emailId, scheduledEmail);

    // If it's a recurring email, set up cron job
    if (emailData.recurring) {
      this.setupRecurringEmail(emailId, emailData);
    }

    return { emailId, scheduledEmail };
  }

  setupRecurringEmail(emailId, emailData) {
    let cronPattern;
    
    switch (emailData.recurring.type) {
      case 'daily':
        cronPattern = `${emailData.recurring.minute || 0} ${emailData.recurring.hour || 9} * * *`;
        break;
      case 'weekly':
        cronPattern = `${emailData.recurring.minute || 0} ${emailData.recurring.hour || 9} * * ${emailData.recurring.dayOfWeek || 1}`;
        break;
      case 'monthly':
        cronPattern = `${emailData.recurring.minute || 0} ${emailData.recurring.hour || 9} ${emailData.recurring.dayOfMonth || 1} * *`;
        break;
      case 'custom':
        cronPattern = emailData.recurring.cronPattern;
        break;
      default:
        return;
    }

    const job = cron.schedule(cronPattern, async () => {
      await this.sendScheduledEmail(emailId);
    }, { scheduled: false });

    this.cronJobs.set(emailId, job);
    job.start();
  }

  async processScheduledEmails() {
    const now = new Date();
    
    for (const [emailId, email] of this.scheduledEmails.entries()) {
      if (email.status === 'scheduled' && email.scheduledFor <= now && !email.recurring) {
        await this.sendScheduledEmail(emailId);
      }
    }
  }

  async sendScheduledEmail(emailId) {
    const email = this.scheduledEmails.get(emailId);
    if (!email) return;

    try {
      // Personalize email content
      const personalizedSubject = emailService.personalizeEmail(
        email.subject, 
        email.personalization || {}
      );
      const personalizedBody = emailService.personalizeEmail(
        email.body, 
        email.personalization || {}
      );

      const emailData = {
        to: email.recipients,
        cc: email.cc,
        bcc: email.bcc,
        subject: personalizedSubject,
        html: personalizedBody,
        attachments: email.attachments
      };

      const result = await emailService.sendEmail(emailData);

      if (result.success) {
        email.status = 'sent';
        email.sentAt = new Date();
        email.messageId = result.messageId;

        // Set up follow-up tracking if enabled
        if (email.followUp && email.followUp.enabled) {
          this.trackForFollowUp(emailId, email);
        }

        console.log(`📧 Scheduled email ${emailId} sent successfully`);
      } else {
        email.status = 'failed';
        email.error = result.error;
        console.error(`❌ Failed to send scheduled email ${emailId}:`, result.error);
      }
    } catch (error) {
      email.status = 'failed';
      email.error = error.message;
      console.error(`❌ Error sending scheduled email ${emailId}:`, error);
    }
  }

  trackForFollowUp(emailId, email) {
    const followUpId = uuidv4();
    const followUpDate = new Date();
    followUpDate.setDate(followUpDate.getDate() + (email.followUp.daysAfter || 3));

    this.followUpTracking.set(followUpId, {
      id: followUpId,
      originalEmailId: emailId,
      recipients: email.recipients,
      followUpDate,
      followUpMessage: email.followUp.message,
      status: 'pending'
    });
  }

  async processFollowUps() {
    const now = new Date();
    
    for (const [followUpId, followUp] of this.followUpTracking.entries()) {
      if (followUp.status === 'pending' && followUp.followUpDate <= now) {
        // Check if reply was received (this would need email integration)
        const replyReceived = await this.checkForReply(followUp.originalEmailId);
        
        if (!replyReceived) {
          await this.sendFollowUpEmail(followUpId);
        } else {
          followUp.status = 'reply_received';
        }
      }
    }
  }

  async checkForReply(originalEmailId) {
    // This would require email inbox integration
    // For now, return false (no reply detected)
    return false;
  }

  async sendFollowUpEmail(followUpId) {
    const followUp = this.followUpTracking.get(followUpId);
    if (!followUp) return;

    try {
      const emailData = {
        to: followUp.recipients,
        subject: 'Following up on my previous email',
        html: followUp.followUpMessage || 'Just checking in on my previous email. Looking forward to hearing from you!'
      };

      const result = await emailService.sendEmail(emailData);
      
      if (result.success) {
        followUp.status = 'sent';
        followUp.sentAt = new Date();
        console.log(`📧 Follow-up email ${followUpId} sent successfully`);
      } else {
        followUp.status = 'failed';
        followUp.error = result.error;
      }
    } catch (error) {
      followUp.status = 'failed';
      followUp.error = error.message;
      console.error(`❌ Error sending follow-up email ${followUpId}:`, error);
    }
  }

  cancelScheduledEmail(emailId) {
    const email = this.scheduledEmails.get(emailId);
    if (email && email.status === 'scheduled') {
      email.status = 'cancelled';
      
      // Stop recurring job if exists
      const cronJob = this.cronJobs.get(emailId);
      if (cronJob) {
        cronJob.stop();
        this.cronJobs.delete(emailId);
      }
      
      return true;
    }
    return false;
  }

  rescheduleEmail(emailId, newScheduleTime) {
    const email = this.scheduledEmails.get(emailId);
    if (email && email.status === 'scheduled') {
      email.scheduledFor = new Date(newScheduleTime);
      return true;
    }
    return false;
  }

  getScheduledEmails(userId) {
    // Filter by userId when database is implemented
    return Array.from(this.scheduledEmails.values());
  }

  getEmailActivity(userId) {
    const emails = this.getScheduledEmails(userId);
    const followUps = Array.from(this.followUpTracking.values());
    
    return {
      scheduled: emails.filter(e => e.status === 'scheduled').length,
      sent: emails.filter(e => e.status === 'sent').length,
      failed: emails.filter(e => e.status === 'failed').length,
      followUpsPending: followUps.filter(f => f.status === 'pending').length,
      followUpsSent: followUps.filter(f => f.status === 'sent').length
    };
  }
}

module.exports = new EmailScheduler();