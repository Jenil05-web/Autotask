import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Schedule as ScheduleIcon,
  Email as EmailIcon,
  Repeat as RepeatIcon
} from '@mui/icons-material';
import { emailAPI } from '../utils/api'; // Import the API utility

const EmailScheduleList = ({ onEdit }) => {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rescheduleDialog, setRescheduleDialog] = useState({ open: false, email: null });
  const [newScheduleTime, setNewScheduleTime] = useState('');

  useEffect(() => {
    fetchScheduledEmails();
  }, []);

  const testServerConnection = async () => {
    try {
      console.log('Testing server connection...');
      const response = await fetch('http://localhost:3000/');  // Changed from 5000 to 3000
      const data = await response.json();
      console.log('Server test response:', data);
      alert('Server is reachable: ' + data.message);
    } catch (error) {
      console.error('Server test failed:', error);
      alert('Server is NOT reachable: ' + error.message);
    }
  };

  const testAPIConnection = async () => {
    try {
      console.log('Testing API connection...');
      const response = await fetch('http://localhost:3000/api/emails/test');  // Changed from 5000 to 3000
      const data = await response.json();
      console.log('API test response:', data);
      alert('API is reachable: ' + data.message);
    } catch (error) {
      console.error('API test failed:', error);
      alert('API is NOT reachable: ' + error.message);
    }
  };
  

  const fetchScheduledEmails = async () => {
    try {
      setLoading(true);
      setError(null); // Clear previous errors
      
      console.log('Starting to fetch scheduled emails...');
      
      // Check Firebase Auth status first
      const { auth } = await import('../firebase/firebase.config.local.js');
      const currentUser = auth.currentUser;
      console.log('Current Firebase user:', currentUser);
      console.log('User authenticated:', !!currentUser);
      
      if (!currentUser) {
        throw new Error('User not authenticated. Please log in.');
      }
      
      console.log('User ID:', currentUser.uid);
      
      // Test getting the auth token
      try {
        const token = await currentUser.getIdToken();
        console.log('Auth token obtained:', !!token);
        console.log('Token first 20 chars:', token ? token.substring(0, 20) + '...' : 'No token');
      } catch (tokenError) {
        console.error('Error getting auth token:', tokenError);
      }
      
      console.log('Making API call...');
      
      // Use the emailAPI utility instead of direct fetch
      const result = await emailAPI.getScheduledEmails();
      
      console.log('API Response received:', result); // Debug log
      console.log('Response success flag:', result?.success);
      console.log('Response error:', result?.error);
      console.log('Response emails:', result?.emails);
      
      // Handle the new response format
      if (result && result.success) {
        setEmails(result.emails || []);
        console.log('Emails set successfully:', result.emails); // Debug log
      } else {
        console.log('API response was not successful:', result);
        console.log('Full API response object:', JSON.stringify(result, null, 2));
        throw new Error(result?.error || `API returned unsuccessful response. Status: ${result?.success}, Error: ${result?.error}`);
      }
    } catch (error) {
      console.error('=== FULL ERROR ANALYSIS ===');
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      console.error('Error cause:', error.cause);
      console.error('========================');
      
      // More specific error messages
      let errorMessage = 'Error fetching scheduled emails';
      if (error.message.includes('Failed to fetch')) {
        errorMessage = 'Cannot connect to server. Please check if the server is running on http://localhost:3000';  // Changed from 5000 to 3000
      } else if (error.message.includes('NetworkError')) {
        errorMessage = 'Network error. Please check your internet connection and server status';
      } else if (error.message.includes('not authenticated')) {
        errorMessage = 'Authentication required. Please log in to continue.';
      } else {
        errorMessage = `Error: ${error.message}`;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (emailId) => {
    try {
      // Use the emailAPI utility
      await emailAPI.cancelEmail(emailId);
      fetchScheduledEmails(); // Refresh the list
    } catch (error) {
      setError('Error cancelling email');
      console.error('Error:', error);
    }
  };

  const handleReschedule = async () => {
    try {
      // Use the emailAPI utility
      await emailAPI.rescheduleEmail(
        rescheduleDialog.email.id, 
        new Date(newScheduleTime).toISOString()
      );
      
      setRescheduleDialog({ open: false, email: null });
      fetchScheduledEmails(); // Refresh the list
    } catch (error) {
      setError('Error rescheduling email');
      console.error('Error:', error);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'scheduled': return 'primary';
      case 'sent': return 'success';
      case 'failed': return 'error';
      case 'cancelled': return 'default';
      default: return 'default';
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return <Typography>Loading scheduled emails...</Typography>;
  }

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Temporary debug buttons */}
      <Box sx={{ mb: 2, display: 'flex', gap: 1 }}>
        <Button variant="outlined" size="small" onClick={testServerConnection}>
          Test Server
        </Button>
        <Button variant="outlined" size="small" onClick={testAPIConnection}>
          Test API
        </Button>
      </Box>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Scheduled Emails
          </Typography>
          
          {emails.length === 0 ? (
            <Typography color="text.secondary">
              No scheduled emails found.
            </Typography>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Subject</TableCell>
                    <TableCell>Recipients</TableCell>
                    <TableCell>Scheduled For</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {emails.map((email) => (
                    <TableRow key={email.id}>
                      <TableCell>
                        <Typography variant="body2" noWrap>
                          {email.subject}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box>
                          {email.recipients?.slice(0, 2).map((recipient, index) => (
                            <Chip
                              key={index}
                              label={recipient}
                              size="small"
                              sx={{ mr: 0.5, mb: 0.5 }}
                            />
                          ))}
                          {email.recipients?.length > 2 && (
                            <Chip
                              label={`+${email.recipients.length - 2} more`}
                              size="small"
                              variant="outlined"
                            />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {formatDate(email.scheduledFor)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={email.status}
                          color={getStatusColor(email.status)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          {email.recurring && (
                            <Chip
                              icon={<RepeatIcon />}
                              label="Recurring"
                              size="small"
                              variant="outlined"
                            />
                          )}
                          <Chip
                            icon={<EmailIcon />}
                            label="Email"
                            size="small"
                            variant="outlined"
                          />
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          {email.status === 'scheduled' && (
                            <>
                              <IconButton
                                size="small"
                                onClick={() => {
                                  setRescheduleDialog({ open: true, email });
                                  setNewScheduleTime(email.scheduledFor.substring(0, 16));
                                }}
                                title="Reschedule"
                              >
                                <ScheduleIcon />
                              </IconButton>
                              <IconButton
                                size="small"
                                onClick={() => onEdit && onEdit(email)}
                                title="Edit"
                              >
                                <EditIcon />
                              </IconButton>
                              <IconButton
                                size="small"
                                onClick={() => handleCancel(email.id)}
                                title="Cancel"
                                color="error"
                              >
                                <DeleteIcon />
                              </IconButton>
                            </>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Reschedule Dialog */}
      <Dialog open={rescheduleDialog.open} onClose={() => setRescheduleDialog({ open: false, email: null })}>
        <DialogTitle>Reschedule Email</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <TextField
              fullWidth
              type="datetime-local"
              label="New Schedule Time"
              value={newScheduleTime}
              onChange={(e) => setNewScheduleTime(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRescheduleDialog({ open: false, email: null })}>
            Cancel
          </Button>
          <Button onClick={handleReschedule} variant="contained">
            Reschedule
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default EmailScheduleList;