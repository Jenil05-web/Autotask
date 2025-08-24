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

// Import Firebase auth directly from your config file
import { auth } from '../firebase/firebase.config.local.js';
import { onAuthStateChanged } from 'firebase/auth';


const GmailConnection = () => {
  // Add API base URL
  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
  
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
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    console.log('🔍 Debug: Setting up Firebase auth listener...');
    console.log('🔍 Debug: Auth object:', auth);
    
    // Set up auth state listener
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      console.log('🔍 Debug: Auth state changed:', !!currentUser, currentUser?.email);
      setUser(currentUser);
      setAuthLoading(false);
      
      if (currentUser) {
        // User is signed in, check connection status
        console.log('🔍 Debug: User authenticated, checking Gmail connection...');
        checkConnectionStatus();
      } else {
        // User is signed out
        console.log('🔍 Debug: User not authenticated');
        setConnectionStatus({
          connected: false,
          email: null,
          loading: false
        });
      }
    });

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
    
    return () => {
      unsubscribe();
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const getAuthToken = async () => {
    try {
      console.log('🔍 Debug: Getting auth token...');
      console.log('🔍 Debug: Current user exists:', !!user);
      
      if (!user) {
        console.log('🔍 Debug: No current user available');
        return null;
      }
      
      console.log('🔍 Debug: User email:', user.email);
      
      const token = await user.getIdToken(true); // Force refresh
      console.log('🔍 Debug: Got ID token:', !!token);
      console.log('🔍 Debug: Token preview:', token?.substring(0, 50) + '...');
      
      return token;
    } catch (error) {
      console.error('🔍 Debug: Error getting auth token:', error);
      return null;
    }
  };

  const checkConnectionStatus = async () => {
    try {
      console.log('🔍 Debug: Starting connection status check...');
      
      const token = await getAuthToken();
      console.log('🔍 Debug: Got auth token for status check:', !!token);
      
      if (!token) {
        console.log('🔍 Debug: No token available, cannot check status');
        setConnectionStatus({
          connected: false,
          email: null,
          loading: false
        });
        setError('Please make sure you are logged in');
        return;
      }
      
      console.log('🔍 Debug: Making API request to', `${API_BASE_URL}/auth/google/status`);
      const response = await fetch(`${API_BASE_URL}/auth/google/status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('🔍 Debug: Response status:', response.status);
      console.log('🔍 Debug: Response ok:', response.ok);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log('🔍 Debug: Error response:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      console.log('🔍 Debug: Success response:', data);
      
      if (data.success) {
        setConnectionStatus({
          connected: data.connected,
          email: data.email,
          loading: false
        });
        setError(null); // Clear any previous errors
      } else {
        throw new Error(data.error || 'Failed to check connection status');
      }
    } catch (error) {
      console.error('🔍 Debug: Error in checkConnectionStatus:', error);
      setConnectionStatus(prev => ({ ...prev, loading: false }));
      setError(`Connection check failed: ${error.message}`);
    }
  };

  const connectGmail = async () => {
    try {
      setConnecting(true);
      setError(null);
      
      console.log('🔍 Debug: Starting Gmail connection...');

      const token = await getAuthToken();
      console.log('🔍 Debug: Got token for Gmail connection:', !!token);
      
      if (!token) {
        throw new Error('User not authenticated - please refresh the page and try again');
      }

      console.log('🔍 Debug: Making API request to', `${API_BASE_URL}/auth/google/url`);
      const response = await fetch(`${API_BASE_URL}/auth/google/url`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('🔍 Debug: Auth URL response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get OAuth URL: ${errorText}`);
      }
      
      const data = await response.json();
      console.log('🔍 Debug: Auth URL response data:', data);

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
        throw new Error(data.error || 'Failed to generate OAuth URL');
      }
    } catch (error) {
      console.error('🔍 Debug: Error in connectGmail:', error);
      setError(error.message);
      setConnecting(false);
    }
  };

  const disconnectGmail = async () => {
    try {
      const token = await getAuthToken();
      if (!token) {
        throw new Error('User not authenticated');
      }

      const response = await fetch(`${API_BASE_URL}/auth/google/disconnect`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to disconnect: ${errorText}`);
      }

      const data = await response.json();

      if (data.success) {
        setSuccess('Gmail account disconnected successfully');
        setConnectionStatus({
          connected: false,
          email: null,
          loading: false
        });
      } else {
        throw new Error(data.error || 'Failed to disconnect');
      }
    } catch (error) {
      setError(error.message);
    }
  };

  const sendTestEmail = async () => {
    try {
      setTestLoading(true);
      setError(null);
      const token = await getAuthToken();
      
      if (!token) {
        throw new Error('User not authenticated');
      }
      
      const response = await fetch(`${API_BASE_URL}/auth/google/test`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          testEmail: testEmail || undefined
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to send test email: ${errorText}`);
      }

      const data = await response.json();

      if (data.success) {
        setSuccess(`Test email sent successfully to ${data.sentTo}`);
        setTestDialog(false);
        setTestEmail('');
      } else {
        throw new Error(data.error || 'Failed to send test email');
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setTestLoading(false);
    }
  };

  // Show loading state while determining auth status
  if (authLoading) {
    return (
      <Card>
        <CardContent>
          <Box display="flex" alignItems="center" gap={2}>
            <CircularProgress size={24} />
            <Typography>Initializing authentication...</Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  // Show login required message if not authenticated
  if (!user) {
    return (
      <Card>
        <CardContent>
          <Alert severity="warning">
            Please log in to connect your Gmail account.
          </Alert>
        </CardContent>
      </Card>
    );
  }

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
                  <ListItemIcon><CheckIcon color="success" /></ListItemIcon>
                  <ListItemText primary="Send emails through your Gmail account" />
                </ListItem>
                <ListItem>
                  <ListItemIcon><CheckIcon color="success" /></ListItemIcon>
                  <ListItemText primary="Schedule emails for future delivery" />
                </ListItem>
              </List>

              <Box mt={2} display="flex" gap={2}>
                <Button variant="outlined" startIcon={<SendIcon />} onClick={() => setTestDialog(true)}>
                  Send Test Email
                </Button>
                <Button variant="outlined" color="error" onClick={disconnectGmail}>
                  Disconnect
                </Button>
              </Box>
            </Box>
          ) : (
            <Box>
              <Typography color="text.secondary" gutterBottom>
                Connect your Gmail account to start sending emails.
              </Typography>
              
              <List dense sx={{ mb: 2 }}>
                <ListItem>
                  <ListItemIcon><GoogleIcon /></ListItemIcon>
                  <ListItemText primary="Secure OAuth2 authentication" secondary="We never store your Gmail password" />
                </ListItem>
                <ListItem>
                  <ListItemIcon><EmailIcon /></ListItemIcon>
                  <ListItemText primary="Send emails from your own account" secondary="Emails will appear as sent from your Gmail" />
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

      <Dialog open={testDialog} onClose={() => setTestDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Send Test Email</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            Send a test email to verify your connection is working.
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
            Leave blank to send to your own email address ({connectionStatus.email}).
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