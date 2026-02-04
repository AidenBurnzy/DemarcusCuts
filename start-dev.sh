#!/bin/bash

# DemarcusCuts Development Startup Script

echo "🚀 Starting DemarcusCuts Development Environment..."
echo ""

# Check if backend is already running
if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null ; then
    echo "⚠️  Backend already running on port 3001"
else
    echo "📦 Starting backend server..."
    cd backend
    nohup npm start > /tmp/backend.log 2>&1 &
    BACKEND_PID=$!
    cd ..
    sleep 2
    echo "✅ Backend started (PID: $BACKEND_PID)"
fi

# Check if frontend is already running
if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null ; then
    echo "⚠️  Frontend already running on port 8000"
else
    echo "🌐 Starting frontend server..."
    nohup python3 -m http.server 8000 > /tmp/frontend.log 2>&1 &
    FRONTEND_PID=$!
    sleep 1
    echo "✅ Frontend started (PID: $FRONTEND_PID)"
fi

echo ""
echo "✨ Development environment ready!"
echo ""
echo "📍 Frontend: http://localhost:8000"
echo "📍 Backend:  http://localhost:3001"
echo "📍 Health:   http://localhost:3001/health"
echo ""
echo "📝 Logs:"
echo "   Backend:  tail -f /tmp/backend.log"
echo "   Frontend: tail -f /tmp/frontend.log"
echo ""
echo "🛑 To stop:"
echo "   pkill -f 'npm start'"
echo "   pkill -f 'python3 -m http.server'"
