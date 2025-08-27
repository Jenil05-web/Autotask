const cron = require('node-cron');
const admin = require('./firebaseAdmin');
const { sendEmail } = require('./emailService'); // The OAuth-enabled email service

// Store active cron jobs to manage them
const activeCronJobs = new Map();

/**
 * Schedules a new email task by saving it to Firestore and creating appropriate cron job(s).
 * @param {string} userId - The Firebase UID of the user scheduling the email.
 * @param {object} emailData - The email data from the frontend.
 * @returns {object} - The newly created task data.
 */
const scheduleNewEmail = async (userId, emailData) => {
  const firestore = admin.firestore;
  
  try {
    // 1. Save the email task to a user-specific subcollection in Firestore
    const newEmailRef = await firestore.collection('users').doc(userId).collection('scheduledEmails').add({
      ...emailData,
      status: 'scheduled',
      userId: userId,
      createdAt: new Date().toISOString(),
      lastSent: null,
      totalSent: 0,
      nextScheduledRun: emailData.scheduledFor
    });

    const taskId = newEmailRef.id;
    console.log(`Email task ${taskId} for user ${userId} saved to Firestore.`);

    // 2. Create cron job based on email type (one-time or recurring)
    if (emailData.recurring && emailData.recurring.enabled) {
      await createRecurringEmailJob(userId, taskId, emailData, newEmailRef);
    } else {
      await createOneTimeEmailJob(userId, taskId, emailData, newEmailRef);
    }

    // 3. Handle follow-up emails if enabled
    if (emailData.followUp && emailData.followUp.enabled) {
      await scheduleFollowUpEmail(userId, taskId, emailData);
    }

    console.log(`📅 Email task ${taskId} scheduled successfully`);
    return { id: taskId, ...emailData };

  } catch (error) {
    console.error(`Error scheduling email task for user ${userId}:`, error);
    throw error;
  }
};

/**
 * Creates a one-time email job
 */
const createOneTimeEmailJob = async (userId, taskId, emailData, emailRef) => {
  const scheduledDate = new Date(emailData.scheduledFor);
  
  // Cron format: minute hour day month dayOfWeek
  const cronTime = `${scheduledDate.getMinutes()} ${scheduledDate.getHours()} ${scheduledDate.getDate()} ${scheduledDate.getMonth() + 1} *`;
  
  const task = cron.schedule(cronTime, async () => {
    await executeEmailTask(userId, taskId, emailData, emailRef, true); // true = destroy after execution
  }, {
    scheduled: true,
    timezone: "Asia/Kolkata"
  });

  // Store the job reference
  activeCronJobs.set(taskId, task);
  console.log(`📧 One-time job scheduled for task ${taskId} at ${scheduledDate.toLocaleString()}`);
};

/**
 * Creates a recurring email job based on frequency and selected days
 */
const createRecurringEmailJob = async (userId, taskId, emailData, emailRef) => {
  const { recurring } = emailData;
  let cronTime;

  switch (recurring.type) {
    case 'daily':
      // Run every day at specified hour and minute
      cronTime = `${recurring.minute} ${recurring.hour} * * *`;
      break;

    case 'weekly':
      // Run on selected days at specified hour and minute
      if (!recurring.selectedDays || recurring.selectedDays.length === 0) {
        throw new Error('Selected days are required for weekly recurring emails');
      }
      
      // Convert day names to cron day numbers (0 = Sunday, 1 = Monday, etc.)
      const dayMap = {
        'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
        'thursday': 4, 'friday': 5, 'saturday': 6
      };
      
      const cronDays = recurring.selectedDays.map(day => dayMap[day.toLowerCase()]).join(',');
      cronTime = `${recurring.minute} ${recurring.hour} * * ${cronDays}`;
      break;

    case 'monthly':
      // Run on the same day of each month at specified hour and minute
      const scheduledDate = new Date(emailData.scheduledFor);
      cronTime = `${recurring.minute} ${recurring.hour} ${scheduledDate.getDate()} * *`;
      break;

    default:
      throw new Error(`Unsupported recurring type: ${recurring.type}`);
  }

  const task = cron.schedule(cronTime, async () => {
    await executeEmailTask(userId, taskId, emailData, emailRef, false); // false = don't destroy
  }, {
    scheduled: true,
    timezone: "Asia/Kolkata"
  });

  // Store the job reference
  activeCronJobs.set(taskId, task);
  console.log(`🔄 Recurring ${recurring.type} job scheduled for task ${taskId} with pattern: ${cronTime}`);
  
  if (recurring.type === 'weekly') {
    console.log(`📅 Will run on: ${recurring.selectedDays.join(', ')} at ${recurring.hour}:${recurring.minute.toString().padStart(2, '0')}`);
  }
};

/**
 * Executes the actual email sending task
 */
const executeEmailTask = async (userId, taskId, emailData, emailRef, destroyAfterExecution = false) => {
  console.log(`🚀 Executing email task ${taskId} for user ${userId}`);
  
  try {
    // Check if task is still active (not cancelled by user)
    const taskDoc = await emailRef.get();
    const taskData = taskDoc.data();
    
    if (!taskData || taskData.status === 'cancelled' || taskData.status === 'deleted') {
      console.log(`⏭️ Task ${taskId} is cancelled/deleted, skipping execution`);
      if (destroyAfterExecution && activeCronJobs.has(taskId)) {
        activeCronJobs.get(taskId).stop();
        activeCronJobs.delete(taskId);
      }
      return;
    }

    // Apply personalization if configured
    const personalizedSubject = applyPersonalization(emailData.subject, emailData.personalization);
    const personalizedBody = applyPersonalization(emailData.body, emailData.personalization);

    // Send the email using the user's OAuth credentials
    await sendEmail({
      userId: userId,
      from: emailData.from,
      to: emailData.recipients,
      cc: emailData.cc || [],
      bcc: emailData.bcc || [],
      subject: personalizedSubject,
      html: personalizedBody,
      autoReply: emailData.autoReply // Pass auto-reply settings to email service
    });

    // Update the status in Firestore
    const updateData = {
      lastSent: new Date().toISOString(),
    totalSent: require('firebase-admin').firestore.FieldValue.increment(1)
    };

    // For one-time emails, mark as sent
    if (destroyAfterExecution) {
      updateData.status = 'sent';
    } else {
      // For recurring emails, calculate next run time
      updateData.nextScheduledRun = calculateNextRun(emailData.recurring);
    }

    await emailRef.update(updateData);
    console.log(`✅ Email task ${taskId} executed successfully. Total sent: ${taskData.totalSent + 1}`);

    // Stop and remove one-time jobs after execution
    if (destroyAfterExecution && activeCronJobs.has(taskId)) {
      activeCronJobs.get(taskId).stop();
      activeCronJobs.delete(taskId);
      console.log(`🗑️ One-time job ${taskId} removed after execution`);
    }

  } catch (error) {
    // Update status to failed and log error
    await emailRef.update({ 
      status: 'failed', 
      lastError: error.message,
      lastFailedAt: new Date().toISOString()
    });
    console.error(`❌ Email task ${taskId} failed:`, error);
  }
};

/**
 * Schedules follow-up emails
 */
const scheduleFollowUpEmail = async (userId, originalTaskId, emailData) => {
  if (!emailData.followUp || !emailData.followUp.enabled) return;

  const firestore = admin.firestore;
  const followUpDate = new Date();
  followUpDate.setDate(followUpDate.getDate() + emailData.followUp.daysAfter);

  // Create follow-up email document
  const followUpRef = await firestore.collection('users').doc(userId).collection('scheduledEmails').add({
    ...emailData,
    subject: `Follow-up: ${emailData.subject}`,
    body: emailData.followUp.message || emailData.body,
    scheduledFor: followUpDate.toISOString(),
    isFollowUp: true,
    originalTaskId: originalTaskId,
    recurring: { enabled: false }, // Follow-ups are one-time only
    status: 'scheduled',
    createdAt: new Date().toISOString()
  });

  const followUpTaskId = followUpRef.id;
  
  // Schedule the follow-up email
  await createOneTimeEmailJob(userId, followUpTaskId, {
    ...emailData,
    scheduledFor: followUpDate.toISOString(),
    subject: `Follow-up: ${emailData.subject}`,
    body: emailData.followUp.message || emailData.body
  }, followUpRef);

  console.log(`📬 Follow-up email ${followUpTaskId} scheduled for ${followUpDate.toLocaleString()}`);
};

/**
 * Applies personalization to email content
 */
const applyPersonalization = (content, personalizationData) => {
  if (!personalizationData || Object.keys(personalizationData).length === 0) {
    return content;
  }

  let personalizedContent = content;
  Object.entries(personalizationData).forEach(([key, value]) => {
    const regex = new RegExp(`{${key}}`, 'g');
    personalizedContent = personalizedContent.replace(regex, value);
  });

  return personalizedContent;
};

/**
 * Calculates the next run time for recurring emails
 */
const calculateNextRun = (recurringConfig) => {
  const now = new Date();
  const nextRun = new Date();

  switch (recurringConfig.type) {
    case 'daily':
      nextRun.setDate(now.getDate() + 1);
      break;
    case 'weekly':
      nextRun.setDate(now.getDate() + 7);
      break;
    case 'monthly':
      nextRun.setMonth(now.getMonth() + 1);
      break;
  }

  nextRun.setHours(recurringConfig.hour);
  nextRun.setMinutes(recurringConfig.minute);
  nextRun.setSeconds(0);
  nextRun.setMilliseconds(0);

  return nextRun.toISOString();
};

/**
 * Cancels a scheduled email task
 */
const cancelEmailTask = async (userId, taskId) => {
  const firestore = admin.firestore;
  
  try {
    // Update status in Firestore
    await firestore.collection('users').doc(userId).collection('scheduledEmails').doc(taskId).update({
      status: 'cancelled',
      cancelledAt: new Date().toISOString()
    });

    // Stop and remove the cron job
    if (activeCronJobs.has(taskId)) {
      activeCronJobs.get(taskId).stop();
      activeCronJobs.delete(taskId);
      console.log(`❌ Email task ${taskId} cancelled and cron job removed`);
    }

    return { success: true, message: `Task ${taskId} cancelled successfully` };
  } catch (error) {
    console.error(`Error cancelling task ${taskId}:`, error);
    throw error;
  }
};

/**
 * Gets all scheduled emails for a user
 */
const getUserScheduledEmails = async (userId) => {
  const firestore = admin.firestore;
  
  try {
    const snapshot = await firestore
      .collection('users')
      .doc(userId)
      .collection('scheduledEmails')
      .orderBy('createdAt', 'desc')
      .get();

    const emails = [];
    snapshot.forEach(doc => {
      emails.push({ id: doc.id, ...doc.data() });
    });

    return emails;
  } catch (error) {
    console.error(`Error fetching scheduled emails for user ${userId}:`, error);
    throw error;
  }
};

/**
 * Updates an existing scheduled email task
 */
const updateEmailTask = async (userId, taskId, updateData) => {
  const firestore = admin.firestore;
  
  try {
    // Cancel the existing cron job
    if (activeCronJobs.has(taskId)) {
      activeCronJobs.get(taskId).stop();
      activeCronJobs.delete(taskId);
    }

    // Update the document in Firestore
    const emailRef = firestore.collection('users').doc(userId).collection('scheduledEmails').doc(taskId);
    await emailRef.update({
      ...updateData,
      updatedAt: new Date().toISOString()
    });

    // Get the updated document
    const updatedDoc = await emailRef.get();
    const updatedEmailData = updatedDoc.data();

    // Reschedule with new parameters
    if (updatedEmailData.recurring && updatedEmailData.recurring.enabled) {
      await createRecurringEmailJob(userId, taskId, updatedEmailData, emailRef);
    } else {
      await createOneTimeEmailJob(userId, taskId, updatedEmailData, emailRef);
    }

    console.log(`🔄 Email task ${taskId} updated and rescheduled`);
    return { id: taskId, ...updatedEmailData };
  } catch (error) {
    console.error(`Error updating task ${taskId}:`, error);
    throw error;
  }
};

/**
 * Initialize scheduler - restore cron jobs from database on server restart
 */
const initializeScheduler = async () => {
  const firestore = admin.firestore;
  console.log('🚀 Initializing email scheduler...');

  try {
    // Get all active scheduled emails from all users
    const usersSnapshot = await firestore.collection('users').get();
    
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      const emailsSnapshot = await firestore
        .collection('users')
        .doc(userId)
        .collection('scheduledEmails')
        .where('status', 'in', ['scheduled'])
        .get();

      for (const emailDoc of emailsSnapshot.docs) {
        const taskId = emailDoc.id;
        const emailData = emailDoc.data();
        
        try {
          if (emailData.recurring && emailData.recurring.enabled) {
            await createRecurringEmailJob(userId, taskId, emailData, emailDoc.ref);
          } else {
            // Check if one-time email is still in the future
            const scheduledDate = new Date(emailData.scheduledFor);
            if (scheduledDate > new Date()) {
              await createOneTimeEmailJob(userId, taskId, emailData, emailDoc.ref);
            } else {
              // Mark expired one-time emails as missed
              await emailDoc.ref.update({ status: 'missed' });
            }
          }
        } catch (error) {
          console.error(`Error reinitializing task ${taskId}:`, error);
        }
      }
    }

    console.log(`✅ Scheduler initialized with ${activeCronJobs.size} active jobs`);
  } catch (error) {
    console.error('❌ Error initializing scheduler:', error);
  }
};

module.exports = {
  scheduleNewEmail,
  cancelEmailTask,
  getUserScheduledEmails,
  updateEmailTask,
  initializeScheduler
};