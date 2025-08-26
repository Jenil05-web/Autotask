import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  Typography,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Card,
  CardContent,
  Fab,
  Snackbar,
  Chip,
  Grid,
  Paper,
  IconButton,
  Tooltip,
  Divider
} from '@mui/material';
import {
  Add as AddIcon,
  Email as EmailIcon,
  Schedule as ScheduleIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Refresh as RefreshIcon,
  Dashboard as DashboardIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Pause as PauseIcon
} from '@mui/icons-material';
import EmailComposer from './EmailComposer';
import EmailScheduleList from './EmailScheduleList';
import { emailAPI } from '../utils/api';

const EmailDashboard = () => {
  const [showComposer, setShowComposer] = useState(false);
  const [scheduledEmails, setScheduledEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [emailToDelete, setEmailToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [stats, setStats] = useState({ total: 0, active: 0, sent: 0, failed: 0 });

  const fetchScheduledEmails = useCallback(async () => {
  try {
    setLoading(true);
    setError('');
    
    const emails = await emailAPI.getScheduledEmails();
    
    // Ensure emails is always an array
    const emailsArray = Array.isArray(emails) ? emails : [];
    setScheduledEmails(emailsArray);
    
    // Calculate stats
    const stats = {
      total: emailsArray.length,
      active: emailsArray.filter(e => e.status === 'scheduled').length,
      sent: emailsArray.filter(e => e.status === 'sent' || e.totalSent > 0).length,
      failed: emailsArray.filter(e => e.status === 'failed').length
    };
    setStats(stats);
    
  } catch (err) {
    console.error('Error in fetchScheduledEmails:', err);
    setError('Failed to load the list of scheduled emails.');
    setScheduledEmails([]); // Ensure it's always an array even on error
    setStats({ total: 0, active: 0, sent: 0, failed: 0 });
    showSnackbar('Failed to load scheduled emails', 'error');
  } finally {
    setLoading(false);
  }
}, []);

  useEffect(() => {
    fetchScheduledEmails();
  }, [fetchScheduledEmails]);

  const handleScheduleEmail = async (emailData) => {
    try {
      setError('');
      await emailAPI.scheduleEmail(emailData);
      setShowComposer(false);
      fetchScheduledEmails();
      showSnackbar('Email scheduled successfully!', 'success');
    } catch (err) {
      console.error('Error in handleScheduleEmail:', err);
      setError('Failed to schedule the email. Please check the details and try again.');
      showSnackbar('Failed to schedule email', 'error');
    }
  };

  const handleDeleteClick = (email) => {
    setEmailToDelete(email);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!emailToDelete) return;
    
    try {
      setDeleting(true);
      await emailAPI.deleteScheduledEmail(emailToDelete.id);
      setDeleteConfirmOpen(false);
      setEmailToDelete(null);
      fetchScheduledEmails();
      showSnackbar('Email deleted successfully!', 'success');
    } catch (err) {
      console.error('Error deleting email:', err);
      showSnackbar('Failed to delete email', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirmOpen(false);
    setEmailToDelete(null);
  };

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleSnackbarClose = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'scheduled': return '#4CAF50';
      case 'sent': return '#2196F3';
      case 'failed': return '#f44336';
      case 'cancelled': return '#ff9800';
      default: return '#757575';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'scheduled': return <ScheduleIcon />;
      case 'sent': return <CheckCircleIcon />;
      case 'failed': return <ErrorIcon />;
      case 'cancelled': return <PauseIcon />;
      default: return <EmailIcon />;
    }
  };

  if (loading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center',
        minHeight: '60vh',
        gap: 2
      }}>
        <CircularProgress size={60} sx={{ color: '#4CAF50' }} />
        <Typography variant="h6" color="textSecondary">
          Loading your scheduled emails...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
      {/* Header Section */}
      <Paper 
        elevation={2} 
        sx={{ 
          p: 3, 
          mb: 3, 
          background: 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)',
          color: 'white',
          borderRadius: 2
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <DashboardIcon sx={{ fontSize: 40, mr: 2 }} />
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
                Email Automation Dashboard
              </Typography>
              <Typography variant="subtitle1" sx={{ opacity: 0.9 }}>
                Manage your scheduled emails and automations
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Refresh">
              <IconButton 
                onClick={fetchScheduledEmails} 
                sx={{ color: 'white', backgroundColor: 'rgba(255,255,255,0.2)' }}
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Paper>

      {/* Error Alert */}
      {error && (
        <Alert 
          severity="error" 
          onClose={() => setError('')} 
          sx={{ mb: 3, borderRadius: 2 }}
        >
          {error}
        </Alert>
      )}

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ 
            background: 'linear-gradient(135deg, #2196F3 0%, #1976D2 100%)',
            color: 'white',
            borderRadius: 2
          }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 600 }}>
                    {stats.total}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    Total Emails
                  </Typography>
                </Box>
                <EmailIcon sx={{ fontSize: 40, opacity: 0.8 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ 
            background: 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)',
            color: 'white',
            borderRadius: 2
          }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 600 }}>
                    {stats.active}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    Active
                  </Typography>
                </Box>
                <ScheduleIcon sx={{ fontSize: 40, opacity: 0.8 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ 
            background: 'linear-gradient(135deg, #FF9800 0%, #F57C00 100%)',
            color: 'white',
            borderRadius: 2
          }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 600 }}>
                    {stats.sent}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    Sent
                  </Typography>
                </Box>
                <CheckCircleIcon sx={{ fontSize: 40, opacity: 0.8 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ 
            background: 'linear-gradient(135deg, #f44336 0%, #d32f2f 100%)',
            color: 'white',
            borderRadius: 2
          }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 600 }}>
                    {stats.failed}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    Failed
                  </Typography>
                </Box>
                <ErrorIcon sx={{ fontSize: 40, opacity: 0.8 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Main Content */}
      {showComposer ? (
        <EmailComposer 
          onSchedule={handleScheduleEmail} 
          onCancel={() => setShowComposer(false)} 
        />
      ) : (
        <Paper sx={{ p: 3, borderRadius: 2, boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h5" sx={{ fontWeight: 600, color: '#333' }}>
              Scheduled Emails
            </Typography>
            <Button 
              variant="contained" 
              startIcon={<AddIcon />}
              onClick={() => setShowComposer(true)}
              sx={{ 
                backgroundColor: '#4CAF50',
                '&:hover': { backgroundColor: '#45a049' },
                borderRadius: 2,
                px: 3,
                py: 1.5,
                fontWeight: 600
              }}
            >
              Create Email Automation
            </Button>
          </Box>
          
          <Divider sx={{ mb: 3 }} />
          
          <EmailScheduleList 
            emails={scheduledEmails} 
            onDelete={handleDeleteClick}
            getStatusColor={getStatusColor}
            getStatusIcon={getStatusIcon}
          />
        </Paper>
      )}

      {/* Floating Action Button - Alternative way to create emails */}
      {!showComposer && (
        <Fab 
          color="primary" 
          onClick={() => setShowComposer(true)}
          sx={{ 
            position: 'fixed', 
            bottom: 24, 
            right: 24,
            backgroundColor: '#4CAF50',
            '&:hover': { backgroundColor: '#45a049' }
          }}
        >
          <AddIcon />
        </Fab>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog 
        open={deleteConfirmOpen} 
        onClose={handleDeleteCancel}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 2 }
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          alignItems: 'center',
          gap: 2,
          color: '#f44336',
          fontWeight: 600
        }}>
          <DeleteIcon />
          Confirm Delete
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontSize: '1.1rem', lineHeight: 1.6 }}>
            Are you sure you want to delete this scheduled email?
            {emailToDelete && (
              <Box sx={{ mt: 2, p: 2, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                  Email Details:
                </Typography>
                <Typography variant="body2">
                  <strong>Subject:</strong> {emailToDelete.subject}
                </Typography>
                <Typography variant="body2">
                  <strong>Recipients:</strong> {Array.isArray(emailToDelete.recipients) 
                    ? emailToDelete.recipients.join(', ') 
                    : emailToDelete.recipients}
                </Typography>
                <Typography variant="body2">
                  <strong>Status:</strong> 
                  <Chip 
                    label={emailToDelete.status} 
                    size="small" 
                    sx={{ 
                      ml: 1,
                      backgroundColor: getStatusColor(emailToDelete.status),
                      color: 'white'
                    }} 
                  />
                </Typography>
              </Box>
            )}
            <Typography sx={{ mt: 2, fontWeight: 600, color: '#f44336' }}>
              This action cannot be undone. The email will be permanently removed from your account and any active schedules will be cancelled.
            </Typography>
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 1 }}>
          <Button 
            onClick={handleDeleteCancel}
            variant="outlined"
            sx={{ borderRadius: 2 }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleDeleteConfirm} 
            variant="contained"
            color="error"
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={16} color="inherit" /> : <DeleteIcon />}
            sx={{ borderRadius: 2, minWidth: 120 }}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Success/Error Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Alert 
          onClose={handleSnackbarClose} 
          severity={snackbar.severity}
          sx={{ borderRadius: 2 }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default EmailDashboard;