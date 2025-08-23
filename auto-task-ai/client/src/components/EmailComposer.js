import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Divider,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import { emailAPI } from '../utils/api';

const EmailComposer = ({ onSchedule, onCancel }) => {
  const [emailData, setEmailData] = useState({
    // 1. ADDED 'from' TO THE INITIAL STATE
    from: '',
    recipients: '',
    cc: '',
    bcc: '',
    subject: '',
    body: '',
    scheduledFor: '',
    personalization: {},
    recurring: { enabled: false, type: 'daily', hour: 9, minute: 0 },
    followUp: { enabled: false, daysAfter: 3, message: '' },
    autoReply: { enabled: false, message: '', useAI: true }
  });

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [errors, setErrors] = useState({});

  const handleInputChange = (field, value) => {
    setEmailData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const handleNestedChange = (parent, field, value) => {
    setEmailData(prev => ({
      ...prev,
      [parent]: { ...prev[parent], [field]: value }
    }));
  };

  const validateForm = () => {
    const newErrors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    // 2. ADDED VALIDATION FOR THE 'from' FIELD
    if (!emailData.from.trim() || !emailRegex.test(emailData.from.trim())) {
      newErrors.from = 'A valid "From" email is required';
    }

    if (!emailData.recipients.trim()) {
      newErrors.recipients = 'At least one recipient is required';
    }
    
    if (!emailData.subject.trim()) newErrors.subject = 'Subject is required';
    if (!emailData.body.trim()) newErrors.body = 'Email body is required';
    if (!emailData.scheduledFor) newErrors.scheduledFor = 'Scheduled time is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleSchedule = () => {
    if (!validateForm()) return;

    // 3. ADDED THE 'from' FIELD TO THE DATA SENT TO THE SERVER
    const scheduleData = {
      from: emailData.from.trim(),
      recipients: emailData.recipients.split(',').map(e => e.trim()),
      cc: emailData.cc ? emailData.cc.split(',').map(e => e.trim()) : [],
      bcc: emailData.bcc ? emailData.bcc.split(',').map(e => e.trim()) : [],
      subject: emailData.subject,
      body: emailData.body,
      scheduledFor: new Date(emailData.scheduledFor).toISOString(),
      personalization: emailData.personalization,
      recurring: emailData.recurring,
      followUp: emailData.followUp,
      autoReply: emailData.autoReply
    };

    onSchedule(scheduleData);
  };
  
  const handlePreview = async () => {
    // Preview logic remains the same
  };

  return (
    <Card sx={{ maxWidth: 800, margin: 'auto', mt: 2 }}>
      <CardContent>
        <Typography variant="h5" gutterBottom>Schedule Email</Typography>
        <Grid container spacing={3}>

          {/* 4. ADDED THE 'From' TEXTFIELD TO THE FORM */}
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="From"
              value={emailData.from}
              onChange={(e) => handleInputChange('from', e.target.value)}
              error={!!errors.from}
              helperText={errors.from || 'This must be a verified sender email'}
              required
            />
          </Grid>

          {/* Recipients */}
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="To" // Changed label for clarity
              value={emailData.recipients}
              onChange={(e) => handleInputChange('recipients', e.target.value)}
              error={!!errors.recipients}
              helperText={errors.recipients || 'Separate multiple emails with commas'}
              required
            />
          </Grid>
          
          {/* ... The rest of your form JSX is correct and remains the same ... */}
          <Grid item xs={6}><TextField fullWidth label="CC" value={emailData.cc} onChange={(e) => handleInputChange('cc', e.target.value)} /></Grid>
          <Grid item xs={6}><TextField fullWidth label="BCC" value={emailData.bcc} onChange={(e) => handleInputChange('bcc', e.target.value)}/></Grid>
          <Grid item xs={12}><TextField fullWidth label="Subject" value={emailData.subject} onChange={(e) => handleInputChange('subject', e.target.value)} error={!!errors.subject} helperText={errors.subject} required /></Grid>
          <Grid item xs={12}><TextField fullWidth multiline rows={8} label="Email Body" value={emailData.body} onChange={(e) => handleInputChange('body', e.target.value)} error={!!errors.body} helperText={errors.body || 'Use {variableName} for personalization'} required /></Grid>
          <Grid item xs={12}><Typography variant="h6">Scheduling Options</Typography></Grid>
          <Grid item xs={6}><TextField fullWidth type="datetime-local" label="Schedule For" value={emailData.scheduledFor} onChange={(e) => handleInputChange('scheduledFor', e.target.value)} error={!!errors.scheduledFor} helperText={errors.scheduledFor} InputLabelProps={{ shrink: true }} required /></Grid>
          <Grid item xs={12}><FormControlLabel control={<Switch checked={emailData.recurring.enabled} onChange={(e) => handleNestedChange('recurring', 'enabled', e.target.checked)}/>} label="Recurring Email" /></Grid>
          {/* Action Buttons */}
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 3 }}>
              <Button variant="outlined" onClick={onCancel}>Cancel</Button>
              <Button variant="outlined" onClick={handlePreview}>Preview</Button>
              <Button variant="contained" onClick={handleSchedule} sx={{ backgroundColor: '#4CAF50' }}>Schedule Email</Button>
            </Box>
          </Grid>
        </Grid>
      </CardContent>
      {/* Dialog JSX remains the same */}
    </Card>
  );
};

export default EmailComposer;