import React, { useState, useEffect, useCallback } from 'react';
import { Box, Button, Typography, CircularProgress, Alert } from '@mui/material';
import EmailComposer from './EmailComposer';
import EmailScheduleList from './EmailScheduleList';
import { emailAPI } from '../utils/api';

const EmailDashboard = () => {
  const [showComposer, setShowComposer] = useState(false);
  const [scheduledEmails, setScheduledEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(''); // Manages the error message

  const fetchScheduledEmails = useCallback(async () => {
    try {
      setLoading(true);
      // --- THIS IS THE FIX ---
      // Clear any previous errors right before making a new request.
      setError(''); 
      
      const emails = await emailAPI.getScheduledEmails();
      setScheduledEmails(emails);
    } catch (err) {
      console.error('Error in fetchScheduledEmails:', err);
      setError('Failed to load the list of scheduled emails.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchScheduledEmails();
  }, [fetchScheduledEmails]);

  const handleScheduleEmail = async (emailData) => {
    try {
      // Also clear errors before attempting to schedule
      setError(''); 
      await emailAPI.scheduleEmail(emailData);
      setShowComposer(false); // Hide the form on success
      fetchScheduledEmails(); // Refresh the list from the database
    } catch (err) {
      console.error('Error in handleScheduleEmail:', err);
      setError('Failed to schedule the email. Please check the details and try again.');
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* This Alert will now correctly disappear when there is no error */}
      {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}
      
      {showComposer ? (
        <EmailComposer onSchedule={handleScheduleEmail} onCancel={() => setShowComposer(false)} />
      ) : (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h4">Scheduled Emails</Typography>
          <Button variant="contained" onClick={() => setShowComposer(true)}>
            Create Email Automation
          </Button>
        </Box>
      )}

      {!showComposer && <EmailScheduleList emails={scheduledEmails} />}
    </Box>
  );
};

export default EmailDashboard;