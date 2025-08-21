import React from 'react';

const FirebaseSetupNotice = () => {
  return (
    <div style={{
      backgroundColor: '#fff3cd',
      border: '1px solid #ffeaa7',
      borderRadius: '8px',
      padding: '20px',
      margin: '20px 0',
      color: '#856404'
    }}>
      <h3 style={{ margin: '0 0 15px 0', color: '#856404' }}>
        🔧 Firebase Setup Required
      </h3>
      <p style={{ margin: '0 0 15px 0' }}>
        To use authentication features, you need to configure Firebase:
      </p>
      <ol style={{ margin: '0 0 15px 0', paddingLeft: '20px' }}>
        <li>Copy <code>.env.example</code> to <code>.env</code> in the client folder</li>
        <li>Fill in your Firebase project credentials</li>
        <li>Restart the development server</li>
      </ol>
      <p style={{ margin: '0', fontSize: '14px' }}>
        📚 See <code>FIREBASE_SETUP_INSTRUCTIONS.md</code> for detailed setup instructions.
      </p>
    </div>
  );
};

export default FirebaseSetupNotice;