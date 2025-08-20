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
  Tab,
  Badge
} from '@mui/material';
import {
  Schedule as ScheduleIcon,
  Send as SendIcon,
  Reply as ReplyIcon,
  TrendingUp as TrendingUpIcon,
  Add as AddIcon
} from '@mui/icons-material';
import EmailComposer from './EmailComposer';
import EmailScheduleList from './EmailScheduleList';

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
      const response = await fetch('/api/emails/activity');
      const result = await response.json();
      
      if (result.success) {
        setActivity(result.activity);
      } else {
        setError('Failed to fetch email activity');
      }
    } catch (error) {
      setError('Error fetching email activity');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleScheduleEmail = async (emailData) => {
    try {
      setLoading(true);
      const response = await fetch('/api/emails/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailData)
      });

      const result = await response.json();
      
      if (result.success) {
        setSuccess('Email scheduled successfully!');
        setShowComposer(false);
        fetchEmailActivity();
      } else {
        setError(result.error || 'Failed to schedule email');
      }
    } catch (error) {
      setError('Error scheduling email');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const ActivityCard = ({ title, value, icon, color = 'primary' }) => (
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
          <Box sx={{ color: `${color}.main`, fontSize: 40 }}>
            {icon}
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
          startIcon={<AddIcon />}
          onClick={() => setShowComposer(true)}
          sx={{ backgroundColor: '#4CAF50' }}
        >
          Schedule New Email
        </Button>
      </Box>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <ActivityCard
            title="Scheduled"
            value={activity?.scheduled}
            icon={<ScheduleIcon sx={{ fontSize: 40 }} />}
            color="primary"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <ActivityCard
            title="Sent"
            value={activity?.sent}
            icon={<SendIcon sx={{ fontSize: 40 }} />}
            color="success"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <ActivityCard
            title="Follow-ups Pending"
            value={activity?.followUpsPending}
            icon={<ReplyIcon sx={{ fontSize: 40 }} />}
            color="warning"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <ActivityCard
            title="Failed"
            value={activity?.failed}
            icon={<TrendingUpIcon sx={{ fontSize: 40 }} />}
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
              <EmailScheduleList onEdit={(email) => console.log('Edit email:', email)} />
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