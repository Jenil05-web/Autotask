import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Grid,
  Chip,
  Divider,
  Alert,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  CircularProgress
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { Add as AddIcon, Delete as DeleteIcon, Schedule as ScheduleIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { emailAutomationService, emailUtils } from '../services/emailAutomationService';

const EmailAutomation = () => {
  const [emailData, setEmailData] = useState({
    subject: '',
    body: '',
    recipients: [],
    cc: [],
    bcc: [],
    scheduledTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
    isRecurring: false,
    recurrenceType: 'daily',
    customRecurrence: '',
    followUpEnabled: false,
    followUpDays: 3,
    followUpMessage: '',
    autoReplyEnabled: false,
    autoReplyMessage: '',
    personalizationEnabled: true,
    variables: {
      recipientName: true,
      company: true,
      customFields: []
    }
  });

  const [newRecipient, setNewRecipient] = useState('');
  const [newVariable, setNewVariable] = useState({ key: '', value: '' });
  const [previewDialog, setPreviewDialog] = useState(false);
  const [savedAutomations, setSavedAutomations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);

  // Load existing automations on component mount
  useEffect(() => {
    loadAutomations();
  }, []);

  const loadAutomations = async () => {
    try {
      setLoading(true);
      const response = await emailAutomationService.getAutomations();
      setSavedAutomations(response.automations || []);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setEmailData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const addRecipient = (type) => {
    if (newRecipient.trim() && emailUtils.isValidEmail(newRecipient.trim())) {
      setEmailData(prev => ({
        ...prev,
        [type]: [...prev[type], newRecipient.trim()]
      }));
      setNewRecipient('');
    } else if (newRecipient.trim()) {
      setError('Please enter a valid email address');
    }
  };

  const removeRecipient = (type, index) => {
    setEmailData(prev => ({
      ...prev,
      [type]: prev[type].filter((_, i) => i !== index)
    }));
  };

  const addCustomVariable = () => {
    if (newVariable.key && newVariable.value) {
      setEmailData(prev => ({
        ...prev,
        variables: {
          ...prev.variables,
          customFields: [...prev.variables.customFields, { ...newVariable }]
        }
      }));
      setNewVariable({ key: '', value: '' });
    }
  };

  const removeCustomVariable = (index) => {
    setEmailData(prev => ({
      ...prev,
      variables: {
        ...prev.variables,
        customFields: prev.variables.customFields.filter((_, i) => i !== index)
      }
    }));
  };

  const generateAIFollowUp = async () => {
    if (!emailData.body.trim()) {
      setError('Please write the email body first to generate a follow-up message');
      return;
    }

    try {
      setAiGenerating(true);
      const response = await emailAutomationService.generateAutoReply(
        emailData.body,
        'Follow-up reminder',
        'friendly'
      );
      
      setEmailData(prev => ({
        ...prev,
        followUpMessage: response.autoReply
      }));
      setSuccess('AI-generated follow-up message created successfully!');
    } catch (error) {
      setError(error.message);
    } finally {
      setAiGenerating(false);
    }
  };

  const generateAIAutoReply = async () => {
    if (!emailData.body.trim()) {
      setError('Please write the email body first to generate an auto-reply message');
      return;
    }

    try {
      setAiGenerating(true);
      const response = await emailAutomationService.generateAutoReply(
        emailData.body,
        'Auto-reply response',
        'professional'
      );
      
      setEmailData(prev => ({
        ...prev,
        autoReplyMessage: response.autoReply
      }));
      setSuccess('AI-generated auto-reply message created successfully!');
    } catch (error) {
      setError(error.message);
    } finally {
      setAiGenerating(false);
    }
  };

  const saveAutomation = async () => {
    // Validate data
    const validation = emailUtils.validateAutomationData(emailData);
    if (!validation.isValid) {
      setError(validation.errors.join(', '));
      return;
    }

    try {
      setLoading(true);
      const response = await emailAutomationService.scheduleEmail(emailData);
      
      // Add to local state
      setSavedAutomations(prev => [...prev, response.automation]);
      
      // Reset form
      setEmailData({
        subject: '',
        body: '',
        recipients: [],
        cc: [],
        bcc: [],
        scheduledTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        isRecurring: false,
        recurrenceType: 'daily',
        customRecurrence: '',
        followUpEnabled: false,
        followUpDays: 3,
        followUpMessage: '',
        autoReplyEnabled: false,
        autoReplyMessage: '',
        personalizationEnabled: true,
        variables: {
          recipientName: true,
          company: true,
          customFields: []
        }
      });
      
      setSuccess('Email automation scheduled successfully!');
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const cancelAutomation = async (id) => {
    try {
      await emailAutomationService.updateStatus(id, 'cancelled');
      setSavedAutomations(prev => 
        prev.map(auto => 
          auto.id === id ? { ...auto, status: 'cancelled' } : auto
        )
      );
      setSuccess('Automation cancelled successfully!');
    } catch (error) {
      setError(error.message);
    }
  };

  const runAutomationNow = async (id) => {
    try {
      await emailAutomationService.runAutomation(id);
      setSavedAutomations(prev => 
        prev.map(auto => 
          auto.id === id ? { ...auto, status: 'sent', lastSent: new Date() } : auto
        )
      );
      setSuccess('Email sent successfully!');
    } catch (error) {
      setError(error.message);
    }
  };

  const handleCloseSnackbar = () => {
    setError('');
    setSuccess('');
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" gutterBottom>
            Email Automation
          </Typography>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadAutomations}
            disabled={loading}
          >
            Refresh
          </Button>
        </Box>
        
        <Grid container spacing={3}>
          {/* Email Composition */}
          <Grid item xs={12} md={8}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Compose Email
                </Typography>
                
                <TextField
                  fullWidth
                  label="Subject"
                  value={emailData.subject}
                  onChange={(e) => handleInputChange('subject', e.target.value)}
                  margin="normal"
                  placeholder="Enter email subject"
                />
                
                <TextField
                  fullWidth
                  label="Email Body"
                  multiline
                  rows={6}
                  value={emailData.body}
                  onChange={(e) => handleInputChange('body', e.target.value)}
                  margin="normal"
                  placeholder="Use variables like {{recipientName}}, {{company}} for personalization"
                />
                
                <Divider sx={{ my: 2 }} />
                
                {/* Recipients */}
                <Typography variant="subtitle1" gutterBottom>
                  Recipients
                </Typography>
                
                <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                  <TextField
                    size="small"
                    placeholder="Add recipient email"
                    value={newRecipient}
                    onChange={(e) => setNewRecipient(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addRecipient('recipients')}
                    error={newRecipient && !emailUtils.isValidEmail(newRecipient)}
                    helperText={newRecipient && !emailUtils.isValidEmail(newRecipient) ? 'Invalid email format' : ''}
                  />
                  <Button
                    variant="outlined"
                    onClick={() => addRecipient('recipients')}
                    startIcon={<AddIcon />}
                  >
                    Add
                  </Button>
                </Box>
                
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                  {emailData.recipients.map((recipient, index) => (
                    <Chip
                      key={index}
                      label={recipient}
                      onDelete={() => removeRecipient('recipients', index)}
                      color="primary"
                    />
                  ))}
                </Box>
                
                {/* CC/BCC */}
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="CC emails (comma separated)"
                      value={emailData.cc.join(', ')}
                      onChange={(e) => handleInputChange('cc', e.target.value.split(',').map(s => s.trim()).filter(s => s))}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="BCC emails (comma separated)"
                      value={emailData.bcc.join(', ')}
                      onChange={(e) => handleInputChange('bcc', e.target.value.split(',').map(s => s.trim()).filter(s => s))}
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
          
          {/* Scheduling & Automation */}
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Schedule & Automate
                </Typography>
                
                <DateTimePicker
                  label="Send Date & Time"
                  value={emailData.scheduledTime}
                  onChange={(newValue) => handleInputChange('scheduledTime', newValue)}
                  renderInput={(params) => <TextField {...params} fullWidth margin="normal" />}
                  minDateTime={new Date()}
                />
                
                <FormControlLabel
                  control={
                    <Switch
                      checked={emailData.isRecurring}
                      onChange={(e) => handleInputChange('isRecurring', e.target.checked)}
                    />
                  }
                  label="Recurring"
                />
                
                {emailData.isRecurring && (
                  <FormControl fullWidth margin="normal">
                    <InputLabel>Recurrence</InputLabel>
                    <Select
                      value={emailData.recurrenceType}
                      onChange={(e) => handleInputChange('recurrenceType', e.target.value)}
                    >
                      <MenuItem value="daily">Daily</MenuItem>
                      <MenuItem value="weekly">Weekly</MenuItem>
                      <MenuItem value="monthly">Monthly</MenuItem>
                      <MenuItem value="custom">Custom</MenuItem>
                    </Select>
                  </FormControl>
                )}
                
                <Divider sx={{ my: 2 }} />
                
                {/* Follow-up Settings */}
                <Typography variant="subtitle1" gutterBottom>
                  Follow-up Automation
                </Typography>
                
                <FormControlLabel
                  control={
                    <Switch
                      checked={emailData.followUpEnabled}
                      onChange={(e) => handleInputChange('followUpEnabled', e.target.checked)}
                    />
                  }
                  label="Send follow-up if no reply"
                />
                
                {emailData.followUpEnabled && (
                  <>
                    <TextField
                      fullWidth
                      size="small"
                      type="number"
                      label="Days to wait"
                      value={emailData.followUpDays}
                      onChange={(e) => handleInputChange('followUpDays', parseInt(e.target.value))}
                      margin="normal"
                      inputProps={{ min: 1, max: 30 }}
                    />
                    <TextField
                      fullWidth
                      size="small"
                      label="Follow-up message"
                      multiline
                      rows={3}
                      value={emailData.followUpMessage}
                      onChange={(e) => handleInputChange('followUpMessage', e.target.value)}
                      margin="normal"
                    />
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={generateAIFollowUp}
                      disabled={aiGenerating}
                      sx={{ mt: 1 }}
                    >
                      {aiGenerating ? <CircularProgress size={16} /> : 'Generate AI Follow-up'}
                    </Button>
                  </>
                )}
                
                {/* Auto-reply Settings */}
                <FormControlLabel
                  control={
                    <Switch
                      checked={emailData.autoReplyEnabled}
                      onChange={(e) => handleInputChange('autoReplyEnabled', e.target.checked)}
                    />
                  }
                  label="Auto-reply to responses"
                />
                
                {emailData.autoReplyEnabled && (
                  <>
                    <TextField
                      fullWidth
                      size="small"
                      label="Auto-reply message"
                      multiline
                      rows={3}
                      value={emailData.autoReplyMessage}
                      onChange={(e) => handleInputChange('autoReplyMessage', e.target.value)}
                      margin="normal"
                    />
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={generateAIAutoReply}
                      disabled={aiGenerating}
                      sx={{ mt: 1 }}
                    >
                      {aiGenerating ? <CircularProgress size={16} /> : 'Generate AI Auto-reply'}
                    </Button>
                  </>
                )}
                
                <Divider sx={{ my: 2 }} />
                
                {/* Personalization */}
                <Typography variant="subtitle1" gutterBottom>
                  Personalization
                </Typography>
                
                <FormControlLabel
                  control={
                    <Switch
                      checked={emailData.personalizationEnabled}
                      onChange={(e) => handleInputChange('personalizationEnabled', e.target.checked)}
                    />
                  }
                  label="Enable personalization"
                />
                
                {emailData.personalizationEnabled && (
                  <Box>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={emailData.variables.recipientName}
                          onChange={(e) => handleInputChange('variables', {
                            ...emailData.variables,
                            recipientName: e.target.checked
                          })}
                        />
                      }
                      label="Use recipient name"
                    />
                    
                    <FormControlLabel
                      control={
                        <Switch
                          checked={emailData.variables.company}
                          onChange={(e) => handleInputChange('variables', {
                            ...emailData.variables,
                            company: e.target.checked
                          })}
                        />
                      }
                      label="Use company info"
                    />
                    
                    {/* Custom Variables */}
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="body2" gutterBottom>
                        Custom Variables
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                        <TextField
                          size="small"
                          placeholder="Variable name"
                          value={newVariable.key}
                          onChange={(e) => setNewVariable(prev => ({ ...prev, key: e.target.value }))}
                        />
                        <TextField
                          size="small"
                          placeholder="Default value"
                          value={newVariable.value}
                          onChange={(e) => setNewVariable(prev => ({ ...prev, value: e.target.value }))}
                        />
                        <Button size="small" onClick={addCustomVariable}>
                          Add
                        </Button>
                      </Box>
                      
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {emailData.variables.customFields.map((variable, index) => (
                          <Chip
                            key={index}
                            label={`${variable.key}: ${variable.value}`}
                            onDelete={() => removeCustomVariable(index)}
                            color="secondary"
                          />
                        ))}
                      </Box>
                    </Box>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
        
        {/* Action Buttons */}
        <Box sx={{ mt: 3, display: 'flex', gap: 2, justifyContent: 'center' }}>
          <Button
            variant="outlined"
            onClick={() => setPreviewDialog(true)}
            startIcon={<ScheduleIcon />}
          >
            Preview
          </Button>
          <Button
            variant="contained"
            onClick={saveAutomation}
            startIcon={loading ? <CircularProgress size={20} /> : <ScheduleIcon />}
            disabled={loading || !emailData.subject || !emailData.body || emailData.recipients.length === 0}
          >
            {loading ? 'Scheduling...' : 'Schedule Email'}
          </Button>
        </Box>
        
        {/* Saved Automations */}
        {savedAutomations.length > 0 && (
          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Scheduled Emails
              </Typography>
              
              {savedAutomations.map((automation) => (
                <Box
                  key={automation.id}
                  sx={{
                    p: 2,
                    border: '1px solid #e0e0e0',
                    borderRadius: 1,
                    mb: 2,
                    backgroundColor: automation.status === 'cancelled' ? '#f5f5f5' : 'white'
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                      <Typography variant="subtitle1" fontWeight="bold">
                        {automation.subject}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        To: {automation.recipients.join(', ')}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Scheduled: {emailUtils.formatScheduledTime(automation.scheduledTime)}
                      </Typography>
                      <Chip
                        label={automation.status}
                        color={emailUtils.getStatusColor(automation.status)}
                        size="small"
                      />
                    </Box>
                    
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      {automation.status === 'scheduled' && (
                        <>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => runAutomationNow(automation.id)}
                          >
                            Send Now
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            onClick={() => cancelAutomation(automation.id)}
                          >
                            Cancel
                          </Button>
                        </>
                      )}
                    </Box>
                  </Box>
                </Box>
              ))}
            </CardContent>
          </Card>
        )}
        
        {/* Preview Dialog */}
        <Dialog
          open={previewDialog}
          onClose={() => setPreviewDialog(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>Email Preview</DialogTitle>
          <DialogContent>
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Subject
              </Typography>
              <Typography variant="body1">
                {emailData.subject}
              </Typography>
            </Box>
            
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">
                To
              </Typography>
              <Typography variant="body1">
                {emailData.recipients.join(', ')}
              </Typography>
            </Box>
            
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Scheduled Time
              </Typography>
              <Typography variant="body1">
                {emailData.scheduledTime.toLocaleString()}
              </Typography>
            </Box>
            
            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                Message
              </Typography>
              <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                {emailData.body}
              </Typography>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPreviewDialog(false)}>Close</Button>
          </DialogActions>
        </Dialog>

        {/* Error and Success Snackbars */}
        <Snackbar
          open={!!error}
          autoHideDuration={6000}
          onClose={handleCloseSnackbar}
        >
          <Alert onClose={handleCloseSnackbar} severity="error">
            {error}
          </Alert>
        </Snackbar>

        <Snackbar
          open={!!success}
          autoHideDuration={4000}
          onClose={handleCloseSnackbar}
        >
          <Alert onClose={handleCloseSnackbar} severity="success">
            {success}
          </Alert>
        </Snackbar>
      </Box>
    </LocalizationProvider>
  );
};

export default EmailAutomation;