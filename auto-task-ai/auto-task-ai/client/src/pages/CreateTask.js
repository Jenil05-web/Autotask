 // client/src/pages/CreateTask.js
import React from 'react';

function CreateTask() {
  return (
    <div className="container">
      <div className="header">
        <h1>Create New Task</h1>
        <p>Set up an automated task</p>
      </div>
      
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        <form>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Task Name
            </label>
            <input
              type="text"
              placeholder="Enter task name"
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '5px',
                boxSizing: 'border-box'
              }}
            />
          </div>
          
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Task Type
            </label>
            <select style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '5px',
              boxSizing: 'border-box'
            }}>
              <option value="">Select task type</option>
              <option value="email">Email Automation</option>
              <option value="file">File Management</option>
              <option value="api">API Call</option>
              <option value="web">Web Scraping</option>
            </select>
          </div>
          
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Description
            </label>
            <textarea
              placeholder="Describe what this task should do"
              rows="4"
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '5px',
                boxSizing: 'border-box',
                resize: 'vertical'
              }}
            />
          </div>
          
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Schedule
            </label>
            <select style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '5px',
              boxSizing: 'border-box'
            }}>
              <option value="">Select schedule</option>
              <option value="once">Run once</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          
          <button
            type="submit"
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            Create Task
          </button>
        </form>
      </div>
    </div>
  );
}

export default CreateTask;
