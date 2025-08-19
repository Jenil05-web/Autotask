 import React, { useState } from 'react';

function Dashboard() {
  const [tasks, setTasks] = useState([
    { id: 1, name: 'Send daily email report', status: 'active' },
    { id: 2, name: 'Backup files to cloud', status: 'paused' }
  ]);

  return (
    <div className="container">
      <div className="header">
        <h1>Auto Task AI Dashboard</h1>
        <p>Automate your daily tasks with AI</p>
      </div>
      
      <div className="tasks-section">
        <h2>Your Active Tasks</h2>
        {tasks.map(task => (
          <div key={task.id} className="task-card">
            <h3>{task.name}</h3>
            <p>Status: {task.status}</p>
            <button>Edit</button>
            <button>Run Now</button>
          </div>
        ))}
        
        <button style={{
          padding: '10px 20px',
          backgroundColor: '#4CAF50',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer',
          marginTop: '20px'
        }}>
          + Create New Task
        </button>
      </div>
    </div>
  );
}

export default Dashboard;
