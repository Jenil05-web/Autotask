#!/bin/bash

echo "🚀 Starting Auto Task AI Development Environment..."

# Kill any existing processes on ports 3000 and 5000
echo "🔧 Cleaning up existing processes..."
pkill -f "react-scripts start" 2>/dev/null || true
pkill -f "node server.js" 2>/dev/null || true

# Wait a moment for processes to terminate
sleep 2

# Start the server in the background
echo "🖥️  Starting Express server on port 5000..."
cd server
nohup npm run dev > ../server.log 2>&1 &
SERVER_PID=$!
cd ..

# Start the client in the background
echo "🌐 Starting React client on port 3000..."
cd client
nohup npm start > ../client.log 2>&1 &
CLIENT_PID=$!
cd ..

# Save PIDs for easy cleanup
echo $SERVER_PID > .server.pid
echo $CLIENT_PID > .client.pid

echo "✅ Development environment started!"
echo "📱 Client: http://localhost:3000"
echo "🖥️  Server: http://localhost:5000"
echo ""
echo "📋 To stop both services, run: ./stop-dev.sh"
echo "📋 To view logs: tail -f server.log or tail -f client.log"
echo ""
echo "⏳ Waiting for services to be ready..."

# Wait for both services to be ready
sleep 5

# Check if services are responding
if curl -s http://localhost:5000/ > /dev/null; then
    echo "✅ Server is running and responding"
else
    echo "❌ Server failed to start"
fi

if curl -s http://localhost:3000/ > /dev/null; then
    echo "✅ Client is running and responding"
else
    echo "❌ Client failed to start"
fi

echo ""
echo "🎉 Ready to develop! Both services are running."