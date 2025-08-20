import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Divider,
  Grid,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

const EmailComposer = ({ onSchedule, onCancel }) => {
  const [emailData, setEmailData] = useState({
    recipients: '',
    cc: '',
    bcc: '',
    subject: '',
    body: '',
    scheduledFor: new Date(),
    personalization: {},
    recurring: {
      enabled: false,
      type: 'daily',
      hour: 9,
      minute: 0
    },
    followUp: {
      enabled: false,
      daysAfter: 3,
      message: ''
    },
    autoReply: {
      enabled: false,
      message: '',
      useAI: true
    }
  });

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [errors, setErrors] = useState({});

  const handleInputChange = (field, value) => {
    setEmailData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const handleNestedChange = (parent, field, value) => {
    setEmailData(prev => ({
      ...prev,
      [parent]: {
        ...prev[parent],
        [field]: value
      }
    }));
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!emailData.recipients.trim()) {
      newErrors.recipients = 'At least one recipient is required';
    } else {
      // Validate email format
      const emails = emailData.recipients.split(',').map(e => e.trim());
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emails.every(email => emailRegex.test(email))) {
        newErrors.recipients = 'Please enter valid email addresses separated by commas';
      }
    }
    
    if (!emailData.subject.trim()) {
      newErrors.subject = 'Subject is required';
    }
    
    if (!emailData.body.trim()) {
      newErrors.body = 'Email body is required';
    }
    
    if (emailData.scheduledFor <= new Date()) {
      newErrors.scheduledFor = 'Scheduled time must be in the future';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePreview = async () => {
    if (!validateForm()) return;

    try {
      // Create sample personalization data for preview
      const samplePersonalization = {
        recipientName: 'John Doe',
        companyName: 'Example Corp',
        ...emailData.personalization
      };

      const response = await fetch('/api/emails/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: emailData.subject,
          body: emailData.body,
          personalization: samplePersonalization
        })
      });

      const result = await response.json();
      if (result.success) {
        setPreviewData(result.preview);
        setPreviewOpen(true);
      }
    } catch (error) {
      console.error('Error generating preview:', error);
    }
  };

  const handleSchedule = async () => {
    if (!validateForm()) return;

    const scheduleData = {
      recipients: emailData.recipients.split(',').map(e => e.trim()),
      cc: emailData.cc ? emailData.cc.split(',').map(e => e.trim()) : [],
      bcc: emailData.bcc ? emailData.bcc.split(',').map(e => e.trim()) : [],
      subject: emailData.subject,
      body: emailData.body,
      scheduledFor: emailData.scheduledFor.toISOString(),
      personalization: emailData.personalization,
      recurring: emailData.recurring.enabled ? emailData.recurring : undefined,
      followUp: emailData.followUp.enabled ? emailData.followUp : undefined,
      autoReply: emailData.autoReply.enabled ? emailData.autoReply : undefined
    };

    onSchedule(scheduleData);
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Card sx={{ maxWidth: 800, margin: 'auto', mt: 2 }}>
        <CardContent>
          <Typography variant="h5" gutterBottom>
            Schedule Email
          </Typography>
          
          <Grid container spacing={3}>
            {/* Recipients */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Recipients"
                placeholder="email1@example.com, email2@example.com"
                value={emailData.recipients}
                onChange={(e) => handleInputChange('recipients', e.target.value)}
                error={!!errors.recipients}
                helperText={errors.recipients || 'Separate multiple emails with commas'}
                required
              />
            </Grid>

            {/* CC/BCC */}
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="CC"
                placeholder="cc@example.com"
                value={emailData.cc}
                onChange={(e) => handleInputChange('cc', e.target.value)}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="BCC"
                placeholder="bcc@example.com"
                value={emailData.bcc}
                onChange={(e) => handleInputChange('bcc', e.target.value)}
              />
            </Grid>

            {/* Subject */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Subject"
                value={emailData.subject}
                onChange={(e) => handleInputChange('subject', e.target.value)}
                error={!!errors.subject}
                helperText={errors.subject}
                required
              />
            </Grid>

            {/* Body */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={8}
                label="Email Body"
                value={emailData.body}
                onChange={(e) => handleInputChange('body', e.target.value)}
                error={!!errors.body}
                helperText={errors.body || 'Use {{variableName}} for personalization'}
                required
              />
            </Grid>

            {/* Scheduling */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Scheduling Options
              </Typography>
            </Grid>

            <Grid item xs={6}>
              <DateTimePicker
                label="Schedule For"
                value={emailData.scheduledFor}
                onChange={(newValue) => handleInputChange('scheduledFor', newValue)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    fullWidth
                    error={!!errors.scheduledFor}
                    helperText={errors.scheduledFor}
                  />
                )}
              />
            </Grid>

            {/* Recurring Options */}
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={emailData.recurring.enabled}
                    onChange={(e) => handleNestedChange('recurring', 'enabled', e.target.checked)}
                  />
                }
                label="Recurring Email"
              />
            </Grid>

            {emailData.recurring.enabled && (
              <>
                <Grid item xs={4}>
                  <FormControl fullWidth>
                    <InputLabel>Frequency</InputLabel>
                    <Select
                      value={emailData.recurring.type}
                      onChange={(e) => handleNestedChange('recurring', 'type', e.target.value)}
                    >
                      <MenuItem value="daily">Daily</MenuItem>
                      <MenuItem value="weekly">Weekly</MenuItem>
                      <MenuItem value="monthly">Monthly</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={4}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Hour (24h)"
                    value={emailData.recurring.hour}
                    onChange={(e) => handleNestedChange('recurring', 'hour', parseInt(e.target.value))}
                    inputProps={{ min: 0, max: 23 }}
                  />
                </Grid>
                <Grid item xs={4}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Minute"
                    value={emailData.recurring.minute}
                    onChange={(e) => handleNestedChange('recurring', 'minute', parseInt(e.target.value))}
                    inputProps={{ min: 0, max: 59 }}
                  />
                </Grid>
              </>
            )}

            {/* Follow-up Options */}
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="h6" gutterBottom>
                Follow-up & Auto-Reply
              </Typography>
            </Grid>

            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={emailData.followUp.enabled}
                    onChange={(e) => handleNestedChange('followUp', 'enabled', e.target.checked)}
                  />
                }
                label="Enable Follow-up if no reply"
              />
            </Grid>

            {emailData.followUp.enabled && (
              <>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Days after to follow up"
                    value={emailData.followUp.daysAfter}
                    onChange={(e) => handleNestedChange('followUp', 'daysAfter', parseInt(e.target.value))}
                    inputProps={{ min: 1, max: 30 }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Follow-up Message"
                    value={emailData.followUp.message}
                    onChange={(e) => handleNestedChange('followUp', 'message', e.target.value)}
                    placeholder="Just checking in on my previous email..."
                  />
                </Grid>
              </>
            )}

            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={emailData.autoReply.enabled}
                    onChange={(e) => handleNestedChange('autoReply', 'enabled', e.target.checked)}
                  />
                }
                label="Enable Auto-Reply when reply received"
              />
            </Grid>

            {emailData.autoReply.enabled && (
              <>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={emailData.autoReply.useAI}
                        onChange={(e) => handleNestedChange('autoReply', 'useAI', e.target.checked)}
                      />
                    }
                    label="Use AI-generated responses"
                  />
                </Grid>
                {!emailData.autoReply.useAI && (
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      multiline
                      rows={3}
                      label="Auto-Reply Message"
                      value={emailData.autoReply.message}
                      onChange={(e) => handleNestedChange('autoReply', 'message', e.target.value)}
                      placeholder="Thank you for your reply..."
                    />
                  </Grid>
                )}
              </>
            )}

            {/* Personalization Variables */}
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="h6" gutterBottom>
                Personalization Variables
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Add custom variables to personalize your emails. Use {{variableName}} in your email content.
              </Typography>
            </Grid>

            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Recipient Name Variable"
                placeholder="recipientName"
                value={emailData.personalization.recipientName || ''}
                onChange={(e) => handleInputChange('personalization', {
                  ...emailData.personalization,
                  recipientName: e.target.value
                })}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Company Name Variable"
                placeholder="companyName"
                value={emailData.personalization.companyName || ''}
                onChange={(e) => handleInputChange('personalization', {
                  ...emailData.personalization,
                  companyName: e.target.value
                })}
              />
            </Grid>

            {/* Action Buttons */}
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 3 }}>
                <Button variant="outlined" onClick={onCancel}>
                  Cancel
                </Button>
                <Button variant="outlined" onClick={handlePreview}>
                  Preview
                </Button>
                <Button 
                  variant="contained" 
                  onClick={handleSchedule}
                  sx={{ backgroundColor: '#4CAF50' }}
                >
                  Schedule Email
                </Button>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Email Preview</DialogTitle>
        <DialogContent>
          {previewData && (
            <Box>
              <Typography variant="subtitle2" gutterBottom>Subject:</Typography>
              <Typography variant="body1" gutterBottom sx={{ fontWeight: 'bold', mb: 2 }}>
                {previewData.subject}
              </Typography>
              
              <Typography variant="subtitle2" gutterBottom>Body:</Typography>
              <Box 
                sx={{ 
                  border: '1px solid #ddd', 
                  borderRadius: 1, 
                  p: 2, 
                  backgroundColor: '#f9f9f9',
                  minHeight: 200
                }}
                dangerouslySetInnerHTML={{ __html: previewData.body }}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  );
};

export default EmailComposer;