import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
  Chip,
  CircularProgress,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import {
  Email as EmailIcon,
  Check as CheckIcon,
  Warning as WarningIcon,
  Google as GoogleIcon,
  Send as SendIcon
} from '@mui/icons-material';

const GmailConnection = () => {
  const [connectionStatus, setConnectionStatus] = useState({
    connected: false,
    email: null,
    loading: true
  });
  const [connecting, setConnecting] = useState(false);
  const [testDialog, setTestDialog] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    checkConnectionStatus();
    
    // Listen for OAuth popup messages
    const handleMessage = (event) => {
      if (event.data?.success) {
        setSuccess(`Gmail account ${event.data.email} connected successfully!`);
        checkConnectionStatus();
      } else if (event.data?.error) {
        setError(`Connection failed: ${event.data.error}`);
      }
      setConnecting(false);
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const checkConnectionStatus = async () => {
    try {
      const response = await fetch('/api/auth/google/status', {
        headers: {
          'Authorization': `Bearer ${await getAuthToken()}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setConnectionStatus({
          connected: data.connected,
          email: data.email,
          loading: false
        });
      }
    } catch (error) {
      console.error('Error checking connection status:', error);
      setConnectionStatus(prev => ({ ...prev, loading: false }));
    }
  };

  const getAuthToken = async () => {
    const { auth } = await import('../firebase/config');
    const user = auth.currentUser;
    return user ? await user.getIdToken() : null;
  };

  const connectGmail = async () => {
    try {
      setConnecting(true);
      setError(null);

      const token = await getAuthToken();
      const response = await fetch('/api/auth/google/url', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (data.success) {
        // Open popup for OAuth
        const popup = window.open(
          data.authUrl,
          'gmail-oauth',
          'width=500,height=600,scrollbars=yes,resizable=yes'
        );

        // Check if popup is closed manually
        const checkClosed = setInterval(() => {
          if (popup.closed) {
            clearInterval(checkClosed);
            setConnecting(false);
          }
        }, 1000);
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      setError(error.message);
      setConnecting(false);
    }
  };

  const disconnectGmail = async () => {
    try {
      const token = await getAuthToken();
      const response = await fetch('/api/auth/google/disconnect', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Gmail account disconnected successfully');
        setConnectionStatus({
          connected: false,
          email: null,
          loading: false
        });
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      setError(error.message);
    }
  };

  const sendTestEmail = async () => {
    try {
      setTestLoading(true);
      const token = await getAuthToken();
      
      const response = await fetch('/api/auth/google/test', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          testEmail: testEmail || undefined
        })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(`Test email sent successfully to ${data.sentTo}`);
        setTestDialog(false);
        setTestEmail('');
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setTestLoading(false);
    }
  };

  if (connectionStatus.loading) {
    return (
      <Card>
        <CardContent>
          <Box display="flex" alignItems="center" gap={2}>
            <CircularProgress size={24} />
            <Typography>Checking Gmail connection...</Typography>
          </Box>
        </CardContent>
      </Card>
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

      <Card>
        <CardContent>
          <Box display="flex" alignItems="center" gap={2} mb={2}>
            <EmailIcon color={connectionStatus.connected ? 'success' : 'disabled'} />
            <Typography variant="h6">Gmail Connection</Typography>
            <Chip
              label={connectionStatus.connected ? 'Connected' : 'Not Connected'}
              color={connectionStatus.connected ? 'success' : 'default'}
              icon={connectionStatus.connected ? <CheckIcon /> : <WarningIcon />}
            />
          </Box>

          {connectionStatus.connected ? (
            <Box>
              <Typography color="text.secondary" gutterBottom>
                Connected Gmail Account: <strong>{connectionStatus.email}</strong>
              </Typography>
              
              <List dense>
                <ListItem>
                  <ListItemIcon>
                    <CheckIcon color="success" />
                  </ListItemIcon>
                  <ListItemText primary="Send emails through your Gmail account" />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <CheckIcon color="success" />
                  </ListItemIcon>
                  <ListItemText primary="Schedule emails for future delivery" />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <CheckIcon color="success" />
                  </ListItemIcon>
                  <ListItemText primary="Personalize emails with dynamic content" />
                </ListItem>
              </List>

              <Box mt={2} display="flex" gap={2}>
                <Button
                  variant="outlined"
                  startIcon={<SendIcon />}
                  onClick={() => setTestDialog(true)}
                >
                  Send Test Email
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  onClick={disconnectGmail}
                >
                  Disconnect
                </Button>
              </Box>
            </Box>
          ) : (
            <Box>
              <Typography color="text.secondary" gutterBottom>
                Connect your Gmail account to start sending emails through the platform.
              </Typography>
              
              <List dense sx={{ mb: 2 }}>
                <ListItem>
                  <ListItemIcon>
                    <GoogleIcon />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Secure OAuth2 authentication"
                    secondary="We never store your Gmail password"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <EmailIcon />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Send emails from your Gmail account"
                    secondary="Emails will appear as sent from your Gmail"
                  />
                </ListItem>
              </List>

              <Button
                variant="contained"
                startIcon={<GoogleIcon />}
                onClick={connectGmail}
                disabled={connecting}
                size="large"
              >
                {connecting ? 'Connecting...' : 'Connect Gmail Account'}
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Test Email Dialog */}
      <Dialog open={testDialog} onClose={() => setTestDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Send Test Email</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            Send a test email to verify your Gmail connection is working properly.
          </Typography>
          <TextField
            autoFocus
            margin="dense"
            label="Test Email Address (optional)"
            type="email"
            fullWidth
            variant="outlined"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder={connectionStatus.email || 'Enter email address'}
            sx={{ mt: 2 }}
          />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Leave blank to send to your own email address ({connectionStatus.email})
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTestDialog(false)}>Cancel</Button>
          <Button 
            onClick={sendTestEmail} 
            variant="contained"
            disabled={testLoading}
            startIcon={testLoading ? <CircularProgress size={16} /> : <SendIcon />}
          >
            {testLoading ? 'Sending...' : 'Send Test Email'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default GmailConnection;