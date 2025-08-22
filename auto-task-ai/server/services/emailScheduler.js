const cron = require('node-cron');
const admin = require('./firebaseAdmin');
const { sendEmail } = require('./emailService'); // The OAuth-enabled email service

/**
 * Schedules a new email task by saving it to Firestore and creating a cron job.
 * @param {string} userId - The Firebase UID of the user scheduling the email.
 * @param {object} emailData - The email data from the frontend.
 * @returns {object} - The newly created task data.
 */
const scheduleNewEmail = async (userId, emailData) => {
  const firestore = admin.firestore;
  
  // 1. Save the email task to a user-specific subcollection in Firestore
  const newEmailRef = await firestore.collection('users').doc(userId).collection('scheduledEmails').add({
    ...emailData,
    status: 'scheduled',
    userId: userId, // Store the owner of the task
    createdAt: new Date().toISOString()
  });

  const taskId = newEmailRef.id;
  console.log(`Email task ${taskId} for user ${userId} saved to Firestore.`);

  // 2. Schedule the one-time email send using node-cron
  const scheduledDate = new Date(emailData.scheduledFor);
  
  // This cron job will run only once at the specified time and then destroy itself.
  const cronTime = `${scheduledDate.getMinutes()} ${scheduledDate.getHours()} ${scheduledDate.getDate()} ${scheduledDate.getMonth() + 1} *`;

  const task = cron.schedule(cronTime, async () => {
    console.log(`Executing scheduled email task ${taskId} for user ${userId}`);
    
    try {
      // Send the email using the user's OAuth credentials
      await sendEmail({
        userId: userId, // Pass the user's ID to the email service
        from: emailData.from,
        to: emailData.recipients,
        cc: emailData.cc,
        bcc: emailData.bcc,
        subject: emailData.subject,
        html: emailData.body
      });
      
      // Update the status in Firestore to 'sent'
      await newEmailRef.update({ status: 'sent', sentAt: new Date().toISOString() });
      console.log(`✅ Email task ${taskId} completed and status updated.`);

    } catch (error) {
      // If sending fails, update the status in Firestore
      await newEmailRef.update({ status: 'failed', error: error.message });
      console.error(`❌ Email task ${taskId} failed:`, error);
    } finally {
        // Stop the cron job after it has run
        task.stop();
    }
  }, {
    scheduled: true,
    timezone: "Asia/Kolkata" // It's good practice to set a consistent timezone
  });

  console.log(`📅 Job scheduled for task ${taskId} at ${scheduledDate.toLocaleString()}`);
  
  return { id: taskId, ...emailData };
};


// Note: The logic for recurring emails and follow-ups would be built here.
// It would involve creating more complex cron jobs that re-schedule themselves
// and creating separate documents in Firestore for follow-up tasks.
// The current implementation focuses on the core one-time scheduling.


module.exports = { scheduleNewEmail };