 // client/src/pages/Profile.js
import React from 'react';
import { useAuth } from '../context/AuthContext';

function Profile() {
  const { currentUser, userProfile } = useAuth();

  return (
    <div className="container">
      <div className="header">
        <h1>User Profile</h1>
        <p>Manage your account settings</p>
      </div>
      
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        <div className="task-card" style={{ marginBottom: '20px' }}>
          <h3>Account Information</h3>
          <p><strong>Name:</strong> {userProfile?.displayName || 'Not set'}</p>
          <p><strong>Email:</strong> {currentUser?.email}</p>
          <p><strong>Account Created:</strong> {userProfile?.createdAt?.toDate?.()?.toLocaleDateString() || 'Unknown'}</p>
          <p><strong>Tasks Created:</strong> {userProfile?.tasksCount || 0}</p>
          <p><strong>Subscription:</strong> {userProfile?.subscription || 'Free'}</p>
        </div>
        
        <div className="task-card">
          <h3>Account Settings</h3>
          <button style={{
            padding: '10px 20px',
            backgroundColor: '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            marginRight: '10px'
          }}>
            Edit Profile
          </button>
          
          <button style={{
            padding: '10px 20px',
            backgroundColor: '#FF9800',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}>
            Change Password
          </button>
        </div>
      </div>
    </div>
  );
}

export default Profile;
