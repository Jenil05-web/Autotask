import React, { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Tabs,
  Tab,
  Chip
} from '@mui/material';
import {
  Task as TaskIcon,
  Email as EmailIcon,
  Schedule as ScheduleIcon,
  Add as AddIcon
} from '@mui/icons-material';
import EmailDashboard from '../components/EmailDashboard';

function Dashboard() {
  const [activeTab, setActiveTab] = useState(0);
  const [tasks, setTasks] = useState([
    { id: 1, name: 'Send daily email report', status: 'active' },
    { id: 2, name: 'Backup files to cloud', status: 'paused' }
  ]);

  const TabPanel = ({ children, value, index }) => (
    <div hidden={value !== index} style={{ paddingTop: 24 }}>
      {value === index && children}
    </div>
  );

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" gutterBottom>
          Auto Task AI Dashboard
        </Typography>
        <Typography variant="h6" color="text.secondary">
          Automate your daily tasks with AI
        </Typography>
      </Box>

      {/* Navigation Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
          <Tab 
            icon={<TaskIcon />} 
            label="General Tasks" 
            iconPosition="start"
          />
          <Tab 
            icon={<EmailIcon />} 
            label="Email Automation" 
            iconPosition="start"
          />
        </Tabs>
      </Box>

      {/* General Tasks Tab */}
      <TabPanel value={activeTab} index={0}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h5">Your Active Tasks</Typography>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    sx={{ backgroundColor: '#4CAF50' }}
                  >
                    Create New Task
                  </Button>
                </Box>
                
                <Grid container spacing={2}>
                  {tasks.map(task => (
                    <Grid item xs={12} md={6} key={task.id}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="h6" gutterBottom>
                            {task.name}
                          </Typography>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Chip 
                              label={task.status} 
                              color={task.status === 'active' ? 'success' : 'default'}
                              size="small"
                            />
                            <Box sx={{ display: 'flex', gap: 1 }}>
                              <Button size="small" variant="outlined">
                                Edit
                              </Button>
                              <Button size="small" variant="contained">
                                Run Now
                              </Button>
                            </Box>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Email Automation Tab */}
      <TabPanel value={activeTab} index={1}>
        <EmailDashboard />
      </TabPanel>
    </Container>
  );
}

export default Dashboard;
