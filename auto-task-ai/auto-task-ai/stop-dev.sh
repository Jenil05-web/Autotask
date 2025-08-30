#!/bin/bash

echo "🛑 Stopping Auto Task AI Development Environment..."

# Stop server if PID file exists
if [ -f .server.pid ]; then
    SERVER_PID=$(cat .server.pid)
    if kill -0 $SERVER_PID 2>/dev/null; then
        echo "🖥️  Stopping server (PID: $SERVER_PID)..."
        kill -9 $SERVER_PID
        echo "✅ Server stopped"
    else
        echo "ℹ️  Server process not found"
    fi
    rm -f .server.pid
else
    echo "ℹ️  No server PID file found"
fi

# Stop client if PID file exists
if [ -f .client.pid ]; then
    CLIENT_PID=$(cat .client.pid)
    if kill -0 $CLIENT_PID 2>/dev/null; then
        echo "🌐 Stopping client (PID: $CLIENT_PID)..."
        kill -9 $CLIENT_PID
        echo "✅ Client stopped"
    else
        echo "ℹ️  Client process not found"
    fi
    rm -f .client.pid
else
    echo "ℹ️  No client PID file found"
fi

# Kill any remaining processes
echo "🔧 Cleaning up any remaining processes..."
pkill -f "react-scripts start" 2>/dev/null || true
pkill -f "node server.js" 2>/dev/null || true
pkill -f "nodemon server.js" 2>/dev/null || true

echo "✅ All development services stopped!"
echo "🧹 Cleanup complete"