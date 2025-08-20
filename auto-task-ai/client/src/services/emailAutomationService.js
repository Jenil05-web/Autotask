import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Email Automation API Service
export const emailAutomationService = {
  // Schedule a new email automation
  async scheduleEmail(automationData) {
    try {
      const response = await api.post('/email-automation/schedule', automationData);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  },

  // Get all email automations
  async getAutomations() {
    try {
      const response = await api.get('/email-automation');
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  },

  // Get specific automation by ID
  async getAutomation(id) {
    try {
      const response = await api.get(`/email-automation/${id}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  },

  // Update automation
  async updateAutomation(id, updateData) {
    try {
      const response = await api.put(`/email-automation/${id}`, updateData);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  },

  // Delete automation
  async deleteAutomation(id) {
    try {
      const response = await api.delete(`/email-automation/${id}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  },

  // Update automation status (pause/activate)
  async updateStatus(id, status) {
    try {
      const response = await api.patch(`/email-automation/${id}/status`, { status });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  },

  // Run automation immediately
  async runAutomation(id) {
    try {
      const response = await api.post(`/email-automation/${id}/run`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  },

  // Generate AI-powered auto-reply
  async generateAutoReply(originalEmail, context, tone = 'professional') {
    try {
      const response = await api.post('/email-automation/generate-auto-reply', {
        originalEmail,
        context,
        tone
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  },

  // Handle API errors
  handleError(error) {
    if (error.response) {
      // Server responded with error status
      const { status, data } = error.response;
      
      switch (status) {
        case 400:
          return new Error(data.error || 'Invalid request data');
        case 401:
          return new Error('Authentication required. Please log in again.');
        case 403:
          return new Error('You do not have permission to perform this action');
        case 404:
          return new Error(data.error || 'Resource not found');
        case 429:
          return new Error('Too many requests. Please try again later.');
        case 500:
          return new Error(data.error || 'Internal server error');
        default:
          return new Error(data.error || `Request failed with status ${status}`);
      }
    } else if (error.request) {
      // Request was made but no response received
      return new Error('No response from server. Please check your internet connection.');
    } else {
      // Something else happened
      return new Error(error.message || 'An unexpected error occurred');
    }
  }
};

// Utility functions for email automation
export const emailUtils = {
  // Validate email format
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  // Validate email automation data
  validateAutomationData(data) {
    const errors = [];

    if (!data.subject || data.subject.trim().length === 0) {
      errors.push('Email subject is required');
    }

    if (!data.body || data.body.trim().length === 0) {
      errors.push('Email body is required');
    }

    if (!data.recipients || data.recipients.length === 0) {
      errors.push('At least one recipient is required');
    } else {
      // Validate each recipient email
      data.recipients.forEach((email, index) => {
        if (!this.isValidEmail(email)) {
          errors.push(`Invalid email format for recipient ${index + 1}: ${email}`);
        }
      });
    }

    if (!data.scheduledTime) {
      errors.push('Scheduled time is required');
    } else {
      const scheduledTime = new Date(data.scheduledTime);
      const now = new Date();
      if (scheduledTime <= now) {
        errors.push('Scheduled time must be in the future');
      }
    }

    // Validate follow-up settings
    if (data.followUpEnabled) {
      if (!data.followUpMessage || data.followUpMessage.trim().length === 0) {
        errors.push('Follow-up message is required when follow-up is enabled');
      }
      if (!data.followUpDays || data.followUpDays < 1) {
        errors.push('Follow-up days must be at least 1');
      }
    }

    // Validate auto-reply settings
    if (data.autoReplyEnabled) {
      if (!data.autoReplyMessage || data.autoReplyMessage.trim().length === 0) {
        errors.push('Auto-reply message is required when auto-reply is enabled');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  },

  // Format scheduled time for display
  formatScheduledTime(dateTime) {
    const date = new Date(dateTime);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return 'Overdue';
    } else if (diffDays === 0) {
      return 'Today at ' + date.toLocaleTimeString();
    } else if (diffDays === 1) {
      return 'Tomorrow at ' + date.toLocaleTimeString();
    } else if (diffDays < 7) {
      return `In ${diffDays} days at ${date.toLocaleTimeString()}`;
    } else {
      return date.toLocaleDateString() + ' at ' + date.toLocaleTimeString();
    }
  },

  // Get status color for UI
  getStatusColor(status) {
    switch (status) {
      case 'scheduled':
        return 'primary';
      case 'sent':
        return 'success';
      case 'paused':
        return 'warning';
      case 'error':
        return 'error';
      case 'cancelled':
        return 'default';
      default:
        return 'default';
    }
  },

  // Personalize email content with variables
  personalizeContent(content, variables, recipientData = {}) {
    let personalizedContent = content;

    // Replace built-in variables
    if (variables.recipientName && recipientData.name) {
      personalizedContent = personalizedContent.replace(
        /\{\{recipientName\}\}/g, 
        recipientData.name
      );
    }

    if (variables.company && recipientData.company) {
      personalizedContent = personalizedContent.replace(
        /\{\{company\}\}/g, 
        recipientData.company
      );
    }

    // Replace custom variables
    if (variables.customFields) {
      variables.customFields.forEach(variable => {
        const regex = new RegExp(`\\{\\{${variable.key}\\}\\}`, 'g');
        personalizedContent = personalizedContent.replace(regex, variable.value);
      });
    }

    return personalizedContent;
  },

  // Generate preview of personalized email
  generatePreview(automation, recipientData = {}) {
    const preview = {
      subject: this.personalizeContent(automation.subject, automation.variables, recipientData),
      body: this.personalizeContent(automation.body, automation.variables, recipientData),
      recipients: automation.recipients,
      scheduledTime: automation.scheduledTime,
      followUpEnabled: automation.followUpEnabled,
      autoReplyEnabled: automation.autoReplyEnabled
    };

    return preview;
  }
};

export default emailAutomationService;