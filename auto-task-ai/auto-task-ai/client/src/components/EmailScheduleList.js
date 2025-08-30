import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  IconButton,
  Chip,
  Grid,
  Tooltip,
  Avatar,
  Collapse,
  Divider,
  LinearProgress,
  Badge,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  TextField,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Edit as EditIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Email as EmailIcon,
  Schedule as ScheduleIcon,
  Repeat as RepeatIcon,
  Person as PersonIcon,
  CalendarToday as CalendarIcon,
  AccessTime as TimeIcon,
  Send as SendIcon,
  Reply as ReplyIcon,
  Cancel as CancelIcon,
  Pause as PauseIcon
} from '@mui/icons-material';
import { emailAPI } from '../utils/api';

const EmailScheduleList = ({ emails, onDelete, getStatusColor, getStatusIcon, onRefresh }) => {
  const [expandedCards, setExpandedCards] = useState(new Set());
  const [rescheduleDialog, setRescheduleDialog] = useState({ open: false, email: null });
  const [newScheduleTime, setNewScheduleTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const toggleExpand = (emailId) => {
    const newExpanded = new Set(expandedCards);
    if (newExpanded.has(emailId)) {
      newExpanded.delete(emailId);
    } else {
      newExpanded.add(emailId);
    }
    setExpandedCards(newExpanded);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatRecurring = (recurring) => {
    if (!recurring?.enabled) return 'One-time';
    
    let text = recurring.type.charAt(0).toUpperCase() + recurring.type.slice(1);
    if (recurring.type === 'weekly' && recurring.selectedDays?.length > 0) {
      const days = recurring.selectedDays.map(day => 
        day.charAt(0).toUpperCase() + day.slice(1, 3)
      ).join(', ');
      text += ` (${days})`;
    }
    return text;
  };

  const getRecurringChipColor = (recurring) => {
    if (!recurring?.enabled) return 'default';
    switch (recurring.type) {
      case 'daily': return 'success';
      case 'weekly': return 'primary';
      case 'monthly': return 'secondary';
      default: return 'default';
    }
  };

  const truncateText = (text, maxLength = 100) => {
    if (!text) return '';
    return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
  };

  const handleRescheduleClick = (email) => {
    setRescheduleDialog({ open: true, email });
    setNewScheduleTime(email.scheduledFor ? email.scheduledFor.substring(0, 16) : '');
  };

  const handleRescheduleConfirm = async () => {
    if (!rescheduleDialog.email || !newScheduleTime) return;
    
    try {
      setLoading(true);
      setError('');
      
      await emailAPI.rescheduleEmail(
        rescheduleDialog.email.id, 
        new Date(newScheduleTime).toISOString()
      );
      
      setRescheduleDialog({ open: false, email: null });
      setNewScheduleTime('');
      
      // Refresh the list
      if (onRefresh) {
        onRefresh();
      }
      
    } catch (error) {
      console.error('Error rescheduling email:', error);
      setError('Failed to reschedule email');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (email) => {
    try {
      setLoading(true);
      setError('');
      
      // Use the cancel API instead of delete
      await emailAPI.cancelEmail(email.id);
      
      // Refresh the list
      if (onRefresh) {
        onRefresh();
      }
      
    } catch (error) {
      console.error('Error cancelling email:', error);
      setError('Failed to cancel email');
    } finally {
      setLoading(false);
    }
  };

  // Test functions for debugging
  const testServerConnection = async () => {
    try {
      console.log('Testing server connection...');
      const response = await fetch('http://localhost:3000/');
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
      const response = await fetch('http://localhost:3000/api/emails/test');
      const data = await response.json();
      console.log('API test response:', data);
      alert('API is reachable: ' + data.message);
    } catch (error) {
      console.error('API test failed:', error);
      alert('API is NOT reachable: ' + error.message);
    }
  };

  if (!emails || emails.length === 0) {
    return (
      <Box>
        {/* Debug buttons - remove these in production */}
        <Box sx={{ mb: 2, display: 'flex', gap: 1 }}>
          <Button variant="outlined" size="small" onClick={testServerConnection}>
            Test Server
          </Button>
          <Button variant="outlined" size="small" onClick={testAPIConnection}>
            Test API
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        <Box 
          sx={{ 
            textAlign: 'center', 
            py: 8,
            backgroundColor: '#f8f9fa',
            borderRadius: 2,
            border: '2px dashed #ddd'
          }}
        >
          <EmailIcon sx={{ fontSize: 80, color: '#ccc', mb: 2 }} />
          <Typography variant="h6" color="textSecondary" gutterBottom>
            No scheduled emails yet
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Create your first email automation to get started!
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box>
      {/* Debug buttons - remove these in production */}
      <Box sx={{ mb: 2, display: 'flex', gap: 1 }}>
        <Button variant="outlined" size="small" onClick={testServerConnection}>
          Test Server
        </Button>
        <Button variant="outlined" size="small" onClick={testAPIConnection}>
          Test API
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {emails.map((email) => {
          const isExpanded = expandedCards.has(email.id);
          const progress = email.totalSent > 0 ? Math.min((email.totalSent / 10) * 100, 100) : 0;
          
          return (
            <Grid item xs={12} key={email.id}>
              <Card 
                sx={{ 
                  borderRadius: 2,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  border: `2px solid transparent`,
                  '&:hover': {
                    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                    borderColor: getStatusColor(email.status),
                    transform: 'translateY(-2px)'
                  },
                  transition: 'all 0.3s ease',
                  overflow: 'visible'
                }}
              >
                <CardContent sx={{ p: 3 }}>
                  {/* Header Row */}
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
                      <Avatar 
                        sx={{ 
                          backgroundColor: getStatusColor(email.status),
                          width: 48,
                          height: 48
                        }}
                      >
                        {getStatusIcon(email.status)}
                      </Avatar>
                      
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                          {truncateText(email.subject, 60)}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                          <Chip
                            label={email.status}
                            size="small"
                            sx={{
                              backgroundColor: getStatusColor(email.status),
                              color: 'white',
                              fontWeight: 600,
                              fontSize: '0.75rem'
                            }}
                          />
                          <Chip
                            icon={<RepeatIcon sx={{ fontSize: 16 }} />}
                            label={formatRecurring(email.recurring)}
                            size="small"
                            color={getRecurringChipColor(email.recurring)}
                            variant="outlined"
                          />
                          {email.totalSent > 0 && (
                            <Badge badgeContent={email.totalSent} color="primary" max={99}>
                              <Chip
                                icon={<SendIcon sx={{ fontSize: 14 }} />}
                                label="Sent"
                                size="small"
                                color="success"
                                variant="outlined"
                              />
                            </Badge>
                          )}
                          {email.autoReply?.enabled && (
                            <Chip
                              icon={<ReplyIcon sx={{ fontSize: 14 }} />}
                              label="Auto-reply"
                              size="small"
                              color="info"
                              variant="outlined"
                            />
                          )}
                        </Box>
                      </Box>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Tooltip title={isExpanded ? "Show less" : "Show more"}>
                        <IconButton onClick={() => toggleExpand(email.id)}>
                          {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </IconButton>
                      </Tooltip>

                      {/* Action buttons based on status */}
                      {email.status === 'scheduled' && (
                        <>
                          <Tooltip title="Reschedule">
                            <IconButton 
                              color="primary"
                              onClick={() => handleRescheduleClick(email)}
                              sx={{ '&:hover': { backgroundColor: 'rgba(76, 175, 80, 0.1)' } }}
                            >
                              <ScheduleIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Cancel">
                            <IconButton 
                              color="warning"
                              onClick={() => handleCancel(email)}
                              sx={{ '&:hover': { backgroundColor: 'rgba(255, 152, 0, 0.1)' } }}
                            >
                              <CancelIcon />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}

                      <Tooltip title="Edit email">
                        <IconButton 
                          color="primary"
                          sx={{ '&:hover': { backgroundColor: 'rgba(76, 175, 80, 0.1)' } }}
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      
                      <Tooltip title="Delete email">
                        <IconButton 
                          color="error" 
                          onClick={() => onDelete(email)}
                          sx={{ '&:hover': { backgroundColor: 'rgba(244, 67, 54, 0.1)' } }}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>

                  {/* Progress Bar for Sent Emails */}
                  {email.totalSent > 0 && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="caption" color="textSecondary" sx={{ mb: 1, display: 'block' }}>
                        Emails sent: {email.totalSent}
                      </Typography>
                      <LinearProgress 
                        variant="determinate" 
                        value={progress} 
                        sx={{
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: '#e0e0e0',
                          '& .MuiLinearProgress-bar': {
                            backgroundColor: getStatusColor(email.status),
                            borderRadius: 3
                          }
                        }}
                      />
                    </Box>
                  )}

                  {/* Basic Info Row */}
                  <Grid container spacing={2} sx={{ mb: 2 }}>
                    <Grid item xs={12} sm={6}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <PersonIcon sx={{ fontSize: 16, color: '#666' }} />
                        <Typography variant="body2" color="textSecondary">
                          <strong>To:</strong> {Array.isArray(email.recipients) 
                            ? truncateText(email.recipients.join(', '), 40)
                            : truncateText(email.recipients, 40)}
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CalendarIcon sx={{ fontSize: 16, color: '#666' }} />
                        <Typography variant="body2" color="textSecondary">
                          <strong>Scheduled:</strong> {formatDate(email.scheduledFor)}
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>

                  {/* Expandable Content */}
                  <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                    <Divider sx={{ my: 2 }} />
                    
                    <Grid container spacing={3}>
                      {/* Email Details */}
                      <Grid item xs={12} md={8}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: '#4CAF50' }}>
                          Email Content
                        </Typography>
                        <Box sx={{ backgroundColor: '#f8f9fa', p: 2, borderRadius: 1, mb: 2 }}>
                          <Typography variant="body2" sx={{ mb: 1 }}>
                            <strong>From:</strong> {email.from}
                          </Typography>
                          {email.cc && email.cc.length > 0 && (
                            <Typography variant="body2" sx={{ mb: 1 }}>
                              <strong>CC:</strong> {Array.isArray(email.cc) ? email.cc.join(', ') : email.cc}
                            </Typography>
                          )}
                          {email.bcc && email.bcc.length > 0 && (
                            <Typography variant="body2" sx={{ mb: 1 }}>
                              <strong>BCC:</strong> {Array.isArray(email.bcc) ? email.bcc.join(', ') : email.bcc}
                            </Typography>
                          )}
                          <Typography variant="body2" sx={{ mt: 2 }}>
                            <strong>Message Preview:</strong>
                          </Typography>
                          <Typography variant="body2" sx={{ 
                            mt: 1, 
                            p: 1, 
                            backgroundColor: 'white', 
                            borderRadius: 1,
                            maxHeight: 100,
                            overflow: 'auto',
                            fontSize: '0.85rem',
                            lineHeight: 1.4
                          }}>
                            {truncateText(email.body, 300)}
                          </Typography>
                        </Box>
                      </Grid>

                      {/* Schedule & Settings */}
                      <Grid item xs={12} md={4}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: '#4CAF50' }}>
                          Schedule Settings
                        </Typography>
                        <Box sx={{ backgroundColor: '#f8f9fa', p: 2, borderRadius: 1 }}>
                          {email.recurring?.enabled && (
                            <>
                              <Typography variant="body2" sx={{ mb: 1 }}>
                                <strong>Frequency:</strong> {formatRecurring(email.recurring)}
                              </Typography>
                              <Typography variant="body2" sx={{ mb: 1 }}>
                                <strong>Time:</strong> {String(email.recurring.hour || 9).padStart(2, '0')}:
                                {String(email.recurring.minute || 0).padStart(2, '0')}
                              </Typography>
                            </>
                          )}
                          
                          {email.lastSent && (
                            <Typography variant="body2" sx={{ mb: 1 }}>
                              <strong>Last Sent:</strong> {formatDate(email.lastSent)}
                            </Typography>
                          )}
                          
                          {email.nextScheduledRun && email.status === 'scheduled' && (
                            <Typography variant="body2" sx={{ mb: 1 }}>
                              <strong>Next Run:</strong> {formatDate(email.nextScheduledRun)}
                            </Typography>
                          )}

                          <Typography variant="body2" sx={{ mb: 1 }}>
                            <strong>Created:</strong> {formatDate(email.createdAt)}
                          </Typography>

                          {/* Auto-reply info */}
                          {email.autoReply?.enabled && (
                            <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #ddd' }}>
                              <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
                                Auto-reply Settings:
                              </Typography>
                              <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                                Type: {email.autoReply.replyType || 'standard'}
                              </Typography>
                              {email.autoReply.useAI && (
                                <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                                  AI Tone: {email.autoReply.aiTone || 'professional'}
                                </Typography>
                              )}
                            </Box>
                          )}

                          {/* Follow-up info */}
                          {email.followUp?.enabled && (
                            <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #ddd' }}>
                              <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
                                Follow-up Settings:
                              </Typography>
                              <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                                After {email.followUp.daysAfter} days
                              </Typography>
                            </Box>
                          )}
                        </Box>
                      </Grid>
                    </Grid>

                    {/* Error Information */}
                    {email.status === 'failed' && email.lastError && (
                      <Box sx={{ mt: 2, p: 2, backgroundColor: '#ffebee', borderRadius: 1, border: '1px solid #ffcdd2' }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#d32f2f', mb: 1 }}>
                          Error Details:
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#d32f2f', fontSize: '0.85rem' }}>
                          {email.lastError}
                        </Typography>
                        {email.lastFailedAt && (
                          <Typography variant="caption" sx={{ color: '#666', display: 'block', mt: 1 }}>
                            Failed at: {formatDate(email.lastFailedAt)}
                          </Typography>
                        )}
                      </Box>
                    )}
                  </Collapse>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* Reschedule Dialog */}
      <Dialog 
        open={rescheduleDialog.open} 
        onClose={() => setRescheduleDialog({ open: false, email: null })}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          alignItems: 'center',
          gap: 2,
          color: '#4CAF50',
          fontWeight: 600
        }}>
          <ScheduleIcon />
          Reschedule Email
        </DialogTitle>
        <DialogContent>
          {rescheduleDialog.email && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                Email: {rescheduleDialog.email.subject}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Current schedule: {formatDate(rescheduleDialog.email.scheduledFor)}
              </Typography>
            </Box>
          )}
          <TextField
            fullWidth
            type="datetime-local"
            label="New Schedule Time"
            value={newScheduleTime}
            onChange={(e) => setNewScheduleTime(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 1 }}>
          <Button 
            onClick={() => setRescheduleDialog({ open: false, email: null })}
            variant="outlined"
            sx={{ borderRadius: 2 }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleRescheduleConfirm} 
            variant="contained"
            disabled={loading || !newScheduleTime}
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <ScheduleIcon />}
            sx={{ 
              borderRadius: 2, 
              minWidth: 120,
              backgroundColor: '#4CAF50',
              '&:hover': { backgroundColor: '#45a049' }
            }}
          >
            {loading ? 'Rescheduling...' : 'Reschedule'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default EmailScheduleList;