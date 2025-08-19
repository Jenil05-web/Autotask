 import React from 'react';

function Login() {
  return (
    <div className="container">
      <div className="header">
        <h1>Login to Auto Task AI</h1>
      </div>
      
      <div style={{ maxWidth: '400px', margin: '0 auto' }}>
        <form>
          <div style={{ marginBottom: '15px' }}>
            <input
              type="email"
              placeholder="Email"
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '5px'
              }}
            />
          </div>
          
          <div style={{ marginBottom: '15px' }}>
            <input
              type="password"
              placeholder="Password"
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '5px'
              }}
            />
          </div>
          
          <button
            type="submit"
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: '#2196F3',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            Login
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;