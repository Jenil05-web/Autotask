// API utility functions with authentication
import { auth } from '../firebase/firebase.config.local.js';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Get the current user's ID token for API requests
const getAuthToken = async () => {
  const user = auth.currentUser;
  if (user) {
    try {
      const token = await user.getIdToken();
      return token;
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  }
  return null;
};

// Make authenticated API request
const apiRequest = async (endpoint, options = {}) => {
  const token = await getAuthToken();
  
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers
    },
    ...options
  };

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || `HTTP error! status: ${response.status}`);
    }
    
    return data;
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
};

// Email API functions
export const emailAPI = {
  // Schedule a new email
  scheduleEmail: (emailData) => 
    apiRequest('/emails/schedule', {
      method: 'POST',
      body: JSON.stringify(emailData)
    }),

  // Get scheduled emails
  getScheduledEmails: () => 
    apiRequest('/emails/scheduled'),

  // Cancel scheduled email (keeps record but cancels execution)
  cancelEmail: (emailId) => 
    apiRequest(`/emails/scheduled/${emailId}`, {
      method: 'DELETE'
    }),

  // DELETE SCHEDULED EMAIL - Completely removes from database and cancels cron job
  deleteScheduledEmail: (emailId) => 
    apiRequest(`/emails/scheduled/${emailId}/delete`, {
      method: 'DELETE'
    }),

  // UPDATE SCHEDULED EMAIL - Modify existing scheduled email
  updateScheduledEmail: (emailId, updateData) => 
    apiRequest(`/emails/scheduled/${emailId}`, {
      method: 'PUT',
      body: JSON.stringify(updateData)
    }),

  // PAUSE/RESUME SCHEDULED EMAIL - Temporarily disable/enable without deleting
  pauseScheduledEmail: (emailId) => 
    apiRequest(`/emails/scheduled/${emailId}/pause`, {
      method: 'PATCH'
    }),

  resumeScheduledEmail: (emailId) => 
    apiRequest(`/emails/scheduled/${emailId}/resume`, {
      method: 'PATCH'
    }),

  // GET SINGLE SCHEDULED EMAIL - Get details of a specific email
  getScheduledEmail: (emailId) => 
    apiRequest(`/emails/scheduled/${emailId}`),

  // DUPLICATE SCHEDULED EMAIL - Create a copy of existing email
  duplicateScheduledEmail: (emailId) => 
    apiRequest(`/emails/scheduled/${emailId}/duplicate`, {
      method: 'POST'
    }),

  // Reschedule email
  rescheduleEmail: (emailId, scheduledFor) => 
    apiRequest(`/emails/scheduled/${emailId}/reschedule`, {
      method: 'PUT',
      body: JSON.stringify({ scheduledFor })
    }),

  // Send test email
  sendTestEmail: (emailData) => 
    apiRequest('/emails/test', {
      method: 'POST',
      body: JSON.stringify(emailData)
    }),

  // Get email activity/history
  getActivity: () => 
    apiRequest('/emails/activity'),

  // Get email statistics
  getEmailStats: () => 
    apiRequest('/emails/stats'),

  // Get execution history for a specific email
  getEmailHistory: (emailId) => 
    apiRequest(`/emails/scheduled/${emailId}/history`),

  // Preview email
  previewEmail: (emailData) => 
    apiRequest('/emails/preview', {
      method: 'POST',
      body: JSON.stringify(emailData)
    }),

  // Verify email service
  verifyEmailService: () => 
    apiRequest('/emails/verify'),

  // BULK OPERATIONS
  // Delete multiple emails at once
  bulkDeleteEmails: (emailIds) => 
    apiRequest('/emails/scheduled/bulk-delete', {
      method: 'DELETE',
      body: JSON.stringify({ emailIds })
    }),

  // Pause multiple emails at once
  bulkPauseEmails: (emailIds) => 
    apiRequest('/emails/scheduled/bulk-pause', {
      method: 'PATCH',
      body: JSON.stringify({ emailIds })
    }),

  // Resume multiple emails at once
  bulkResumeEmails: (emailIds) => 
    apiRequest('/emails/scheduled/bulk-resume', {
      method: 'PATCH',
      body: JSON.stringify({ emailIds })
    })
};

// Gmail API functions
export const gmailAPI = {
  // Get Gmail OAuth URL
  getAuthUrl: () => 
    apiRequest('/auth/google/url'),

  // Check Gmail connection status
  getStatus: () => 
    apiRequest('/auth/google/status'),

  // Disconnect Gmail account
  disconnect: () => 
    apiRequest('/auth/google/disconnect', {
      method: 'DELETE'
    }),

  // Send test email
  sendTest: (testEmail) => 
    apiRequest('/auth/google/test', {
      method: 'POST',
      body: JSON.stringify({ testEmail })
    }),

  // Get Gmail account info
  getAccountInfo: () => 
    apiRequest('/auth/google/account'),

  // Refresh Gmail token
  refreshToken: () => 
    apiRequest('/auth/google/refresh', {
      method: 'POST'
    })
};

// Generic API functions
export const api = {
  get: (endpoint) => apiRequest(endpoint),
  post: (endpoint, data) => apiRequest(endpoint, {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  put: (endpoint, data) => apiRequest(endpoint, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  patch: (endpoint, data) => apiRequest(endpoint, {
    method: 'PATCH',
    body: JSON.stringify(data)
  }),
  delete: (endpoint) => apiRequest(endpoint, {
    method: 'DELETE'
  })
};

export default apiRequest;