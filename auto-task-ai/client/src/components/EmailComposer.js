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
  FormLabel,
  Alert,
  Tooltip,
  IconButton
} from '@mui/material';
import { 
  ExpandMore as ExpandMoreIcon,
  Schedule as ScheduleIcon,
  Email as EmailIcon,
  AutoAwesome as AutoAwesomeIcon,
  Reply as ReplyIcon,
  AccessTime as AccessTimeIcon,
  Settings as SettingsIcon,
  Info as InfoIcon
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
    
    // ENHANCED: Updated auto-reply state structure with new features
    autoReply: { 
      enabled: false,
      replyType: 'standard',
      aiTone: 'professional',
      useAI: true,
      customMessage: '',
      template: '',
      
      // NEW: Add delay options
      delayEnabled: false,
      delayType: 'immediate', // immediate, minutes, hours, days
      delayAmount: 0,
      
      // NEW: Add advanced settings
      replyOnlyOnce: true, // Only reply once per thread
      skipIfContainsKeywords: '', // Skip auto-reply if email contains these keywords
      onlyDuringHours: false, // Only send during business hours
      businessHoursStart: '09:00',
      businessHoursEnd: '17:00'
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
        customMessage: type !== 'custom' ? autoReplyTemplates[type] : prev.autoReply.customMessage,
        template: type !== 'custom' ? autoReplyTemplates[type] : prev.autoReply.template
      }
    }));
  };

  // NEW: Helper function to get maximum delay amount based on type
  const getMaxDelayAmount = (delayType) => {
    switch (delayType) {
      case 'minutes': return 1440; // 24 hours in minutes
      case 'hours': return 168; // 7 days in hours
      case 'days': return 30; // 30 days
      default: return 1;
    }
  };

  // NEW: Helper function to convert delay to minutes
  const convertDelayToMinutes = (delayType, delayAmount) => {
    switch (delayType) {
      case 'immediate': return 0;
      case 'minutes': return delayAmount;
      case 'hours': return delayAmount * 60;
      case 'days': return delayAmount * 60 * 24;
      default: return 0;
    }
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

    // Enhanced auto-reply validation
    if (emailData.autoReply.enabled) {
      if (emailData.autoReply.replyType === 'custom' && !emailData.autoReply.customMessage.trim()) {
        newErrors.autoReplyMessage = 'Custom auto-reply message is required';
      }

      // NEW: Validate delay settings
      if (emailData.autoReply.delayEnabled && emailData.autoReply.delayType !== 'immediate') {
        if (!emailData.autoReply.delayAmount || emailData.autoReply.delayAmount <= 0) {
          newErrors.delayAmount = 'Delay amount must be greater than 0';
        }
        if (emailData.autoReply.delayAmount > getMaxDelayAmount(emailData.autoReply.delayType)) {
          newErrors.delayAmount = `Maximum ${emailData.autoReply.delayType} is ${getMaxDelayAmount(emailData.autoReply.delayType)}`;
        }
      }

      // NEW: Validate business hours
      if (emailData.autoReply.onlyDuringHours) {
        if (!emailData.autoReply.businessHoursStart || !emailData.autoReply.businessHoursEnd) {
          newErrors.businessHours = 'Both start and end times are required for business hours';
        } else if (emailData.autoReply.businessHoursStart >= emailData.autoReply.businessHoursEnd) {
          newErrors.businessHours = 'End time must be after start time';
        }
      }
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
      autoReply: {
        ...emailData.autoReply,
        // NEW: Convert delay to minutes for backend processing
        delayMinutes: emailData.autoReply.delayEnabled 
          ? convertDelayToMinutes(emailData.autoReply.delayType, emailData.autoReply.delayAmount)
          : 0,
        // NEW: Parse keywords into array
        skipKeywords: emailData.autoReply.skipIfContainsKeywords
          ? emailData.autoReply.skipIfContainsKeywords.split(',').map(k => k.trim().toLowerCase()).filter(k => k)
          : []
      }
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
          {/* Basic Email Fields - Unchanged */}
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

          {/* Scheduling Options - Unchanged */}
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

          {/* ENHANCED: Auto-Reply Options with NEW Features */}
          <Grid item xs={12}>
            <Accordion sx={{ boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <ReplyIcon sx={{ mr: 1, color: '#4CAF50' }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>Auto-Reply Settings</Typography>
                  {emailData.autoReply.enabled && (
                    <Chip 
                      label="Active" 
                      size="small" 
                      color="success" 
                      sx={{ ml: 2 }} 
                    />
                  )}
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={3}>
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
                      {/* Basic Auto-Reply Settings */}
                      <Grid item xs={12}>
                        <Paper sx={{ p: 2, backgroundColor: '#f8f9fa', borderRadius: 1 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2, color: '#4CAF50' }}>
                            Basic Settings
                          </Typography>
                          
                          <Grid container spacing={2}>
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
                                value={emailData.autoReply.replyType === 'custom' ? emailData.autoReply.customMessage : emailData.autoReply.template}
                                onChange={(e) => handleNestedChange('autoReply', 'customMessage', e.target.value)}
                                error={!!errors.autoReplyMessage}
                                helperText={errors.autoReplyMessage}
                                disabled={emailData.autoReply.replyType !== 'custom'}
                                sx={{ backgroundColor: 'white' }}
                              />
                            </Grid>

                            <Grid item xs={12} md={6}>
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
                          </Grid>
                        </Paper>
                      </Grid>

                      {/* NEW: Delay Settings */}
                      <Grid item xs={12}>
                        <Paper sx={{ p: 2, backgroundColor: '#e3f2fd', borderRadius: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                            <AccessTimeIcon sx={{ mr: 1, color: '#1976d2' }} />
                            <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#1976d2' }}>
                              Delay Settings
                            </Typography>
                            <Tooltip title="Add a delay before sending auto-replies to appear more natural">
                              <IconButton size="small" sx={{ ml: 1 }}>
                                <InfoIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                          
                          <Grid container spacing={2}>
                            <Grid item xs={12}>
                              <FormControlLabel 
                                control={
                                  <Switch 
                                    checked={emailData.autoReply.delayEnabled} 
                                    onChange={(e) => handleNestedChange('autoReply', 'delayEnabled', e.target.checked)}
                                    sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#1976d2' } }}
                                  />
                                } 
                                label="Add delay before sending auto-reply" 
                              />
                            </Grid>

                            {emailData.autoReply.delayEnabled && (
                              <>
                                <Grid item xs={12} md={6}>
                                  <FormControl fullWidth>
                                    <InputLabel>Delay Type</InputLabel>
                                    <Select
                                      value={emailData.autoReply.delayType}
                                      onChange={(e) => handleNestedChange('autoReply', 'delayType', e.target.value)}
                                      label="Delay Type"
                                    >
                                      <MenuItem value="immediate">Immediate</MenuItem>
                                      <MenuItem value="minutes">Minutes</MenuItem>
                                      <MenuItem value="hours">Hours</MenuItem>
                                      <MenuItem value="days">Days</MenuItem>
                                    </Select>
                                  </FormControl>
                                </Grid>
                                
                                {emailData.autoReply.delayType !== 'immediate' && (
                                  <Grid item xs={12} md={6}>
                                    <TextField
                                      fullWidth
                                      type="number"
                                      label="Delay Amount"
                                      value={emailData.autoReply.delayAmount}
                                      onChange={(e) => handleNestedChange('autoReply', 'delayAmount', parseInt(e.target.value) || 0)}
                                      error={!!errors.delayAmount}
                                      helperText={errors.delayAmount || `Enter ${emailData.autoReply.delayType}`}
                                      inputProps={{ 
                                        min: 1, 
                                        max: getMaxDelayAmount(emailData.autoReply.delayType) 
                                      }}
                                      placeholder={`Enter ${emailData.autoReply.delayType}`}
                                    />
                                  </Grid>
                                )}

                                {emailData.autoReply.delayType !== 'immediate' && emailData.autoReply.delayAmount > 0 && (
                                  <Grid item xs={12}>
                                    <Alert severity="info" sx={{ mt: 1 }}>
                                      Auto-reply will be sent after {emailData.autoReply.delayAmount} {emailData.autoReply.delayType}
                                    </Alert>
                                  </Grid>
                                )}
                              </>
                            )}
                          </Grid>
                        </Paper>
                      </Grid>

                      {/* NEW: Advanced Settings */}
                      <Grid item xs={12}>
                        <Paper sx={{ p: 2, backgroundColor: '#fff3e0', borderRadius: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                            <SettingsIcon sx={{ mr: 1, color: '#f57c00' }} />
                            <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#f57c00' }}>
                              Advanced Settings
                            </Typography>
                          </Box>
                          
                          <Grid container spacing={2}>
                            <Grid item xs={12}>
                              <FormControlLabel 
                                control={
                                  <Checkbox 
                                    checked={emailData.autoReply.replyOnlyOnce} 
                                    onChange={(e) => handleNestedChange('autoReply', 'replyOnlyOnce', e.target.checked)}
                                    sx={{ color: '#f57c00', '&.Mui-checked': { color: '#f57c00' } }}
                                  />
                                } 
                                label="Only reply once per email thread" 
                              />
                            </Grid>

                            <Grid item xs={12}>
                              <TextField
                                fullWidth
                                label="Skip auto-reply if email contains these keywords"
                                value={emailData.autoReply.skipIfContainsKeywords}
                                onChange={(e) => handleNestedChange('autoReply', 'skipIfContainsKeywords', e.target.value)}
                                placeholder="urgent, meeting, call, etc."
                                helperText="Separate keywords with commas. Auto-reply will be skipped if email contains any of these."
                                sx={{ backgroundColor: 'white' }}
                              />
                            </Grid>

                            <Grid item xs={12}>
                              <FormControlLabel 
                                control={
                                  <Checkbox 
                                    checked={emailData.autoReply.onlyDuringHours} 
                                    onChange={(e) => handleNestedChange('autoReply', 'onlyDuringHours', e.target.checked)}
                                    sx={{ color: '#f57c00', '&.Mui-checked': { color: '#f57c00' } }}
                                  />
                                } 
                                label="Only send during business hours" 
                              />
                            </Grid>

                            {emailData.autoReply.onlyDuringHours && (
                              <>
                                <Grid item xs={12} md={6}>
                                  <TextField
                                    fullWidth
                                    type="time"
                                    label="Start Time"
                                    value={emailData.autoReply.businessHoursStart}
                                    onChange={(e) => handleNestedChange('autoReply', 'businessHoursStart', e.target.value)}
                                    InputLabelProps={{ shrink: true }}
                                    sx={{ backgroundColor: 'white' }}
                                  />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                  <TextField
                                    fullWidth
                                    type="time"
                                    label="End Time"
                                    value={emailData.autoReply.businessHoursEnd}
                                    onChange={(e) => handleNestedChange('autoReply', 'businessHoursEnd', e.target.value)}
                                    InputLabelProps={{ shrink: true }}
                                    sx={{ backgroundColor: 'white' }}
                                  />
                                </Grid>

                                {errors.businessHours && (
                                  <Grid item xs={12}>
                                    <Alert severity="error">
                                      {errors.businessHours}
                                    </Alert>
                                  </Grid>
                                )}

                                <Grid item xs={12}>
                                  <Alert severity="info">
                                    Auto-replies will only be sent between {emailData.autoReply.businessHoursStart} and {emailData.autoReply.businessHoursEnd}. 
                                    Outside these hours, emails will be queued for the next business day.
                                  </Alert>
                                </Grid>
                              </>
                            )}
                          </Grid>
                        </Paper>
                      </Grid>

                      {/* NEW: Auto-Reply Summary */}
                      <Grid item xs={12}>
                        <Paper sx={{ p: 2, backgroundColor: '#e8f5e8', borderRadius: 1, border: '1px solid #4CAF50' }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: '#2e7d32' }}>
                            📋 Auto-Reply Configuration Summary
                          </Typography>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                            <Typography variant="body2">
                              <strong>Type:</strong> {emailData.autoReply.replyType === 'standard' ? 'Standard Response' : 
                                                     emailData.autoReply.replyType === 'out_of_office' ? 'Out of Office' : 'Custom Message'}
                            </Typography>
                            <Typography variant="body2">
                              <strong>AI Enhanced:</strong> {emailData.autoReply.useAI ? `Yes (${emailData.autoReply.aiTone} tone)` : 'No'}
                            </Typography>
                            <Typography variant="body2">
                              <strong>Delay:</strong> {emailData.autoReply.delayEnabled ? 
                                (emailData.autoReply.delayType === 'immediate' ? 'Immediate' : 
                                 `${emailData.autoReply.delayAmount} ${emailData.autoReply.delayType}`) : 'Immediate'}
                            </Typography>
                            <Typography variant="body2">
                              <strong>Reply Once:</strong> {emailData.autoReply.replyOnlyOnce ? 'Yes' : 'No'}
                            </Typography>
                            {emailData.autoReply.skipIfContainsKeywords && (
                              <Typography variant="body2">
                                <strong>Skip Keywords:</strong> {emailData.autoReply.skipIfContainsKeywords}
                              </Typography>
                            )}
                            <Typography variant="body2">
                              <strong>Business Hours Only:</strong> {emailData.autoReply.onlyDuringHours ? 
                                `Yes (${emailData.autoReply.businessHoursStart} - ${emailData.autoReply.businessHoursEnd})` : 'No'}
                            </Typography>
                          </Box>
                        </Paper>
                      </Grid>
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
          
          {/* NEW: Show auto-reply preview if enabled */}
          {emailData.autoReply.enabled && (
            <Box sx={{ mt: 3 }}>
              <Divider sx={{ mb: 2 }} />
              <Typography variant="h6" sx={{ mb: 1 }}>Auto-Reply Preview:</Typography>
              <Paper sx={{ p: 2, backgroundColor: '#f5f5f5' }}>
                <Typography variant="body2" sx={{ fontStyle: 'italic', mb: 1 }}>
                  {emailData.autoReply.delayEnabled && emailData.autoReply.delayType !== 'immediate' && 
                   `[Will be sent after ${emailData.autoReply.delayAmount} ${emailData.autoReply.delayType}]`}
                </Typography>
                <Typography variant="body1">
                  {emailData.autoReply.replyType === 'custom' ? 
                   emailData.autoReply.customMessage : 
                   emailData.autoReply.template}
                </Typography>
                {emailData.autoReply.useAI && (
                  <Typography variant="caption" sx={{ display: 'block', mt: 1, color: '#666' }}>
                    * Message will be enhanced with AI using {emailData.autoReply.aiTone} tone
                  </Typography>
                )}
              </Paper>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
};

export default EmailComposer;