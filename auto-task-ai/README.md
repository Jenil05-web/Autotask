# Auto Task AI

Automate your daily tasks with the power of artificial intelligence. Streamline your workflow, boost productivity, and focus on what matters most.

## 🚀 Quick Start

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Installation
```bash
# Install all dependencies (root, client, and server)
npm run install-all
```

### Development
```bash
# Start both client and server in development mode
npm run dev

# Or use the convenience script
./start-dev.sh
```

### Production
```bash
# Build the client
npm run build

# Start the server
npm start
```

## 📁 Project Structure

```
auto-task-ai/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/         # Page components
│   │   ├── context/       # React context providers
│   │   └── services/      # API service functions
│   └── public/            # Static assets
├── server/                 # Express.js backend
│   ├── routes/            # API route handlers
│   ├── middleware/        # Express middleware
│   ├── services/          # Business logic services
│   └── server.js          # Server entry point
├── shared/                 # Shared utilities
└── functions/              # Firebase Cloud Functions
```

## 🌐 Available Scripts

### Root Level
- `npm run dev` - Start both client and server in development mode
- `npm run server` - Start only the server
- `npm run client` - Start only the client
- `npm run install-all` - Install dependencies for all packages
- `npm run build` - Build the client for production

### Server
- `npm run dev` - Start server with nodemon (auto-restart on changes)
- `npm start` - Start server in production mode

### Client
- `npm start` - Start React development server
- `npm run build` - Build for production

## 🔧 Development Scripts

### Start Development Environment
```bash
./start-dev.sh
```
This script will:
- Clean up any existing processes
- Start the Express server on port 5000
- Start the React client on port 3000
- Verify both services are running

### Stop Development Environment
```bash
./stop-dev.sh
```
This script will:
- Stop the server process
- Stop the client process
- Clean up PID files
- Kill any remaining processes

## 📱 Access Points

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **API Health Check**: http://localhost:5000/

## 🛠️ Troubleshooting

### Port Already in Use
If you get "EADDRINUSE" errors:
```bash
# Kill processes using ports 3000 and 5000
./stop-dev.sh

# Or manually
pkill -f "react-scripts start"
pkill -f "node server.js"
```

### Missing Dependencies
```bash
# Reinstall all dependencies
npm run install-all
```

### Client Compilation Errors
- Ensure all required components exist in `src/components/`
- Check that all imported pages exist in `src/pages/`
- Verify CSS files are present for components

## 🔒 Environment Variables

### Server Environment
Create a `.env` file in the server directory:
```env
PORT=5000
NODE_ENV=development
# Add other environment variables as needed
```

### Client Environment (Firebase)
Create a `.env` file in the client directory (copy from `.env.example`):
```env
REACT_APP_FIREBASE_API_KEY=your_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id
REACT_APP_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

**📖 See [FIREBASE_SETUP.md](./FIREBASE_SETUP.md) for complete setup instructions.**

## 📊 Features

- **AI-Powered Task Automation**: Intelligent task scheduling and execution
- **Firebase Authentication**: Secure email/password and Google sign-in
- **User Management**: Complete user profiles with Firestore database
- **Beautiful UI**: Modern, responsive authentication pages
- **Real-time Dashboard**: Monitor task progress and performance
- **Responsive Design**: Works on all devices
- **Modern UI**: Beautiful, intuitive interface with animations

## 🚧 Current Status

✅ **Fixed Issues:**
- Missing Home page component
- Empty Navbar component
- Port conflicts resolved
- Client compilation errors fixed
- Authentication system implemented

✅ **Working:**
- Express server running on port 5000
- React client running on port 3000
- Basic routing and navigation
- Firebase Authentication (Email/Password + Google)
- Beautiful, modern UI for auth pages
- User management with Firestore

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the ISC License.