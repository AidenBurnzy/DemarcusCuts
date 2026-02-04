#!/bin/bash

# Start the backend server
echo "🚀 Starting DemarcusCuts backend server..."
cd backend
npm install > /dev/null 2>&1
node server.js
