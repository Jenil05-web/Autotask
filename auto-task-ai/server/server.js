
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Basic routes
app.get('/', (req, res) => {
  res.json({ message: 'Auto Task AI Server is running!' });
});

app.get('/api/tasks', (req, res) => {
  res.json({
    tasks: [
      { id: 1, name: 'Send daily email report', status: 'active' },
      { id: 2, name: 'Backup files to cloud', status: 'paused' }
    ]
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});