import React from 'react';
import { Box, Container, Typography, Paper, Divider } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import GmailConnection from '../components/GmailConnection';

const Profile = () => {
  const { user, loading } = useAuth(); // Changed from currentUser to user, added loading

  return (
    <Container maxWidth="md">
      <Box sx={{ my: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Profile & Settings
        </Typography>

        {/* User Information Section */}
        <Paper sx={{ p: 3, mt: 2, mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            Account Information
          </Typography>
          <Divider sx={{ mb: 2 }} />
          {loading ? (
            <Typography>Loading user information...</Typography>
          ) : user ? (
            <Box>
              <Typography sx={{ mb: 1 }}>
                <strong>Email:</strong> {user.email}
              </Typography>
              {user.displayName && (
                <Typography sx={{ mb: 1 }}>
                  <strong>Display Name:</strong> {user.displayName}
                </Typography>
              )}
              {user.createdAt && (
                <Typography sx={{ mb: 1 }}>
                  <strong>Member Since:</strong> {new Date(user.createdAt).toLocaleDateString()}
                </Typography>
              )}
              {user.lastLogin && (
                <Typography>
                  <strong>Last Login:</strong> {new Date(user.lastLogin).toLocaleDateString()}
                </Typography>
              )}
            </Box>
          ) : (
            <Typography>No user information available.</Typography>
          )}
        </Paper>

        {/* Gmail Connection Section */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Email Sending Configuration
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Connect your Gmail account to enable sending and scheduling emails directly from the platform using your own address.
          </Typography>
          
          <GmailConnection />
        </Paper>
      </Box>
    </Container>
  );
};

export default Profile;