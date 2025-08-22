import React, { useState, useEffect, useCallback } from 'react';
import { Box, Button, Typography, CircularProgress, Alert } from '@mui/material';
import EmailComposer from './EmailComposer';
import EmailScheduleList from './EmailScheduleList';
// This now correctly uses the functions from your api.js file
import { emailAPI } from '../utils/api';

const EmailDashboard = () => {
  const [showComposer, setShowComposer] = useState(false);
  const [scheduledEmails, setScheduledEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchScheduledEmails = useCallback(async () => {
    try {
      setLoading(true);
      // This function now comes from your api.js
      const emails = await emailAPI.getScheduledEmails();
      setScheduledEmails(emails);
      setError('');
    } catch (err) {
      setError('Failed to fetch scheduled emails.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchScheduledEmails();
  }, [fetchScheduledEmails]);

  const handleScheduleEmail = async (emailData) => {
    try {
      // This function now comes from your api.js
      await emailAPI.scheduleEmail(emailData);
      setShowComposer(false); // Hide the composer form
      fetchScheduledEmails(); // Refresh the list from the database
    } catch (error) {
      console.error('Error scheduling email:', error);
      setError('Failed to schedule the email. Please try again.');
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
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      
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