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

  // Cancel scheduled email
  cancelEmail: (emailId) => 
    apiRequest(`/emails/scheduled/${emailId}`, {
      method: 'DELETE'
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

  // Get email activity
  getActivity: () => 
    apiRequest('/emails/activity'),

  // Preview email
  previewEmail: (emailData) => 
    apiRequest('/emails/preview', {
      method: 'POST',
      body: JSON.stringify(emailData)
    }),

  // Verify email service
  verifyEmailService: () => 
    apiRequest('/emails/verify')
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
  delete: (endpoint) => apiRequest(endpoint, {
    method: 'DELETE'
  })
};

export default apiRequest;