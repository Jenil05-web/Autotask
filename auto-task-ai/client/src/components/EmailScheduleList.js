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

const EmailScheduleList = ({ onEdit }) => {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rescheduleDialog, setRescheduleDialog] = useState({ open: false, email: null });
  const [newScheduleTime, setNewScheduleTime] = useState('');

  useEffect(() => {
    fetchScheduledEmails();
  }, []);

  const fetchScheduledEmails = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/emails/scheduled');
      const result = await response.json();
      
      if (result.success) {
        setEmails(result.emails);
      } else {
        setError('Failed to fetch scheduled emails');
      }
    } catch (error) {
      setError('Error fetching scheduled emails');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (emailId) => {
    try {
      const response = await fetch(`/api/emails/scheduled/${emailId}`, {
        method: 'DELETE'
      });
      
      const result = await response.json();
      if (result.success) {
        fetchScheduledEmails();
      } else {
        setError('Failed to cancel email');
      }
    } catch (error) {
      setError('Error cancelling email');
      console.error('Error:', error);
    }
  };

  const handleReschedule = async () => {
    try {
      const response = await fetch(`/api/emails/scheduled/${rescheduleDialog.email.id}/reschedule`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledFor: new Date(newScheduleTime).toISOString() })
      });
      
      const result = await response.json();
      if (result.success) {
        setRescheduleDialog({ open: false, email: null });
        fetchScheduledEmails();
      } else {
        setError('Failed to reschedule email');
      }
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
                          {email.recipients.slice(0, 2).map((recipient, index) => (
                            <Chip
                              key={index}
                              label={recipient}
                              size="small"
                              sx={{ mr: 0.5, mb: 0.5 }}
                            />
                          ))}
                          {email.recipients.length > 2 && (
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