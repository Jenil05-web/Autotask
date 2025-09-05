require('dotenv').config();
const firebaseAdmin = require('./services/firebaseAdmin');

async function clearStuckQueue() {
  try {
    console.log('🧹 Starting queue cleanup...');
    
    // Wait for Firebase to initialize
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    if (!firebaseAdmin.isInitialized()) {
      console.error('❌ Firebase not initialized. Please check your .env configuration.');
      process.exit(1);
    }
    
    const userId = 'YYaZizyXAkQbunFdL11LQGXl2z82'; // Your stuck user ID
    
    console.log(`🔍 Looking for stuck queue items for user: ${userId}`);
    
    // Get all queue items for this user
    const queueSnapshot = await firebaseAdmin.db
      .collection('users')
      .doc(userId)
      .collection('autoReplyQueue')
      .get();
    
    console.log(`Found ${queueSnapshot.size} total queue items`);
    
    if (queueSnapshot.empty) {
      console.log('✅ No queue items found!');
      process.exit(0);
    }
    
    // Show details of what we found
    const itemsByStatus = {};
    queueSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const status = data.status || 'unknown';
      if (!itemsByStatus[status]) itemsByStatus[status] = 0;
      itemsByStatus[status]++;
      
      console.log(`📄 Queue Item ${doc.id}: status=${status}, scheduledFor=${data.scheduledFor?.toDate()}`);
    });
    
    console.log('📊 Queue items by status:', itemsByStatus);
    
    // Delete ALL queue items to stop the loop completely
    console.log('🗑️ Deleting all queue items...');
    
    const batch = firebaseAdmin.db.batch();
    
    queueSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    console.log(`✅ Successfully deleted ${queueSnapshot.size} queue items`);
    
    // Also check if there are any other users with stuck queues
    console.log('🔍 Checking for other users with stuck queues...');
    
    const allQueues = await firebaseAdmin.db
      .collectionGroup('autoReplyQueue')
      .limit(50)
      .get();
    
    if (!allQueues.empty) {
      console.log(`⚠️  Found ${allQueues.size} queue items from other users/collections`);
      const otherUserItems = {};
      
      allQueues.docs.forEach(doc => {
        const userId = doc.ref.parent.parent.id;
        if (!otherUserItems[userId]) otherUserItems[userId] = 0;
        otherUserItems[userId]++;
      });
      
      console.log('📊 Other users with queue items:', otherUserItems);
      
      // Clean these too
      const cleanupBatch = firebaseAdmin.db.batch();
      allQueues.docs.forEach(doc => {
        cleanupBatch.delete(doc.ref);
      });
      
      await cleanupBatch.commit();
      console.log(`✅ Cleaned up ${allQueues.size} additional queue items`);
    }
    
    console.log('🎉 Queue cleanup completed successfully!');
    console.log('✨ You can now restart your server - the stuck auto-reply loop should be gone!');
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Add a timeout to prevent hanging
setTimeout(() => {
  console.error('❌ Cleanup script timed out after 30 seconds');
  process.exit(1);
}, 30000);

clearStuckQueue();