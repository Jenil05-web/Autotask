import React, { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Tabs,
  Tab,
  Card,
  CardContent,
  Grid,
  Button,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import {
  Email as EmailIcon,
  Schedule as ScheduleIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Dashboard as DashboardIcon,
  Automation as AutomationIcon
} from '@mui/icons-material';
import EmailAutomation from '../components/EmailAutomation';

function Dashboard() {
  const [activeTab, setActiveTab] = useState(0);
  const [tasks, setTasks] = useState([
    { 
      id: 1, 
      name: 'Send daily email report', 
      type: 'email',
      status: 'active',
      schedule: 'Daily at 9:00 AM',
      lastRun: '2024-01-15 09:00:00',
      nextRun: '2024-01-16 09:00:00'
    },
    { 
      id: 2, 
      name: 'Backup files to cloud', 
      type: 'backup',
      status: 'paused',
      schedule: 'Weekly on Sunday',
      lastRun: '2024-01-14 02:00:00',
      nextRun: '2024-01-21 02:00:00'
    },
    {
      id: 3,
      name: 'Follow-up reminder emails',
      type: 'email',
      status: 'active',
      schedule: 'Every 3 days',
      lastRun: '2024-01-15 10:00:00',
      nextRun: '2024-01-18 10:00:00'
    }
  ]);

  const [emailAutomations, setEmailAutomations] = useState([
    {
      id: 1,
      subject: 'Weekly Team Update',
      recipients: ['team@company.com'],
      status: 'scheduled',
      scheduledTime: '2024-01-16 09:00:00',
      followUpEnabled: true,
      autoReplyEnabled: true
    },
    {
      id: 2,
      subject: 'Client Follow-up',
      recipients: ['client@example.com'],
      status: 'active',
      scheduledTime: '2024-01-17 14:00:00',
      followUpEnabled: true,
      autoReplyEnabled: false
    }
  ]);

  const [createTaskDialog, setCreateTaskDialog] = useState(false);
  const [newTask, setNewTask] = useState({
    name: '',
    type: 'email',
    schedule: 'daily',
    time: '09:00'
  });

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const toggleTaskStatus = (taskId) => {
    setTasks(prev => 
      prev.map(task => 
        task.id === taskId 
          ? { ...task, status: task.status === 'active' ? 'paused' : 'active' }
          : task
      )
    );
  };

  const runTaskNow = (taskId) => {
    // Simulate running task
    console.log(`Running task ${taskId}`);
    // In real app, this would trigger the actual automation
  };

  const createTask = () => {
    if (newTask.name.trim()) {
      const task = {
        id: Date.now(),
        name: newTask.name,
        type: newTask.type,
        status: 'active',
        schedule: `${newTask.schedule} at ${newTask.time}`,
        lastRun: null,
        nextRun: new Date().toISOString()
      };
      setTasks(prev => [...prev, task]);
      setNewTask({ name: '', type: 'email', schedule: 'daily', time: '09:00' });
      setCreateTaskDialog(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'success';
      case 'paused': return 'warning';
      case 'error': return 'error';
      default: return 'default';
    }
  };

  const getTaskIcon = (type) => {
    switch (type) {
      case 'email': return <EmailIcon />;
      case 'backup': return <ScheduleIcon />;
      default: return <AutomationIcon />;
    }
  };

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <DashboardIcon color="primary" />
          Auto Task AI Dashboard
        </Typography>
        <Typography variant="h6" color="text.secondary">
          Automate your daily tasks with AI-powered intelligence
        </Typography>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="primary">
                {tasks.filter(t => t.status === 'active').length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Active Automations
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="success.main">
              {emailAutomations.filter(e => e.status === 'scheduled').length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Scheduled Emails
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="info.main">
                {tasks.filter(t => t.status === 'paused').length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Paused Tasks
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="warning.main">
                {tasks.length + emailAutomations.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Automations
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Main Content Tabs */}
      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={activeTab} onChange={handleTabChange} aria-label="dashboard tabs">
            <Tab 
              icon={<DashboardIcon />} 
              label="Overview" 
              iconPosition="start"
            />
            <Tab 
              icon={<EmailIcon />} 
              label="Email Automation" 
              iconPosition="start"
            />
            <Tab 
              icon={<AutomationIcon />} 
              label="Task Automation" 
              iconPosition="start"
            />
          </Tabs>
        </Box>

        <Box sx={{ p: 3 }}>
          {/* Overview Tab */}
          {activeTab === 0 && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h5">Recent Activity</Typography>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => setCreateTaskDialog(true)}
                >
                  Create New Task
                </Button>
              </Box>

              <Grid container spacing={3}>
                {/* Active Tasks */}
                <Grid item xs={12} md={6}>
                  <Typography variant="h6" gutterBottom>Active Tasks</Typography>
                  {tasks.filter(t => t.status === 'active').map(task => (
                    <Card key={task.id} sx={{ mb: 2 }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {getTaskIcon(task.type)}
                            <Typography variant="subtitle1">{task.name}</Typography>
                          </Box>
                          <Chip label={task.status} color={getStatusColor(task.status)} size="small" />
                        </Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                          Schedule: {task.schedule}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Next Run: {task.nextRun ? new Date(task.nextRun).toLocaleString() : 'Not scheduled'}
                        </Typography>
                        <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<PauseIcon />}
                            onClick={() => toggleTaskStatus(task.id)}
                          >
                            Pause
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<PlayIcon />}
                            onClick={() => runTaskNow(task.id)}
                          >
                            Run Now
                          </Button>
                        </Box>
                      </CardContent>
                    </Card>
                  ))}
                </Grid>

                {/* Scheduled Emails */}
                <Grid item xs={12} md={6}>
                  <Typography variant="h6" gutterBottom>Scheduled Emails</Typography>
                  {emailAutomations.filter(e => e.status === 'scheduled').map(email => (
                    <Card key={email.id} sx={{ mb: 2 }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="subtitle1">{email.subject}</Typography>
                          <Chip label={email.status} color="primary" size="small" />
                        </Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                          To: {email.recipients.join(', ')}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Scheduled: {new Date(email.scheduledTime).toLocaleString()}
                        </Typography>
                        <Box sx={{ mt: 1 }}>
                          {email.followUpEnabled && (
                            <Chip label="Follow-up" size="small" color="info" sx={{ mr: 1 }} />
                          )}
                          {email.autoReplyEnabled && (
                            <Chip label="Auto-reply" size="small" color="success" />
                          )}
                        </Box>
                      </CardContent>
                    </Card>
                  ))}
                </Grid>
              </Grid>
            </Box>
          )}

          {/* Email Automation Tab */}
          {activeTab === 1 && (
            <EmailAutomation />
          )}

          {/* Task Automation Tab */}
          {activeTab === 2 && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h5">Task Automation</Typography>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => setCreateTaskDialog(true)}
                >
                  Create New Task
                </Button>
              </Box>

              <Grid container spacing={3}>
                {tasks.map(task => (
                  <Grid item xs={12} md={6} lg={4} key={task.id}>
                    <Card>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {getTaskIcon(task.type)}
                            <Typography variant="h6">{task.name}</Typography>
                          </Box>
                          <Chip label={task.status} color={getStatusColor(task.status)} />
                        </Box>
                        
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          Schedule: {task.schedule}
                        </Typography>
                        
                        {task.lastRun && (
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            Last Run: {new Date(task.lastRun).toLocaleString()}
                          </Typography>
                        )}
                        
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          Next Run: {task.nextRun ? new Date(task.nextRun).toLocaleString() : 'Not scheduled'}
                        </Typography>

                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          <Button
                            size="small"
                            variant={task.status === 'active' ? 'outlined' : 'contained'}
                            startIcon={task.status === 'active' ? <PauseIcon /> : <PlayIcon />}
                            onClick={() => toggleTaskStatus(task.id)}
                          >
                            {task.status === 'active' ? 'Pause' : 'Activate'}
                          </Button>
                          
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<PlayIcon />}
                            onClick={() => runTaskNow(task.id)}
                          >
                            Run Now
                          </Button>
                          
                          <IconButton size="small" color="primary">
                            <EditIcon />
                          </IconButton>
                          
                          <IconButton size="small" color="error">
                            <DeleteIcon />
                          </IconButton>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}
        </Box>
      </Card>

      {/* Create Task Dialog */}
      <Dialog open={createTaskDialog} onClose={() => setCreateTaskDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Automation Task</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Task Name"
            value={newTask.name}
            onChange={(e) => setNewTask(prev => ({ ...prev, name: e.target.value }))}
            margin="normal"
          />
          
          <FormControl fullWidth margin="normal">
            <InputLabel>Task Type</InputLabel>
            <Select
              value={newTask.type}
              onChange={(e) => setNewTask(prev => ({ ...prev, type: e.target.value }))}
            >
              <MenuItem value="email">Email Automation</MenuItem>
              <MenuItem value="backup">File Backup</MenuItem>
              <MenuItem value="data">Data Processing</MenuItem>
              <MenuItem value="notification">Notification</MenuItem>
            </Select>
          </FormControl>
          
          <FormControl fullWidth margin="normal">
            <InputLabel>Schedule</InputLabel>
            <Select
              value={newTask.schedule}
              onChange={(e) => setNewTask(prev => ({ ...prev, schedule: e.target.value }))}
            >
              <MenuItem value="daily">Daily</MenuItem>
              <MenuItem value="weekly">Weekly</MenuItem>
              <MenuItem value="monthly">Monthly</MenuItem>
              <MenuItem value="custom">Custom</MenuItem>
            </Select>
          </FormControl>
          
          <TextField
            fullWidth
            label="Time"
            type="time"
            value={newTask.time}
            onChange={(e) => setNewTask(prev => ({ ...prev, time: e.target.value }))}
            margin="normal"
            InputLabelProps={{ shrink: true }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateTaskDialog(false)}>Cancel</Button>
          <Button onClick={createTask} variant="contained">Create Task</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default Dashboard;
