const express = require('express');
const router = express.Router();
const cron = require('node-cron');
const { OpenAI } = require('openai');

// Initialize OpenAI (you'll need to set OPENAI_API_KEY in your environment)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// In-memory storage for email automations (in production, use database)
let emailAutomations = [];
let scheduledJobs = new Map();

// Middleware to verify authentication
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  // In production, verify JWT token here
  // For now, we'll just check if token exists
  next();
};

// Apply authentication to all routes
router.use(authenticateToken);

// Create new email automation
router.post('/schedule', async (req, res) => {
  try {
    const {
      subject,
      body,
      recipients,
      cc = [],
      bcc = [],
      scheduledTime,
      isRecurring = false,
      recurrenceType = 'daily',
      customRecurrence = '',
      followUpEnabled = false,
      followUpDays = 3,
      followUpMessage = '',
      autoReplyEnabled = false,
      autoReplyMessage = '',
      personalizationEnabled = true,
      variables = {}
    } = req.body;

    // Validate required fields
    if (!subject || !body || !recipients || !scheduledTime) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Create automation object
    const automation = {
      id: Date.now().toString(),
      subject,
      body,
      recipients: Array.isArray(recipients) ? recipients : [recipients],
      cc: Array.isArray(cc) ? cc : [cc],
      bcc: Array.isArray(bcc) ? bcc : [bcc],
      scheduledTime: new Date(scheduledTime),
      isRecurring,
      recurrenceType,
      customRecurrence,
      followUpEnabled,
      followUpDays,
      followUpMessage,
      autoReplyEnabled,
      autoReplyMessage,
      personalizationEnabled,
      variables,
      status: 'scheduled',
      createdAt: new Date(),
      lastSent: null,
      nextRun: new Date(scheduledTime)
    };

    // Add to storage
    emailAutomations.push(automation);

    // Schedule the email
    scheduleEmail(automation);

    res.status(201).json({
      message: 'Email automation scheduled successfully',
      automation
    });
  } catch (error) {
    console.error('Error scheduling email:', error);
    res.status(500).json({ error: 'Failed to schedule email automation' });
  }
});

// Get all email automations for a user
router.get('/', (req, res) => {
  try {
    // In production, filter by user ID
    res.json({
      automations: emailAutomations,
      total: emailAutomations.length
    });
  } catch (error) {
    console.error('Error fetching automations:', error);
    res.status(500).json({ error: 'Failed to fetch email automations' });
  }
});

// Get specific automation by ID
router.get('/:id', (req, res) => {
  try {
    const automation = emailAutomations.find(a => a.id === req.params.id);
    if (!automation) {
      return res.status(404).json({ error: 'Automation not found' });
    }
    res.json(automation);
  } catch (error) {
    console.error('Error fetching automation:', error);
    res.status(500).json({ error: 'Failed to fetch automation' });
  }
});

// Update automation
router.put('/:id', (req, res) => {
  try {
    const index = emailAutomations.findIndex(a => a.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: 'Automation not found' });
    }

    // Cancel existing job if scheduled
    if (scheduledJobs.has(req.params.id)) {
      scheduledJobs.get(req.params.id).stop();
      scheduledJobs.delete(req.params.id);
    }

    // Update automation
    emailAutomations[index] = {
      ...emailAutomations[index],
      ...req.body,
      updatedAt: new Date()
    };

    // Reschedule if status is active
    if (emailAutomations[index].status === 'scheduled') {
      scheduleEmail(emailAutomations[index]);
    }

    res.json({
      message: 'Automation updated successfully',
      automation: emailAutomations[index]
    });
  } catch (error) {
    console.error('Error updating automation:', error);
    res.status(500).json({ error: 'Failed to update automation' });
  }
});

// Cancel/delete automation
router.delete('/:id', (req, res) => {
  try {
    const index = emailAutomations.findIndex(a => a.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: 'Automation not found' });
    }

    // Cancel scheduled job
    if (scheduledJobs.has(req.params.id)) {
      scheduledJobs.get(req.params.id).stop();
      scheduledJobs.delete(req.params.id);
    }

    // Remove from storage
    emailAutomations.splice(index, 1);

    res.json({ message: 'Automation deleted successfully' });
  } catch (error) {
    console.error('Error deleting automation:', error);
    res.status(500).json({ error: 'Failed to delete automation' });
  }
});

// Pause/activate automation
router.patch('/:id/status', (req, res) => {
  try {
    const { status } = req.body;
    const automation = emailAutomations.find(a => a.id === req.params.id);
    
    if (!automation) {
      return res.status(404).json({ error: 'Automation not found' });
    }

    if (status === 'paused') {
      // Cancel scheduled job
      if (scheduledJobs.has(req.params.id)) {
        scheduledJobs.get(req.params.id).stop();
        scheduledJobs.delete(req.params.id);
      }
    } else if (status === 'scheduled') {
      // Reschedule
      scheduleEmail(automation);
    }

    automation.status = status;
    automation.updatedAt = new Date();

    res.json({
      message: 'Automation status updated successfully',
      automation
    });
  } catch (error) {
    console.error('Error updating automation status:', error);
    res.status(500).json({ error: 'Failed to update automation status' });
  }
});

// Run automation immediately
router.post('/:id/run', async (req, res) => {
  try {
    const automation = emailAutomations.find(a => a.id === req.params.id);
    if (!automation) {
      return res.status(404).json({ error: 'Automation not found' });
    }

    // Send email immediately
    await sendEmail(automation);
    
    // Update last sent time
    automation.lastSent = new Date();
    
    res.json({
      message: 'Email sent successfully',
      automation
    });
  } catch (error) {
    console.error('Error running automation:', error);
    res.status(500).json({ error: 'Failed to run automation' });
  }
});

// Generate AI-powered auto-reply
router.post('/generate-auto-reply', async (req, res) => {
  try {
    const { originalEmail, context, tone = 'professional' } = req.body;

    if (!originalEmail) {
      return res.status(400).json({ error: 'Original email content required' });
    }

    const prompt = `Generate a ${tone} auto-reply email based on this email: "${originalEmail}". 
    Context: ${context || 'General inquiry'}. 
    Keep it concise, professional, and helpful.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that generates professional email responses."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 200
    });

    const autoReply = completion.choices[0].message.content;

    res.json({
      autoReply,
      generatedAt: new Date()
    });
  } catch (error) {
    console.error('Error generating auto-reply:', error);
    res.status(500).json({ error: 'Failed to generate auto-reply' });
  }
});

// Helper function to schedule email
function scheduleEmail(automation) {
  if (automation.status !== 'scheduled') return;

  const scheduleTime = new Date(automation.scheduledTime);
  const now = new Date();

  if (scheduleTime <= now) {
    // Send immediately if scheduled time has passed
    sendEmail(automation);
    return;
  }

  // Calculate delay in milliseconds
  const delay = scheduleTime.getTime() - now.getTime();

  // Schedule the email
  const job = setTimeout(async () => {
    try {
      await sendEmail(automation);
      
      // Schedule follow-up if enabled
      if (automation.followUpEnabled) {
        scheduleFollowUp(automation);
      }
      
      // Update next run time for recurring emails
      if (automation.isRecurring) {
        updateNextRunTime(automation);
        scheduleEmail(automation); // Reschedule
      }
    } catch (error) {
      console.error('Error in scheduled email job:', error);
    }
  }, delay);

  scheduledJobs.set(automation.id, { stop: () => clearTimeout(job) });
}

// Helper function to send email
async function sendEmail(automation) {
  try {
    // In production, integrate with email service (SendGrid, AWS SES, etc.)
    console.log(`Sending email: ${automation.subject} to ${automation.recipients.join(', ')}`);
    
    // Simulate email sending
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Update automation status
    automation.lastSent = new Date();
    automation.status = 'sent';
    
    console.log(`Email sent successfully: ${automation.subject}`);
  } catch (error) {
    console.error('Error sending email:', error);
    automation.status = 'error';
    throw error;
  }
}

// Helper function to schedule follow-up
function scheduleFollowUp(automation) {
  if (!automation.followUpEnabled || !automation.followUpMessage) return;

  const followUpTime = new Date(automation.scheduledTime);
  followUpTime.setDate(followUpTime.getDate() + automation.followUpDays);

  const delay = followUpTime.getTime() - Date.now();
  
  if (delay > 0) {
    setTimeout(async () => {
      try {
        // Check if reply was received (in production, integrate with email service)
        const hasReply = false; // Placeholder
        
        if (!hasReply) {
          console.log(`Sending follow-up for: ${automation.subject}`);
          // Send follow-up email
          // await sendFollowUpEmail(automation);
        }
      } catch (error) {
        console.error('Error in follow-up job:', error);
      }
    }, delay);
  }
}

// Helper function to update next run time for recurring emails
function updateNextRunTime(automation) {
  const current = new Date(automation.nextRun);
  
  switch (automation.recurrenceType) {
    case 'daily':
      current.setDate(current.getDate() + 1);
      break;
    case 'weekly':
      current.setDate(current.getDate() + 7);
      break;
    case 'monthly':
      current.setMonth(current.getMonth() + 1);
      break;
    case 'custom':
      // Handle custom recurrence logic
      break;
  }
  
  automation.nextRun = current;
}

module.exports = router;