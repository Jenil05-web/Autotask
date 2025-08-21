import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  LinearProgress,
  Alert,
  Tabs,
  Tab
} from '@mui/material';
import EmailComposer from './EmailComposer';
import { emailAPI } from '../utils/api';

const EmailDashboard = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [showComposer, setShowComposer] = useState(false);
  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    fetchEmailActivity();
  }, []);

  const fetchEmailActivity = async () => {
    try {
      const result = await emailAPI.getActivity();
      setActivity(result.activity);
    } catch (error) {
      setError('Error fetching email activity: ' + error.message);
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleScheduleEmail = async (emailData) => {
    try {
      setLoading(true);
      const result = await emailAPI.scheduleEmail(emailData);
      
      setSuccess('Email scheduled successfully!');
      setShowComposer(false);
      fetchEmailActivity();
    } catch (error) {
      setError('Error scheduling email: ' + error.message);
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const ActivityCard = ({ title, value, color = 'primary' }) => (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography color="text.secondary" gutterBottom variant="h6">
              {title}
            </Typography>
            <Typography variant="h4" component="div">
              {value || 0}
            </Typography>
          </Box>
          <Box sx={{ 
            color: `${color}.main`, 
            fontSize: '2rem',
            fontWeight: 'bold'
          }}>
            📊
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  if (showComposer) {
    return (
      <EmailComposer
        onSchedule={handleScheduleEmail}
        onCancel={() => setShowComposer(false)}
      />
    );
  }

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Email Automation
        </Typography>
        <Button
          variant="contained"
          onClick={() => setShowComposer(true)}
          sx={{ backgroundColor: '#4CAF50' }}
        >
          + Schedule New Email
        </Button>
      </Box>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <ActivityCard
            title="Scheduled"
            value={activity?.scheduled}
            color="primary"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <ActivityCard
            title="Sent"
            value={activity?.sent}
            color="success"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <ActivityCard
            title="Follow-ups Pending"
            value={activity?.followUpsPending}
            color="warning"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <ActivityCard
            title="Failed"
            value={activity?.failed}
            color="error"
          />
        </Grid>
      </Grid>

      <Card>
        <CardContent>
          <Tabs
            value={activeTab}
            onChange={(e, newValue) => setActiveTab(newValue)}
            sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}
          >
            <Tab label="Scheduled" />
            <Tab label="Sent" />
            <Tab label="Follow-ups" />
          </Tabs>

          <Box>
            {activeTab === 0 && (
              <Box>
                <Typography variant="h6" gutterBottom>
                  Scheduled Emails
                </Typography>
                <Typography color="text.secondary">
                  Your scheduled emails will appear here. Click "Schedule New Email" to get started.
                </Typography>
              </Box>
            )}
            {activeTab === 1 && (
              <Typography color="text.secondary">
                Sent emails history will be displayed here.
              </Typography>
            )}
            {activeTab === 2 && (
              <Typography color="text.secondary">
                Follow-up tracking will be displayed here.
              </Typography>
            )}
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default EmailDashboard;