 const express = require('express');
const router = express.Router();
const aiReplyService = require('../services/aiReplyService');
const { authenticateToken } = require('../middleware/auth');

// Process auto-reply queue
router.post('/process-queue', async (req, res) => {
  try {
    console.log('🔄 Manual queue processing requested');
    
    // Your service method is called 'processQueue'
    const result = await aiReplyService.processQueue();
    
    res.json(result);
    
  } catch (error) {
    console.error('Error processing queue:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get queue status for a user
router.get('/queue-status/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    
    // Your service method is called 'getQueueStatus'
    const result = await aiReplyService.getQueueStatus(userId);
    
    res.json(result);
    
  } catch (error) {
    console.error('Error getting queue status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Add email to auto-reply queue
router.post('/add-to-queue', async (req, res) => {
  try {
    const { userId, emailData, options } = req.body;
    
    if (!userId || !emailData) {
      return res.status(400).json({
        success: false,
        error: 'userId and emailData are required'
      });
    }
    
    // Your service method is called 'addToQueue'
    const result = await aiReplyService.addToQueue(userId, emailData, options);
    
    res.json(result);
    
  } catch (error) {
    console.error('Error adding to queue:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Generate AI reply (test endpoint)
router.post('/generate-reply', async (req, res) => {
  try {
    const { originalEmail, replyEmail, context } = req.body;
    
    if (!originalEmail) {
      return res.status(400).json({
        success: false,
        error: 'originalEmail is required'
      });
    }
    
    // Your service method is called 'generateAutoReply'
    const result = await aiReplyService.generateAutoReply(originalEmail, replyEmail, context || {});
    
    res.json(result);
    
  } catch (error) {
    console.error('Error generating reply:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Generate follow-up message
router.post('/generate-followup', async (req, res) => {
  try {
    const { originalEmail, daysWaited, context } = req.body;
    
    if (!originalEmail || daysWaited === undefined) {
      return res.status(400).json({
        success: false,
        error: 'originalEmail and daysWaited are required'
      });
    }
    
    // Your service method is called 'generateFollowUpMessage'
    const result = await aiReplyService.generateFollowUpMessage(originalEmail, daysWaited, context || {});
    
    res.json(result);
    
  } catch (error) {
    console.error('Error generating follow-up:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Personalize email content
router.post('/personalize-email', async (req, res) => {
  try {
    const { template, recipientData, context } = req.body;
    
    if (!template || !recipientData) {
      return res.status(400).json({
        success: false,
        error: 'template and recipientData are required'
      });
    }
    
    // Your service method is called 'personalizeEmailContent'
    const result = await aiReplyService.personalizeEmailContent(template, recipientData, context || {});
    
    res.json(result);
    
  } catch (error) {
    console.error('Error personalizing email:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Clear pending queue (debug endpoint)
router.post('/clear-queue', async (req, res) => {
  try {
    console.log('🧹 Clearing pending queue...');
    
    // Your service method is called 'clearPendingQueue'
    const deletedCount = await aiReplyService.clearPendingQueue();
    
    res.json({
      success: true,
      message: `Cleared ${deletedCount} pending queue items`,
      deletedCount: deletedCount
    });
    
  } catch (error) {
    console.error('Error clearing queue:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get processing statistics
router.get('/stats', (req, res) => {
  try {
    // Your service method is called 'getStats'
    const stats = aiReplyService.getStats();
    
    res.json({
      success: true,
      stats: stats,
      uptime: process.uptime(),
      isProcessing: aiReplyService.isProcessing || false
    });
    
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
