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
  DialogActions,
  Chip,
  FormGroup,
  Checkbox,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  RadioGroup,
  Radio,
  FormLabel
} from '@mui/material';
import { 
  ExpandMore as ExpandMoreIcon,
  Schedule as ScheduleIcon,
  Email as EmailIcon,
  AutoAwesome as AutoAwesomeIcon,
  Reply as ReplyIcon
} from '@mui/icons-material';
import { emailAPI } from '../utils/api';

const EmailComposer = ({ onSchedule, onCancel }) => {
  const [emailData, setEmailData] = useState({
    from: '',
    recipients: '',
    cc: '',
    bcc: '',
    subject: '',
    body: '',
    scheduledFor: '',
    personalization: {},
    recurring: { 
      enabled: false, 
      type: 'daily', 
      hour: 9, 
      minute: 0,
      selectedDays: [] // New: for weekly recurring emails
    },
    followUp: { enabled: false, daysAfter: 3, message: '' },
    autoReply: { 
      enabled: false, 
      message: '', 
      useAI: true,
      replyType: 'standard', // standard, out_of_office, custom
      aiTone: 'professional' // professional, friendly, casual
    }
  });

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [errors, setErrors] = useState({});

  const daysOfWeek = [
    { value: 'monday', label: 'Monday' },
    { value: 'tuesday', label: 'Tuesday' },
    { value: 'wednesday', label: 'Wednesday' },
    { value: 'thursday', label: 'Thursday' },
    { value: 'friday', label: 'Friday' },
    { value: 'saturday', label: 'Saturday' },
    { value: 'sunday', label: 'Sunday' }
  ];

  const autoReplyTemplates = {
    standard: "Thank you for your email. I have received your message and will get back to you as soon as possible.",
    out_of_office: "I am currently out of the office and will return on [DATE]. I will respond to your email upon my return. For urgent matters, please contact [CONTACT].",
    custom: ""
  };

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

  const handleDaySelection = (day) => {
    setEmailData(prev => ({
      ...prev,
      recurring: {
        ...prev.recurring,
        selectedDays: prev.recurring.selectedDays.includes(day)
          ? prev.recurring.selectedDays.filter(d => d !== day)
          : [...prev.recurring.selectedDays, day]
      }
    }));
  };

  const handleAutoReplyTypeChange = (type) => {
    setEmailData(prev => ({
      ...prev,
      autoReply: {
        ...prev.autoReply,
        replyType: type,
        message: type !== 'custom' ? autoReplyTemplates[type] : ''
      }
    }));
  };

  const validateForm = () => {
    const newErrors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!emailData.from.trim() || !emailRegex.test(emailData.from.trim())) {
      newErrors.from = 'A valid "From" email is required';
    }

    if (!emailData.recipients.trim()) {
      newErrors.recipients = 'At least one recipient is required';
    }
    
    if (!emailData.subject.trim()) newErrors.subject = 'Subject is required';
    if (!emailData.body.trim()) newErrors.body = 'Email body is required';
    if (!emailData.scheduledFor) newErrors.scheduledFor = 'Scheduled time is required';

    // Validate recurring settings
    if (emailData.recurring.enabled && emailData.recurring.type === 'weekly' && emailData.recurring.selectedDays.length === 0) {
      newErrors.recurringDays = 'Please select at least one day for weekly recurring emails';
    }

    // Validate auto-reply settings
    if (emailData.autoReply.enabled && emailData.autoReply.replyType === 'custom' && !emailData.autoReply.message.trim()) {
      newErrors.autoReplyMessage = 'Custom auto-reply message is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleSchedule = () => {
    if (!validateForm()) return;

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
    setPreviewOpen(true);
  };

  return (
    <Card 
      sx={{ 
        maxWidth: 900, 
        margin: 'auto', 
        mt: 2, 
        boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
        borderRadius: 2
      }}
    >
      <CardContent sx={{ p: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <EmailIcon sx={{ mr: 2, color: '#4CAF50', fontSize: 32 }} />
          <Typography variant="h4" sx={{ fontWeight: 600, color: '#333' }}>
            Schedule Email
          </Typography>
        </Box>
        
        <Grid container spacing={3}>
          {/* Basic Email Fields */}
          <Grid item xs={12}>
            <Paper sx={{ p: 3, backgroundColor: '#f8f9fa', borderRadius: 2 }}>
              <Typography variant="h6" sx={{ mb: 2, color: '#4CAF50', fontWeight: 600 }}>
                Email Details
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="From"
                    value={emailData.from}
                    onChange={(e) => handleInputChange('from', e.target.value)}
                    error={!!errors.from}
                    helperText={errors.from || 'This must be a verified sender email'}
                    required
                    sx={{ backgroundColor: 'white', borderRadius: 1 }}
                  />
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="To"
                    value={emailData.recipients}
                    onChange={(e) => handleInputChange('recipients', e.target.value)}
                    error={!!errors.recipients}
                    helperText={errors.recipients || 'Separate multiple emails with commas'}
                    required
                    sx={{ backgroundColor: 'white', borderRadius: 1 }}
                  />
                </Grid>
                
                <Grid item xs={6}>
                  <TextField 
                    fullWidth 
                    label="CC" 
                    value={emailData.cc} 
                    onChange={(e) => handleInputChange('cc', e.target.value)}
                    sx={{ backgroundColor: 'white', borderRadius: 1 }}
                  />
                </Grid>
                
                <Grid item xs={6}>
                  <TextField 
                    fullWidth 
                    label="BCC" 
                    value={emailData.bcc} 
                    onChange={(e) => handleInputChange('bcc', e.target.value)}
                    sx={{ backgroundColor: 'white', borderRadius: 1 }}
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <TextField 
                    fullWidth 
                    label="Subject" 
                    value={emailData.subject} 
                    onChange={(e) => handleInputChange('subject', e.target.value)} 
                    error={!!errors.subject} 
                    helperText={errors.subject} 
                    required
                    sx={{ backgroundColor: 'white', borderRadius: 1 }}
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <TextField 
                    fullWidth 
                    multiline 
                    rows={6} 
                    label="Email Body" 
                    value={emailData.body} 
                    onChange={(e) => handleInputChange('body', e.target.value)} 
                    error={!!errors.body} 
                    helperText={errors.body || 'Use {variableName} for personalization'} 
                    required
                    sx={{ backgroundColor: 'white', borderRadius: 1 }}
                  />
                </Grid>
              </Grid>
            </Paper>
          </Grid>

          {/* Scheduling Options */}
          <Grid item xs={12}>
            <Accordion defaultExpanded sx={{ boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <ScheduleIcon sx={{ mr: 1, color: '#4CAF50' }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>Scheduling Options</Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      type="datetime-local"
                      label="Schedule For"
                      value={emailData.scheduledFor}
                      onChange={(e) => handleInputChange('scheduledFor', e.target.value)}
                      error={!!errors.scheduledFor}
                      helperText={errors.scheduledFor}
                      InputLabelProps={{ shrink: true }}
                      required
                    />
                  </Grid>
                  
                  <Grid item xs={12}>
                    <FormControlLabel 
                      control={
                        <Switch 
                          checked={emailData.recurring.enabled} 
                          onChange={(e) => handleNestedChange('recurring', 'enabled', e.target.checked)}
                          sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#4CAF50' } }}
                        />
                      } 
                      label="Recurring Email" 
                    />
                  </Grid>

                  {emailData.recurring.enabled && (
                    <>
                      <Grid item xs={12} md={6}>
                        <FormControl fullWidth>
                          <InputLabel>Recurrence Type</InputLabel>
                          <Select
                            value={emailData.recurring.type}
                            onChange={(e) => handleNestedChange('recurring', 'type', e.target.value)}
                            label="Recurrence Type"
                          >
                            <MenuItem value="daily">Daily</MenuItem>
                            <MenuItem value="weekly">Weekly</MenuItem>
                            <MenuItem value="monthly">Monthly</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>

                      {emailData.recurring.type === 'weekly' && (
                        <Grid item xs={12}>
                          <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
                            Select Days
                          </Typography>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {daysOfWeek.map((day) => (
                              <Chip
                                key={day.value}
                                label={day.label}
                                clickable
                                onClick={() => handleDaySelection(day.value)}
                                color={emailData.recurring.selectedDays.includes(day.value) ? 'primary' : 'default'}
                                variant={emailData.recurring.selectedDays.includes(day.value) ? 'filled' : 'outlined'}
                                sx={{
                                  '&.MuiChip-colorPrimary': {
                                    backgroundColor: '#4CAF50',
                                    color: 'white'
                                  }
                                }}
                              />
                            ))}
                          </Box>
                          {errors.recurringDays && (
                            <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
                              {errors.recurringDays}
                            </Typography>
                          )}
                        </Grid>
                      )}

                      <Grid item xs={6} md={3}>
                        <TextField
                          fullWidth
                          type="number"
                          label="Hour (0-23)"
                          value={emailData.recurring.hour}
                          onChange={(e) => handleNestedChange('recurring', 'hour', parseInt(e.target.value))}
                          inputProps={{ min: 0, max: 23 }}
                        />
                      </Grid>
                      
                      <Grid item xs={6} md={3}>
                        <TextField
                          fullWidth
                          type="number"
                          label="Minute (0-59)"
                          value={emailData.recurring.minute}
                          onChange={(e) => handleNestedChange('recurring', 'minute', parseInt(e.target.value))}
                          inputProps={{ min: 0, max: 59 }}
                        />
                      </Grid>
                    </>
                  )}
                </Grid>
              </AccordionDetails>
            </Accordion>
          </Grid>

          {/* Auto-Reply Options */}
          <Grid item xs={12}>
            <Accordion sx={{ boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <ReplyIcon sx={{ mr: 1, color: '#4CAF50' }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>Auto-Reply Settings</Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <FormControlLabel 
                      control={
                        <Switch 
                          checked={emailData.autoReply.enabled} 
                          onChange={(e) => handleNestedChange('autoReply', 'enabled', e.target.checked)}
                          sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#4CAF50' } }}
                        />
                      } 
                      label="Enable Auto-Reply" 
                    />
                  </Grid>

                  {emailData.autoReply.enabled && (
                    <>
                      <Grid item xs={12}>
                        <FormControl component="fieldset">
                          <FormLabel component="legend" sx={{ fontWeight: 600, mb: 1 }}>
                            Auto-Reply Type
                          </FormLabel>
                          <RadioGroup
                            value={emailData.autoReply.replyType}
                            onChange={(e) => handleAutoReplyTypeChange(e.target.value)}
                          >
                            <FormControlLabel 
                              value="standard" 
                              control={<Radio sx={{ color: '#4CAF50', '&.Mui-checked': { color: '#4CAF50' } }} />} 
                              label="Standard Response" 
                            />
                            <FormControlLabel 
                              value="out_of_office" 
                              control={<Radio sx={{ color: '#4CAF50', '&.Mui-checked': { color: '#4CAF50' } }} />} 
                              label="Out of Office" 
                            />
                            <FormControlLabel 
                              value="custom" 
                              control={<Radio sx={{ color: '#4CAF50', '&.Mui-checked': { color: '#4CAF50' } }} />} 
                              label="Custom Message" 
                            />
                          </RadioGroup>
                        </FormControl>
                      </Grid>

                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          multiline
                          rows={4}
                          label="Auto-Reply Message"
                          value={emailData.autoReply.message}
                          onChange={(e) => handleNestedChange('autoReply', 'message', e.target.value)}
                          error={!!errors.autoReplyMessage}
                          helperText={errors.autoReplyMessage}
                          disabled={emailData.autoReply.replyType !== 'custom'}
                        />
                      </Grid>

                      <Grid item xs={12}>
                        <FormControlLabel 
                          control={
                            <Switch 
                              checked={emailData.autoReply.useAI} 
                              onChange={(e) => handleNestedChange('autoReply', 'useAI', e.target.checked)}
                              sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#4CAF50' } }}
                            />
                          } 
                          label={
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              <AutoAwesomeIcon sx={{ mr: 1, fontSize: 20 }} />
                              Use AI Enhancement
                            </Box>
                          }
                        />
                      </Grid>

                      {emailData.autoReply.useAI && (
                        <Grid item xs={12} md={6}>
                          <FormControl fullWidth>
                            <InputLabel>AI Tone</InputLabel>
                            <Select
                              value={emailData.autoReply.aiTone}
                              onChange={(e) => handleNestedChange('autoReply', 'aiTone', e.target.value)}
                              label="AI Tone"
                            >
                              <MenuItem value="professional">Professional</MenuItem>
                              <MenuItem value="friendly">Friendly</MenuItem>
                              <MenuItem value="casual">Casual</MenuItem>
                            </Select>
                          </FormControl>
                        </Grid>
                      )}
                    </>
                  )}
                </Grid>
              </AccordionDetails>
            </Accordion>
          </Grid>

          {/* Action Buttons */}
          <Grid item xs={12}>
            <Divider sx={{ my: 2 }} />
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              <Button 
                variant="outlined" 
                onClick={onCancel}
                sx={{ 
                  borderColor: '#ccc', 
                  color: '#666',
                  '&:hover': { borderColor: '#999', backgroundColor: '#f5f5f5' }
                }}
              >
                Cancel
              </Button>
              <Button 
                variant="outlined" 
                onClick={handlePreview}
                sx={{ 
                  borderColor: '#4CAF50', 
                  color: '#4CAF50',
                  '&:hover': { borderColor: '#45a049', backgroundColor: '#f1f8e9' }
                }}
              >
                Preview
              </Button>
              <Button 
                variant="contained" 
                onClick={handleSchedule} 
                sx={{ 
                  backgroundColor: '#4CAF50',
                  '&:hover': { backgroundColor: '#45a049' },
                  fontWeight: 600,
                  px: 4
                }}
              >
                Schedule Email
              </Button>
            </Box>
          </Grid>
        </Grid>
      </CardContent>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Email Preview</DialogTitle>
        <DialogContent>
          <Typography variant="body1">Preview functionality can be implemented here.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
};

export default EmailComposer;