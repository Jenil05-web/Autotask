import React from 'react';
import { useAuth } from '../context/AuthContext'; // Assuming you have this
import { Button, Typography } from '@mui/material';

const Profile = () => {
    const { currentUser } = useAuth();

    const handleConnectGoogle = () => {
        if (currentUser) {
            // This will redirect the user to the backend OAuth route
            window.location.href = `http://localhost:5000/api/auth/google?userId=${currentUser.uid}`;
        }
    };

    return (
        <div>
            <Typography variant="h4">Profile & Settings</Typography>
            {/* Add logic here to check if user is already connected */}
            <Button variant="contained" onClick={handleConnectGoogle}>
                Connect your Google Account to Send Emails
            </Button>
        </div>
    );
};

export default Profile;